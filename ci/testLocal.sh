#!/bin/bash

#
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
#

set -meu

# run background_services_gpid test_command
run () {
    PID=$1
    shift
    CODE=0
    "$@" || CODE=$?
    kill -- -$PID || true
    sleep 1
    return $CODE
}

SCRIPTDIR=$(cd $(dirname "$0") && pwd)
ROOTDIR="$SCRIPTDIR/.."

. $ROOTDIR/scripts/kar-env-local.sh

# Run unit-tests/test-harness.js locally
echo "*** Testing examples/unit-tests ***"

cd $ROOTDIR/examples/unit-tests
npm install --prod

kar run -app myApp -service myService -actors Foo node server.js &
run $! kar run -app myApp node test-harness.js

# Run actors-dp-java/tester.js locally
echo "*** Testing examples/actors-dp-js ***"

cd $ROOTDIR/examples/actors-dp-js
npm install --prod

kar run -app dp -actors Cafe,Table,Fork,Philosopher node philosophers.js &
run $! kar run -app dp node tester.js

# Run actors-ykt locally
echo "*** Testing examples/actors-ykt ***"

cd $ROOTDIR/examples/actors-ykt
npm install --prod

./deploy/runServerLocally.sh &
run $! ./deploy/runClientLocally.sh
