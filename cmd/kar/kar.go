package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"github.com/cenkalti/backoff/v4"
	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"github.ibm.com/solsa/kar.git/internal/config"
	"github.ibm.com/solsa/kar.git/internal/launcher"
	"github.ibm.com/solsa/kar.git/internal/pubsub"
	"github.ibm.com/solsa/kar.git/internal/store"
	"github.ibm.com/solsa/kar.git/pkg/logger"
)

var (
	// service url
	serviceURL = fmt.Sprintf("http://127.0.0.1:%d", config.ServicePort)

	// pending requests: map uuids to channels
	requests = sync.Map{}

	// termination
	ctx, cancel = context.WithCancel(context.Background())

	// http client
	client http.Client
)

func init() {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConnsPerHost = 256
	client = http.Client{Transport: transport} // TODO adjust timeout
}

// text converts a request or response body to a string
func text(r io.Reader) string {
	buf, _ := ioutil.ReadAll(r)
	return string(buf)
}

// send route handler
func send(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	err := pubsub.Send(map[string]string{
		"protocol":     "service",
		"to":           ps.ByName("service"),
		"session":      ps.ByName("session"),
		"command":      "send", // post with no callback expected
		"path":         ps.ByName("path"),
		"content-type": r.Header.Get("Content-Type"),
		"payload":      text(r.Body)})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to send message: %v", err), http.StatusInternalServerError)
	} else {
		fmt.Fprint(w, "OK")
	}
}

type reply struct {
	statusCode  int
	contentType string
	payload     string
}

// call route handler
func call(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	request := uuid.New().String()
	ch := make(chan reply)
	requests.Store(request, ch)

	err := pubsub.Send(map[string]string{
		"protocol":     "service",
		"to":           ps.ByName("service"),
		"session":      ps.ByName("session"),
		"command":      "call", // post expecting a callback with the result
		"path":         ps.ByName("path"),
		"content-type": r.Header.Get("Content-Type"),
		"accept":       r.Header.Get("Accept"),
		"from":         config.ID, // this sidecar
		"request":      request,   // this request
		"payload":      text(r.Body)})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to send message: %v", err), http.StatusInternalServerError)
		requests.Delete(request)
		return
	}

	select {
	case msg := <-ch:
		w.Header().Add("Content-Type", msg.contentType)
		w.WriteHeader(msg.statusCode)
		fmt.Fprint(w, msg.payload)
	case <-ctx.Done():
		http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
	}
	requests.Delete(request)
}

// callback sends the result of a call back to the caller
func callback(msg map[string]string, statusCode int, contentType string, payload string) {
	err := pubsub.Send(map[string]string{
		"protocol":     "sidecar",
		"to":           msg["from"],
		"command":      "callback",
		"request":      msg["request"],
		"statusCode":   strconv.Itoa(statusCode),
		"content-type": contentType,
		"payload":      payload})
	if err != nil {
		logger.Error("failed to answer request %s from service %s: %v", msg["request"], msg["from"], err)
	}
}

// post posts a message to the service
func post(msg map[string]string) (*http.Response, error) {
	req, err := http.NewRequest("POST", serviceURL+msg["path"], strings.NewReader(msg["payload"]))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", msg["content-type"])
	req.Header.Set("Accept", msg["accept"])
	var res *http.Response
	err = backoff.Retry(func() error {
		res, err = client.Do(req)
		return err
	}, backoff.WithContext(backoff.NewExponentialBackOff(), ctx)) // TODO adjust timeout
	return res, err
}

// dispatch handles one incoming message
func dispatch(msg map[string]string) {
	switch msg["command"] {
	case "send":
		res, err := post(msg)
		if err != nil {
			logger.Error("failed to post to %s%s: %v", serviceURL, msg["path"], err)
		} else {
			io.Copy(ioutil.Discard, res.Body)
			res.Body.Close()
		}

	case "call":
		res, err := post(msg)
		if err != nil {
			logger.Error("failed to post to %s%s: %v", serviceURL, msg["path"], err)
			callback(msg, http.StatusBadGateway, "text/plain", "Bad Gateway")
		} else {
			payload := text(res.Body)
			res.Body.Close()
			callback(msg, res.StatusCode, res.Header.Get("Content-Type"), payload)
		}

	case "callback":
		if ch, ok := requests.Load(msg["request"]); ok {
			statusCode, _ := strconv.Atoi(msg["statusCode"])
			select {
			case <-ctx.Done():
			case ch.(chan reply) <- reply{statusCode: statusCode, contentType: msg["content-type"], payload: msg["payload"]}:
			}
		} else {
			logger.Error("unexpected request in callback %s", msg["request"])
		}

	default:
		logger.Error("failed to process message with command %s", msg["command"])
	}
}

// subscriber handles incoming messages
func subscriber(channel <-chan pubsub.Message) {
	for msg := range channel {
		if !msg.Confirm() {
			continue
		}
		message := msg.Value
		if msg.Valid {
			dispatch(message)
		} else { // message reached wrong sidecar
			switch message["protocol"] {
			case "service": // route to service
				logger.Info("forwarding message to service %s%s%s", message["to"], config.Separator, message["session"])
			case "sidecar": // route to sidecar
				logger.Info("forwarding message to sidecar %s", message["to"])
			}
			if err := pubsub.Send(message); err != nil {
				switch message["protocol"] {
				case "service": // route to service
					logger.Error("failed to forward message to service %s%s%s: %v", message["to"], config.Separator, message["session"], err)
				case "sidecar": // route to sidecar
					logger.Debug("failed to forward message to sidecar %s: %v", message["to"], err) // not an error
				}
			}
		}
		msg.Mark()
	}
}

// set route handler
func set(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	if reply, err := store.Set("state"+config.Separator+ps.ByName("key"), text(r.Body)); err != nil {
		http.Error(w, fmt.Sprintf("failed to set key: %v", err), http.StatusInternalServerError)
	} else {
		fmt.Fprint(w, reply)
	}
}

// get route handler
func get(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	if reply, err := store.Get("state" + config.Separator + ps.ByName("key")); err == store.ErrNil {
		http.Error(w, "Not Found", http.StatusNotFound)
	} else if err != nil {
		http.Error(w, fmt.Sprintf("failed to get key: %v", err), http.StatusInternalServerError)
	} else {
		fmt.Fprint(w, reply)
	}
}

// del route handler
func del(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	if reply, err := store.Del("state" + config.Separator + ps.ByName("key")); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete key: %v", err), http.StatusInternalServerError)
	} else {
		fmt.Fprint(w, reply)
	}
}

// kill route handler
func kill(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	fmt.Fprint(w, "OK")
	cancel()
}

// server implements the HTTP server
func server(listener net.Listener) {
	router := httprouter.New()
	router.POST("/kar/send/:service/*path", send)
	router.POST("/kar/call/:service/*path", call)
	router.POST("/kar/session/:session/send/:service/*path", send)
	router.POST("/kar/session/:session/call/:service/*path", call)
	router.POST("/kar/set/:key", set)
	router.GET("/kar/get/:key", get)
	router.GET("/kar/del/:key", del)
	router.GET("/kar/kill", kill)
	srv := http.Server{Handler: router}

	go func() {
		if err := srv.Serve(listener); err != http.ErrServerClosed {
			logger.Fatal("HTTP server failed: %v", err)
		}
	}()

	<-ctx.Done() // wait

	if err := srv.Shutdown(context.Background()); err != nil {
		logger.Fatal("failed to shutdown HTTP server: %v", err)
	}
}

func main() {
	logger.Warning("starting...")

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-signals
		cancel()
	}()

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", config.RuntimePort))
	if err != nil {
		logger.Fatal("Listener failed: %v", err)
	}

	channel := pubsub.Dial(ctx)
	defer pubsub.Close()

	store.Dial()
	defer store.Close()

	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		defer wg.Done()
		subscriber(channel)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		server(listener)
	}()

	port1 := fmt.Sprintf("KAR_PORT=%d", listener.Addr().(*net.TCPAddr).Port)
	port2 := fmt.Sprintf("KAR_APP_PORT=%d", config.ServicePort)
	logger.Info("%s %s", port1, port2)

	args := flag.Args()

	if len(args) > 0 {
		launcher.Run(ctx, args, append(os.Environ(), port1, port2))
		cancel()
	}

	wg.Wait()

	logger.Warning("exiting...")
}
