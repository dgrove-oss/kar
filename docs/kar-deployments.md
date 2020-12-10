# Overview

This document describes the different deployment modes supported by
KAR, including:
   + [Clusterless](#clusterless)
   + [Kubernetes and OpenShift](#kubernetes-and-openshift)
   + [IBM Code Engine](#ibm-code-engine)
   + [Hybrid Cloud](#hybrid-cloud)

## KAR Runtime System Components

The KAR runtime system internally uses Redis as a persistent store and
Kafka as a reliable message transport (Kafka internally uses ZooKeeper
for distributed consensus). The Redis and Kafka instances must be reachable
by every `kar` runtime process in order for them to operate correctly and
form the application service mesh.

The Redis and Kafka instances can be provided in multiple ways, each
supporting different scenarios:
   + They can be run locally as Docker containers, supporting a local
     clusterless mode which is suitable for development.
   + They can be run as internally-accessible services/deployments on a
     Kubernetes or OpenShift cluster, supporting the deployment of
     KAR applications within that cluster.
   + They can be run as externally-accessible services/deployments on a
     Kubernetes or OpenShift cluster, supporting the deployment of
     KAR applications both inside and outside that cluster.
   + They can be provided as cloud managed services, supporting the
     deployment of KAR applications across multiple execution engines
     including Kubernetes and OpenShift clusters, IBM Code Engine,
     edge computing devices, and developer laptops.
Depending on the scenario, Redis and Kafka may use clustered
configurations to support high availability and increased scalability.

When deployed on a Kubernetes of OpenShift cluster, the KAR runtime
system also includes a mutating web hook that supports
injecting a "sidecar" container into Pods that are annotated as
containing KAR application components.  This significantly simplifies
the configuration of these components by automating the injection of
the credentials needed to connect to the Redis and Kafka instances
being used by KAR.

## Prerequisites

Throughout this document, we assume that all of the
[prerequisites](getting-started.md#prerequisites) outlined in the
getting started document have been met. We also assume that if you are
deploying to a Kubernetes cluster or using other public cloud managed
services in your deployment, that you have the necessary clis and
tools already installed and have some familiarity with using them.


# Clusterless

The Clusterless deployment mode runs Redis, Kafka, and ZooKeeper
as docker containers on your local machine. Your application components
and the KAR service mesh all run as local processes on your machine.

## Deployment

Deploy Redis, Kafka, and ZooKeeper using docker-compose by running:
```shell
./scripts/docker-composer.start.sh
```

After the script completes, configure your shell environment
to enable `kar` to access Redis and Kafka by doing
```shell
source ./scripts/kar-env-local.sh
```

## Run a Hello World Node.js Example

In one window:
```shell
source scripts/kar-env-local.sh
cd examples/service-hello-js
npm install --prod 
kar run -app hello-js -service greeter node server.js
```

In a second window:
```shell
source scripts/kar-env-local.sh
cd examples/service-hello-js
kar run -app hello-js node client.js
```

You should see output like shown below in both windows:
```
2020/04/02 17:41:23 [STDOUT] Hello John Doe!
2020/04/02 17:41:23 [STDOUT] Hello John Doe!
```
The client process will exit, while the server remains running. You
can send another request, or exit the server with a Control-C.

You can also use the `kar` cli to invoke the service directly:
```shell
kar rest -app hello-js post greeter helloJson '{"name": "Alan Turing"}'
```

## Undeploying

Undeploy the Redis, Kafka, and ZooKeeper containers using
docker-compose by running:
```shell
./scripts/docker-composer.stop.sh
```

# Kubernetes and OpenShift

This section covers the base deployment scenario where all the
components of the KAR application will be realized as Pods running
within a single cluster. In this scenario, Redis, Kafka, and ZooKeeper
are also deployed as Pods running within the cluster. For scenarios
including multiple clusters and/or applications that are split between a
cluster and edge devices (or developer laptops) see [Hybrid
Cloud](#hybrid-cloud) below.

For its in-cluster configurations, the KAR runtime system is deployed
in the `kar-system` namespace and includes a mutating webhook whose
job is to inject a "sidecar" container containing the `kar` executable
into every Pod that is annotated with `kar.ibm.com/app`. This
machinery enables existing Helm charts and Kubernetes YAML to be
adapted for KAR with minimal changes.  The mutating webhook process
the following annotations:
   + kar.ibm.com/app - sets the `-app` argument of `kar run`
   + kar.ibm.com/actors: sets the `-actors` argument of `kar run`
   + kar.ibm.com/service: sets the `-service` argument of `kar run`
   + kar.ibm.com/verbose: sets the `-verbose` argument of `kar run`
   + kar.ibm.com/appPort: sets the `-app_port` argument of `kar run`
   + kar.ibm.com/runtimePort: sets the `-runtime_port` argument of `kar run`
   + kar.ibm.com/extraArgs: additional command line arguments for `kar run`

Your cluster must be configured with the appropriate image pull
secrets for both your application images and the KAR runtime
images. We discuss some common options in the text below, but cannot
cover all possibilities. We also assume that you know how to configure
`kubectl`, `helm`, etc. to access your cluster.

Once the KAR runtime system is deployed to the `kar-system` namespace,
you must enable one or more other namespaces for KAR
applications. This enablement entails labeling the namespace with
`kar.ibm.com/enabled=true` and creating the `kar.ibm.com.image-pull`
and `kar.ibm.com.runtime-config` in the namespace.  These steps are
automated by
[kar-k8s-namespace-enable.sh](../scripts/kar-k8s-namespace-enable.sh).

Once a namespace is thus enabled, you can deploy KAR application components to the
namespace using Helm or kubectl by adding the annotations described above.

**NOTE: We strongly recommend against enabling the `kar-system` namespace
  or any Kubernetes system namespace for KAR applications. Enabling
  KAR sidecar injection for these namespaces can cause instability.**

## Deploying on an IBM Cloud Kubernetes or OpenShift cluster

You will need a cluster on which you have the cluster-admin role.

When deploying on an IBM Cloud managed cluster, you will use pre-built
images from the KAR project namespace in the IBM Cloud Container
Registry.

### Deploying the KAR Runtime System to the `kar-system` namespace

Assuming you have set your kubectl context and have done an
`ibmcloud login` into the RIS IBM Research Shared account, you
can deploy KAR into your cluster in a single command:
```shell
./scripts/kar-k8s-deploy.sh
```

### Enable a namespace to run KAR-based applications.

```shell
./scripts/kar-k8s-namespace-enable.sh default
```

### Run a containerized example

Run the client and server as shown below:
```shell
$ cd examples/service-hello-js
$ kubectl apply -f deploy/server-icr.yaml
pod/hello-server created
$ kubectl get pods
NAME           READY   STATUS    RESTARTS   AGE
hello-server   2/2     Running   0          3s
$ kubectl apply -f deploy/client-icr.yaml
job.batch/hello-client created
$ kubectl logs jobs/hello-client -c client
Hello John Doe!
Hello John Doe!
$ kubectl logs hello-server -c server
Hello John Doe!
Hello John Doe!
$ kubectl delete -f deploy/client-icr.yaml
job.batch "hello-client" deleted
$ kubectl delete -f deploy/server-icr.yaml
pod "hello-server" deleted
```

### Undeploying

You can disable a namespace for KAR applications by running
```shell
./scripts/kar-k8s-namespace-disable.sh default
```

You can undeploy the KAR runtime system with
```shell
./scripts/kar-k8s-undeploy.sh
```

## Deploying locally using `kind`

We can use [kind](https://kind.sigs.k8s.io/) to create a
virtual Kubernetes cluster using Docker on your development machine.
Using kind is only supported in KAR's "dev" mode where you will be
building your own docker images of the KAR system components and
pushing them into a local docker registry that we configure when
deploying kind.

You will need `kind` 0.9.0 installed locally.

### Create your `kind` cluster and docker registry

```shell
./scripts/kind-start.sh
```

### Deploying the KAR Runtime System to the `kar-system` namespace

First, build the necessary docker images and push them to a local
registry that is accessible to kind with:
```shell
make dockerDev
```
Next, deploy KAR in dev mode by doing:
```shell
./scripts/kar-k8s-deploy.sh -dev
```

### Enable a namespace to run KAR-based applications.

The simplest approach is to KAR-enable the default namespace:
```shell
./scripts/kar-k8s-namespace-enable.sh default
```

#### Run a containerized example

Run the client and server as shown below:
```shell
$ cd examples/service-hello-js
$ kubectl apply -f deploy/server-dev.yaml
pod/hello-server created
$ kubectl get pods
NAME           READY   STATUS    RESTARTS   AGE
hello-server   2/2     Running   0          3s
$ kubectl apply -f deploy/client-dev.yaml
job.batch/hello-client created
$ kubectl logs jobs/hello-client -c client
Hello John Doe!
Hello John Doe!
$ kubectl logs hello-server -c server
Hello John Doe!
Hello John Doe!
$ kubectl delete -f deploy/client-dev.yaml
job.batch "hello-client" deleted
$ kubectl delete -f deploy/server-dev.yaml
pod "hello-server" deleted
```

### Undeploying

You can disable a namespace for KAR applications by running
```shell
./scripts/kar-k8s-namespace-disable.sh default
```

You can undeploy the KAR runtime system with
```shell
./scripts/kar-k8s-undeploy.sh
```

You can remove the entire `kind` cluster with `kind cluster delete`.


# IBM Code Engine

IBM Code Engine is a multi-tenant Knative service provided by the IBM
Public Cloud. We can use IBM Code Engine as the compute engine for KAR
applications by deploying components as Code Engine applications (aka
Knative services).

We will not deploy Redis and Kafka on Code Engine; instead we will
provision instances of Database for Redis and EventStreams in the same
IBM Public Cloud region as the Code Engine service we are using to run
the application components. We will configure the Code Engine project
to enable the `kar` runtime processes to connect to these instances.

To simplify the flow of deploying on Code Engine, KAR application containers
intended for Code Engine deployment need to contain both the
application itself and the `kar` cli. We configure these containers to
execute in "sidecar in container" mode. If you are using a container
derived from the KAR Java or JavaScript SDK base images, this can be
done simply by setting the `KAR_SIDECAR_IN_CONTAINER` environment
variable.

There is currently no integration between Code Engine's autoscaling
capabilities and the Kafka topics that indicate the actual application
load. Therefore we currently bypass Code Engine's autoscaler and
deploy with a fixed number of containers for each application
component.

## Deployment

### Managed Services

Use the IBM Cloud Console to create resources.  Please consult the
documentation for each managed service if you need detailed
instructions.

You will need a Standard EventStreams instance.  Once it is allocated,
create a service credential to access it.

You will need a Database for Redis instance.  Once it is allocated,
create a service credential to access it, using the same name as you
used for the EventStreams service credential.

### IBM Cloud Container Registry Access

You will need an IBM Cloud Container Registry namespace and an apikey
that enables read access to that namespace.

### Code Engine Project

Create a Code Engine project
```shell
ibmcloud ce project create --name kar-project
```

Then, configure the project for KAR by creating the
`kar.ibm.com.runtime-config` and `kar.ibm.com.image-pull`
secrets. This step is automated by a script that takes the
service credential name and container registry apikey as arguments and
uses the `ibmcloud` cli to extract information and create the secrets.
```shell
./scripts/kar-ce-project-enable.sh <service-credential> <cr-apikey>
```

### Optionally configure your local environment

Because we are using a Redis and Kafka instance that are accessible
both to containers running in IBM Code Engine and to you laptop, we
have the option of deploying applications with some components running
on the cloud in IBM Code Engine and others running locally. To enable
this option, you need to setup your local environment so that `kar`
can connect to your public cloud Redis and EventStreams instances.
Do this by running
```shell
source scripts/kar-env-ibmcloud.sh <service-credential>
```

## Run a Hello World Node.js Example

Although deploying a KAR application component to Code Engine can can
be done directly with the `ibmcloud ce` cli, it requires a fairly
extensive set of command line arguments.  The script `kar-ce-run.sh`
wraps `ibmcloud ce` to simplify the process. It automatically targets
the current Code Engine project (change the targeted project with
`ibmcloud ce project target <project-name>`).
```shell
./scripts/kar-ce-run.sh -app hello -image us.icr.io/research/kar-dev/examples/js/service-hello -name hello-js-server -service greeter
```

Once the server component is deployed, you can use the `kar` cli to
invoke the service directly:
```shell
kar rest -app hello-js post greeter helloJson '{"name": "Alan Turing"}'
```

You've just run your first hybrid cloud application that uses KAR to
connect components running on your laptop (an "edge device") and the
IBM Public Cloud into a unified application mesh!

## Undeploying

You can undeploy an application component with
```shell
ibmcloud ce application delete --name hello-js-server
```

You can disable a Code Engine project for KAR applications with
```shell
./scripts/kar-k8s-namespace-disable.sh default
```
or delete it entirely with
```shell
ibmcloud ce project delete --name kar-project
```

# Hybrid Cloud

The key to a Hybrid Cloud deployment of KAR is to provision a Redis
and Kafka instance that are accessible to all of the compute elements
you want to utilize.  This can include Kubernetes clusters, edge
devices, virtual machines, development laptops, and managed compute
services such as Code Engine.

In general, you need to first provision the Redis and Kafka instances
and then in each computing environment create the configuration
information that enables `kar` to access them.  In Kubernetes and
OpenShift clusters and in IBM Code Engine, this means creating the
`kar.ibm.com.runtime-config` secret. For local environments or VMs
this means setting a collection of `KAFKA_` and `REDIS_` environment
variables.

## Using the IBM Public Cloud

### Provision Managed Services

Use the IBM Cloud Console to create resources.  Please consult the
documentation for each managed service if you need detailed
instructions.

You will need a Standard EventStreams instance.  Once it is allocated,
create a service credential to access it.

You will need a Database for Redis instance.  Once it is allocated,
create a service credential to access it, using the same name as you
used for the EventStreams service credential.

### IBM Cloud Container Registry Access

You will need an IBM Cloud Container Registry namespace and an apikey
that enables read access to that namespace.

### Configuring compute engines

#### Kubernetes or OpenShift clusters

Install the KAR runtime system on your IKS cluster
```shell
./scripts/kar-k8s-deploy.sh -m <service-credential> -c <cr-apikey>
```

Enable a namespace for KAR applications
```shell
./scripts/kar-k8s-namespace-enable.sh default
```

#### Code Engine

Enable a project for KAR applications
```shell
./scripts/kar-ce-project-enable.sh <service-credential> <cr-apikey>
```

#### Local environment or VMs
Set the necessary `KAFKA_` and `REDIS_` environment variables with
```shell
source scripts/kar-env-ibmcloud.sh <service-credential>
```

### Deploying Applications

Deploy each application component to the desired compute engine using
the scripts/tooling appropriate for that engine as described elsewhere
in this document.