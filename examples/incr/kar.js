const fetch = require('node-fetch')
const parser = require('body-parser')
const morgan = require('morgan')

const url = `http://localhost:${process.env.KAR_PORT || 8080}/kar/`

// http post, json stringify request body, json parse response body
const post = (api, body) => fetch(url + api, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }).then(parse)

const parse = res => res.text().then(text => {
  if (res.ok) return text.length > 0 ? JSON.parse(text) : undefined
  throw new Error(text)
})

// invoke method on a service
const async = (service, path, params) => post(`post/${service}/${path}`, params)
const sync = (service, path, params) => post(`call/${service}/${path}`, params)

const truthy = s => s && s.toLowerCase() !== 'false' && s !== '0'

// express middleware to log requests
const logger = truthy(process.env.KAR_VERBOSE) ? [morgan('--> :date[iso] :method :url', { immediate: true }), morgan('<-- :date[iso] :method :url :status - :response-time ms')] : []

// express middleware to parse request body to json (non-strict, map empty body to undefined)
const preprocessor = [
  parser.text({ type: '*/*' }),
  (req, _res, next) => {
    if (req.body.length > 0) {
      try {
        req.body = JSON.parse(req.body)
        next()
      } catch (err) {
        next(err)
      }
    } else {
      req.body = undefined
      next()
    }
  }]

// express middleware to handle errors
const postprocessor = [
  (err, req, res, next) => Promise.resolve()
    .then(_ => {
      err.stack += `\n    at <kar> ${req.originalUrl}` // add current route to stack trace
      const body = {} // sanitize error object
      body.message = typeof err.message === 'string' ? err.message : typeof err === 'string' ? err : 'Internal Server Error'
      body.stack = typeof err.stack === 'string' ? err.stack : new Error(body.message).stack
      if (typeof err.errorCode === 'string') body.errorCode = err.errorCode
      return res.status(500).json(body)
    })
    .catch(next)]

module.exports = { post, async, sync, logger, preprocessor, postprocessor }