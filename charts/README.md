Helm Chart to deploy a dev-mode KAR runtime services onto a cluster.

### Deploying the KAR runtime

Execute the command: `helm install kar kar`

Components deployed:
1. non-HA Redis cluster
2. non-HA Kafka cluster
3. Kafka console pod (to enable debug via kafka's cli tools).

### Deploying the incr example

`helm install incr incr`

### Debugging Kafka via the kar-kafka-console

1. Connect to the pod: `kubectl exec -it kar-kafka-console-6b984657f-nr48z /bin/bash`

2. Within the pod, you have access to the full set of kakfa cli tools (in `/opt/kafka/bin`).
The environment variables `KAFKA_BOOTSTRAP_SERVER` and `KAFKA_BROKER` are available to
help you connect to the KAR runtime's instance of kafka.  For example,
```
bash-4.4# kafka-topics.sh --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --create --topic myTest --partitions 3 --replication-factor 1 
bash-4.4# kafka-topics.sh --bootstrap-server $KAFKA_BOOTSTRAP_SERVER --list 
myTest
bash-4.4#
```