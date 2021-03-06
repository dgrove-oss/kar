<!--
# Copyright IBM Corporation 2020,2021
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
-->

# Java KAR SDK Usage

# Prerequisites
- Java 11
- Maven 3.6+

Note1: the SDK and example code have been tested using MicroProfile 3.3 and the Open Liberty Plugin 3.2 (which pulls v20.0.0.X of openliberty). You should not use v20.0.0.11 because of a known bug in the Microprofile Rest Client.

# Overview
The Java SDK provides:
1. `kar-rest-client` - contains basic classes to communicate with KAR and implement the actor abstractions
2. `kar-actor-runtime` - classes that implement the KAR actor runtime in Java

# Building

## Open Liberty
To build these packages to run on Open Liberty, run `mvn install`.  This will build both `kar-rest-client` and `kar-actor-runtime`.  \

# Basic KAR SDK usage
The basic KAR SDK is in `kar-rest-client`. After building, add `target/kar-rest-client.jar` and `target/libs` to the CLASSPATH of your application. Note: `target/libs` contains dependent jars required by `target/kar-rest-client.jar`, which is implemented using the [Microprofile 3.3 Rest Client](https://github.com/eclipse/microprofile-rest-client).

The following code examples show how to use the Kar SDK.

## Invoke a Service:
```java
import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonValue;

import static com.ibm.research.kar.Kar.*;

public static void main(String[] args) {
    JsonObject params = Json.createObjectBuilder()
				.add("number",42)
				.build();

    // call service
    JsonValue value = call("MyService", "increment", params);
}
```

## Call an Actor Method:
```java
import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonValue;

import static com.ibm.research.kar.Kar.*;

public static void main(String[] args) {

    JsonObject params = Json.createObjectBuilder()
				.add("number",42)
				.build();

    // call service
    JsonValue value = actorCall("ActorType", "ActorID", "remoteMethodName", params);
}
```

## Invoke a service asynchronously 
```java
import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonValue;

import static com.ibm.research.kar.Kar.*;

public static void main(String[] args) {

    JsonObject params = Json.createObjectBuilder()
				.add("number",42)
				.build();

    // call service asynchronously
   CompletionStage<JsonValue> cf = callAsync("MyService", "increment", params);

   JsonValue value = cf
                    .toCompletableFuture()
                    .get();
}
```

## Call an Actor Method asynchronously
```java
import javax.json.Json;
import javax.json.JsonObject;
import javax.json.JsonValue;

import static com.ibm.research.kar.Kar.*;

public static void main(String[] args) {

    JsonObject params = Json.createObjectBuilder()
				.add("number",42)
				.build();
    // call actor asnchronously
    CompletionStage<JsonValue> cf = actorCallAsync("ActorType", "ActorID", "remoteMethodName", params);
    
    JsonValue value = cf
                    .toCompletableFuture()
                    .get();
}
```

# KAR actor runtime
The KAR actor runtime in `kar-actor-runtime` allows you to:
- Create an actor using an annotated POJO class
- Execute actors as part of your microservice

KAR requires all Actor classes to implement the ActorInstance interface. 
## Actor Instance
```java
public interface ActorInstance extends ActorRef {

  // Allow KAR to get and set session ids   
  public String getSession();
  public void setSession(String session);

  // set actor ID and Type
  public void setType(String type);
  public void setId(String id);
}
```
The ActorInstance includes two methods to manage session IDs, which KAR uses for actor communications as part of the [KAR programming model](../docs/KAR.md).

## Actor Annotations

Actor annotations example:
```java
package com.ibm.research.kar.example.actors;

import javax.json.Json;
import javax.json.JsonObject;
import javax.ws.rs.core.Response;

import com.ibm.research.kar.actor.KarSessionListener;
import com.ibm.research.kar.actor.annotations.Activate;
import com.ibm.research.kar.actor.annotations.Actor;
import com.ibm.research.kar.actor.annotations.Deactivate;
import com.ibm.research.kar.actor.annotations.Remote;

@Actor
public class MyActor implements ActorInstance {

    @Activate // optional actor constructor
    public void init() {
        // init code
    }	
    
    // Expose this method to the actor runtime.
    // KAR synchronizes requests to the actor by default
    @Remote
    public void updateMyState(JsonObject json) {
        // remote code
    }

    
    // Expose this method to the actor runtime.
    // KAR synchronizes requests to the actor by default
    @Remote 
    public String readMyState() {
        // read-only code
    }
	
    // methods not annotated as @Remote are 
    // not callable by actor runtime
    public void cannotBeInvoked() {
    }

    @Deactivate // optional actor de-constructor
    public void kill() {
    }

    //.... ActorInstance implementation would be below
    //.....
}
```

## Building a microservice with `kar-actor-runtime`
We have tested the Java actor runtime using openliberty. `kar-actor-runtime` will automatically bundle `kar-rest-client` and is packaged as a jar.  Include this as a dependency when you create your microserivce. Note that `kar-actor-runtime` will not execute on its own.  At a minimum, implement a class that extends `javax.ws.rs.core.Application`. 

 Using Maven, an example `pom.xml` to include `kar-actor-runtime` module into a microservice called `kar-actor-example` is:
 ```xml
<?xml version='1.0' encoding='utf-8'?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
    http://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>com.ibm.research.kar.example.actors</groupId>
    <artifactId>kar-example-actors</artifactId>
    <version>0.5.1</version>
    <packaging>pom</packaging>

    <modules>
        <!-- Your application -->
        <module>kar-actor-example</module>
    </modules>
</project>
```
The corresponding`pom.xml` in `kar-actor-example` should include the following dependency:
```xml
<!-- KAR SDK -->
<dependency>
	<groupId>com.ibm.research.kar</groupId>
	<artifactId>kar-actor-runtime</artifactId>
	<version>0.5.1</version>
</dependency>
```
`kar-actor-runtime` requires the following features as part of the runtime. The featureManager section of the `server.xml` for `openliberty` should look like:
```xml
<featureManager>
		<feature>jaxrs-2.1</feature>
		<feature>jsonb-1.0</feature>
		<feature>mpHealth-2.1</feature>
		<feature>mpConfig-1.3</feature>
		<feature>mpRestClient-1.3</feature>
		<feature>beanValidation-2.0</feature>
		<feature>cdi-2.0</feature>
		<feature>concurrent-1.0</feature>
		<feature>mpOpenTracing-1.3</feature>
	</featureManager>
```
`kar-actor-runtime` loads actors at deploy time. Actor classfiles should be added to your CLASSPATH.  Declare your actors to `kar-actor-runtime` as context parameters in `web.xml`.  For example, if you have KAR actor types `Dog` and `Cat` which are implemented by `com.example.Actor1` and `com.example.Actor2`, respectively, your `web.xml` would have:
```xml
<context-param>
    <param-name>kar-actor-classes</param-name>
    <param-value>com.example.Actor1, com.example.Actor2</param-value>
</context-param>
<context-param>
    <param-name>kar-actor-types</param-name>
    <param-value>Dog, Cat</param-value>
</context-param>
```

# Quarkus Support
We are experimenting with the KAR Java SDK for Quarkus.  This is an early preview and has the following limitations:

- No support for native compilation.  The Quarkus native-image does not support Java `MethodHandle`, which we use for reflection in the actor runtime.
- No support for `quarkus:dev`.  We have undiagnosed classpath errors when running under this mode.  To run a quarkus application that uses KAR, directly execute the runnable jar target, e.g. `kar -app myApp java -jar target/my-runnable-jar`

## Building
If you've previously built the KAR Java SDK for Open Liberty, it is highly recommended that you delete your local maven repository.  Then, to build the KAR SDK using Quarkus extensions, in the `sdk-java` directory execute `mvn -P quarkus install`. 

## Usage
The Quarkus version of the SDK is the same, except you should not declare an `@ApplicationPath` in your JAX-RS application class since this is already used by the actor runtime.  Quarkus does not allow multiple declarations of `@ApplicationPath` (it also does not require a JAX-RS application class).