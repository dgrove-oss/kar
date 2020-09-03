###############################################
# Requires `kar-actor-example` to be running
###############################################
#!/bin/sh

SCRIPTDIR=$(cd $(dirname "$0") && pwd)
TARGETDIR=$SCRIPTDIR/../target
CLASSPATH=$TARGETDIR/kar-rest-client.jar:$TARGETDIR/libs/*

kar -runtime_port 32123 -app example java -cp $CLASSPATH test.RunService