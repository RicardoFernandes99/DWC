#!/usr/bin/env bash
# Sets up DWC on a fresh Ubuntu 24.04 VM: k3s (with Traefik and metrics-server
# for the HPA), Argo CD, generated secrets and the Argo CD Application that
# deploys deploy/k8s from GitHub. Safe to re-run: existing secrets are kept.
#
# Usage (on the VM, from a clone of the repository):
#   GITHUB_USER=<your-github-user> GITHUB_TOKEN=<read-only token> \
#     sudo -E bash deploy/azure/bootstrap.sh <public-ip>
#
# GITHUB_TOKEN needs read access to the private repository and its packages
# (a classic token with `repo` and `read:packages`, or a fine-grained token with
# Contents: read plus a classic token for packages). It is stored only as
# Kubernetes Secrets on this VM.
set -euo pipefail

PUBLIC_IP="${1:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Usage: sudo -E bash deploy/azure/bootstrap.sh <public-ip>" >&2
  exit 1
fi
if ! [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "The public IP must look like 20.1.2.3" >&2
  exit 1
fi
: "${GITHUB_USER:?Set GITHUB_USER to your GitHub user name}"
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN to a read-only GitHub token}"
if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo -E so k3s can be installed." >&2
  exit 1
fi

DOMAIN="${PUBLIC_IP}.nip.io"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CREDENTIALS_FILE=/root/dwc-credentials.txt
ARGOCD_VERSION="${ARGOCD_VERSION:-stable}"
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

step() { printf '\n==> %s\n' "$*"; }
random() { openssl rand -hex "$1"; }

step "Installing k3s"
if ! command -v k3s >/dev/null 2>&1; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL=stable sh -s - \
    --write-kubeconfig-mode 600 --tls-san "$PUBLIC_IP"
fi
until kubectl get nodes 2>/dev/null | grep -q ' Ready'; do sleep 3; done
kubectl get nodes

step "Installing Argo CD ($ARGOCD_VERSION)"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"
# Plain HTTP behind Traefik; the UI is reached through the Ingress below.
kubectl -n argocd patch configmap argocd-cmd-params-cm --type merge \
  -p '{"data":{"server.insecure":"true"}}'
kubectl -n argocd rollout restart deployment argocd-server
sed "s/__DOMAIN__/${DOMAIN}/g" "$REPO_DIR/deploy/argocd/ingress.yaml" | kubectl apply -f -

step "Creating the dwc namespace, configuration and secrets"
kubectl create namespace dwc --dry-run=client -o yaml | kubectl apply -f -

kubectl -n dwc create configmap dwc-config \
  --from-literal=API_PORT=3000 \
  --from-literal=API_HOST=0.0.0.0 \
  --from-literal=WEB_ORIGIN="http://dwc.${DOMAIN}" \
  --from-literal=BACKOFFICE_ORIGIN="http://admin.${DOMAIN}" \
  --from-literal=JWT_ISSUER=dwc-api \
  --from-literal=JWT_AUDIENCE=dwc-web \
  --from-literal=AUTH_COOKIE_SECURE=false \
  --from-literal=MONGODB_URI='mongodb://mongodb:27017/dwc?replicaSet=rs0&directConnection=true' \
  --from-literal=REDIS_URL=redis://redis:6379 \
  --from-literal=S3_ENDPOINT=http://storage:4566 \
  --from-literal=S3_PUBLIC_ENDPOINT="http://s3.${DOMAIN}" \
  --from-literal=S3_REGION=us-east-1 \
  --from-literal=S3_BUCKET=product-images \
  --from-literal=ADMIN_BOOTSTRAP_NAME=Administrator \
  --from-literal=ADMIN_BOOTSTRAP_EMAIL="admin@${DOMAIN}" \
  --dry-run=client -o yaml | kubectl apply -f -

if ! kubectl -n dwc get secret dwc-secrets >/dev/null 2>&1; then
  ADMIN_PASSWORD="$(random 12)"
  DEMO_PASSWORD="DwcDemo-$(random 12)"
  kubectl -n dwc create secret generic dwc-secrets \
    --from-literal=JWT_SECRET="$(random 48)" \
    --from-literal=S3_ACCESS_KEY_ID="dwc$(random 8)" \
    --from-literal=S3_SECRET_ACCESS_KEY="$(random 32)" \
    --from-literal=ADMIN_BOOTSTRAP_PASSWORD="$ADMIN_PASSWORD" \
    --from-literal=FIXTURE_PASSWORD="$DEMO_PASSWORD" \
    --from-literal=BACKOFFICE_APP_KEY="base64:$(openssl rand -base64 32)"
  umask 077
  cat >"$CREDENTIALS_FILE" <<EOF
DWC credentials generated $(date -u +%FT%TZ)
Admin (backoffice): admin@${DOMAIN} / ${ADMIN_PASSWORD}
Demo accounts (all seeded users): ${DEMO_PASSWORD}
EOF
  echo "Generated new secrets; credentials saved to $CREDENTIALS_FILE"
else
  echo "Keeping the existing dwc-secrets Secret."
fi

kubectl -n dwc create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username="$GITHUB_USER" \
  --docker-password="$GITHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

step "Giving Argo CD read access to the private repository"
kubectl -n argocd create secret generic dwc-repo \
  --from-literal=type=git \
  --from-literal=url=https://github.com/RicardoFernandes99/DWC.git \
  --from-literal=username="$GITHUB_USER" \
  --from-literal=password="$GITHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n argocd label secret dwc-repo argocd.argoproj.io/secret-type=repository --overwrite

step "Creating the Argo CD Application"
kubectl -n argocd wait --for=condition=Established crd/applications.argoproj.io --timeout=120s
sed "s/__DOMAIN__/${DOMAIN}/g" "$REPO_DIR/deploy/argocd/application.yaml" | kubectl apply -f -

step "Waiting for Argo CD"
kubectl -n argocd rollout status deployment argocd-server --timeout=300s
ARGOCD_PASSWORD="$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' 2>/dev/null | base64 -d || true)"

cat <<EOF

DWC is deploying. Argo CD pulls the manifests from GitHub and syncs them;
the first sync builds nothing locally but pulls images, so allow a few minutes.

  Shop:        http://dwc.${DOMAIN}
  Backoffice:  http://admin.${DOMAIN}
  Argo CD:     http://argocd.${DOMAIN}   (user: admin, password: ${ARGOCD_PASSWORD:-see argocd-initial-admin-secret})

App and demo passwords: sudo cat ${CREDENTIALS_FILE}
Watch the rollout:      sudo kubectl -n dwc get pods,hpa -w
EOF
