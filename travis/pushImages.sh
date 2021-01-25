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

set -eu

SCRIPTDIR=$(cd $(dirname "$0") && pwd)
ROOTDIR="$SCRIPTDIR/.."

BRANCH=$1
IMAGE_TAG=$2
cd $ROOTDIR

docker login -u "${QUAY_USERNAME}" -p "${QUAY_PASSWORD}" quay.io

if [ ${BRANCH} == "main" ] && [ ${IMAGE_TAG} == "latest" ]; then
    # push `latest` tag images
    KAR_VERSION=$(git rev-parse --short HEAD) DOCKER_REGISTRY=quay.io DOCKER_NAMESPACE=ibm DOCKER_IMAGE_TAG=latest make docker
fi
