set -x

HELM_VERSION=v3.1.1
KIND_VERSION=v0.7.0
KUBECTL_VERSION=v1.16.7

# Download and install command line tools
pushd /tmp
  # kubectl
  curl -Lo ./kubectl https://storage.googleapis.com/kubernetes-release/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl
  chmod +x kubectl
  sudo cp kubectl /usr/local/bin/kubectl

  # kind
  curl -Lo ./kind https://github.com/kubernetes-sigs/kind/releases/download/$KIND_VERSION/kind-linux-amd64
  chmod +x kind
  sudo cp kind /usr/local/bin/kind

  # helm3
  curl https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get-helm-3 > get-helm-3.sh && chmod +x get-helm-3.sh && ./get-helm-3.sh --version $HELM_VERSION
popd