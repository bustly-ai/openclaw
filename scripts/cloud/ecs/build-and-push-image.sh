#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  build-and-push-image.sh \
    [--aws-profile bustly-staging] \
    [--tf-dir infra/terraform/ecs-fargate] \
    [--aws-region ap-southeast-1] \
    [--ecr-url 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/openclaw-staging-runtime] \
    [--control-plane-url http://127.0.0.1:3000] \
    [--control-plane-environment test] \
    [--requested-by-user-id fiona] \
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
AWS_REGION="${AWS_REGION:-}"
ECR_URL="${ECR_URL:-}"
CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-}"
CONTROL_PLANE_ENVIRONMENT="${CONTROL_PLANE_ENVIRONMENT:-}"
REQUESTED_BY_USER_ID="${REQUESTED_BY_USER_ID:-}"
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
    --aws-region)
      AWS_REGION="${2:-}"
      shift 2
      ;;
    --ecr-url)
      ECR_URL="${2:-}"
      shift 2
      ;;
    --control-plane-url)
      CONTROL_PLANE_URL="${2:-}"
      shift 2
      ;;
    --control-plane-environment)
      CONTROL_PLANE_ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --requested-by-user-id)
      REQUESTED_BY_USER_ID="${2:-}"
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
require_cmd docker
require_cmd git

export AWS_PROFILE="$AWS_PROFILE_NAME"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git submodule update --init --recursive bustly-skills >/dev/null
fi

if [[ ! -f "bustly-skills/skills/.bustly-default-enabled.json" ]]; then
  echo "missing bustly-skills/skills/.bustly-default-enabled.json; run 'git submodule update --init --recursive bustly-skills'" >&2
  exit 1
fi

if [[ ! -f "bustly-skills/scripts/bustly-ops.js" ]]; then
  echo "missing bustly-skills/scripts/bustly-ops.js; bustly runtime wrapper cannot be packaged" >&2
  exit 1
fi

if [[ -z "$AWS_REGION" || -z "$ECR_URL" ]]; then
  require_cmd terraform

  if [[ ! -d "$TF_DIR" ]]; then
    echo "terraform dir not found: $TF_DIR" >&2
    exit 1
  fi

  if [[ -z "$AWS_REGION" ]]; then
    AWS_REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
  fi

  if [[ -z "$ECR_URL" ]]; then
    ECR_URL="$(terraform -chdir="$TF_DIR" output -raw ecr_repository_url)"
  fi
fi

if [[ -z "$AWS_REGION" ]]; then
  echo "aws region is required; pass --aws-region or provide terraform outputs" >&2
  exit 1
fi

if [[ -z "$ECR_URL" ]]; then
  echo "ecr url is required; pass --ecr-url or provide terraform outputs" >&2
  exit 1
fi

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

if [[ -n "$CONTROL_PLANE_URL" || -n "$CONTROL_PLANE_ENVIRONMENT" || -n "$REQUESTED_BY_USER_ID" ]]; then
  require_cmd curl

  if [[ -z "$CONTROL_PLANE_URL" ]]; then
    echo "control plane url is required when registering image; pass --control-plane-url" >&2
    exit 1
  fi

  if [[ -z "$CONTROL_PLANE_ENVIRONMENT" ]]; then
    echo "control plane environment is required when registering image; pass --control-plane-environment" >&2
    exit 1
  fi

  if [[ -z "$REQUESTED_BY_USER_ID" ]]; then
    echo "requested by user id is required when registering image; pass --requested-by-user-id" >&2
    exit 1
  fi

  IMAGE_URI="$ECR_URL:$IMAGE_TAG"
  CONTROL_PLANE_URL="${CONTROL_PLANE_URL%/}"

  curl --fail --silent --show-error \
    -X PUT "${CONTROL_PLANE_URL}/internal/runtime-environments/${CONTROL_PLANE_ENVIRONMENT}/image" \
    -H "content-type: application/json" \
    -d "$(printf '{"requestedByUserId":"%s","imageUri":"%s"}' "$REQUESTED_BY_USER_ID" "$IMAGE_URI")" >/dev/null

  echo "control plane updated"
  echo "  environment: $CONTROL_PLANE_ENVIRONMENT"
  echo "  image: $IMAGE_URI"
fi

echo "image pushed"
echo "  image: $ECR_URL:$IMAGE_TAG"
echo "  platform: $IMAGE_PLATFORM"
