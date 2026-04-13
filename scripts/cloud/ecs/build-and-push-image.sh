#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  build-and-push-image.sh \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate] \
    [--image-tag <tag>] \
    [--platform linux/amd64] \
    [--install-browser 1]
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

AWS_PROFILE_NAME="${AWS_PROFILE:-bustly-staging}"
TF_DIR="infra/terraform/ecs-fargate"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
INSTALL_BROWSER="1"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/amd64}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --aws-profile)
      AWS_PROFILE_NAME="${2:-}"
      shift 2
      ;;
    --tf-dir)
      TF_DIR="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --install-browser)
      INSTALL_BROWSER="${2:-}"
      shift 2
      ;;
    --platform)
      IMAGE_PLATFORM="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd aws
require_cmd terraform
require_cmd docker

if [[ ! -d "$TF_DIR" ]]; then
  echo "terraform dir not found: $TF_DIR" >&2
  exit 1
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

AWS_REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
ECR_URL="$(terraform -chdir="$TF_DIR" output -raw ecr_repository_url)"
ECR_REGISTRY="${ECR_URL%%/*}"

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

if [[ "$INSTALL_BROWSER" == "1" ]]; then
  docker build \
    --platform "$IMAGE_PLATFORM" \
    --build-arg OPENCLAW_INSTALL_BROWSER=1 \
    -t "$ECR_URL:$IMAGE_TAG" .
else
  docker build --platform "$IMAGE_PLATFORM" -t "$ECR_URL:$IMAGE_TAG" .
fi

docker push "$ECR_URL:$IMAGE_TAG"

echo "image pushed"
echo "  image: $ECR_URL:$IMAGE_TAG"
echo "  platform: $IMAGE_PLATFORM"
