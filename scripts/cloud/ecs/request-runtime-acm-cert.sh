#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  request-runtime-acm-cert.sh \
    --domain-suffix runtime-staging.bustly.ai \
    [--aws-profile bustly-staging] \
    [--region ap-southeast-1] \
    [--idempotency-token token123]

Example:
  AWS_PROFILE=bustly-staging scripts/cloud/ecs/request-runtime-acm-cert.sh \
    --domain-suffix runtime-staging.bustly.ai
USAGE
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 1
  fi
}

DOMAIN_SUFFIX=""
AWS_PROFILE_NAME="${AWS_PROFILE:-bustly-staging}"
AWS_REGION="ap-southeast-1"
IDEMPOTENCY_TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain-suffix)
      DOMAIN_SUFFIX="${2:-}"
      shift 2
      ;;
    --aws-profile)
      AWS_PROFILE_NAME="${2:-}"
      shift 2
      ;;
    --region)
      AWS_REGION="${2:-}"
      shift 2
      ;;
    --idempotency-token)
      IDEMPOTENCY_TOKEN="${2:-}"
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

if [[ -z "$DOMAIN_SUFFIX" ]]; then
  usage
  exit 1
fi

DOMAIN_SUFFIX="$(echo "$DOMAIN_SUFFIX" | tr '[:upper:]' '[:lower:]' | sed 's/^[.]*//;s/[.]*$//')"
if [[ -z "$DOMAIN_SUFFIX" ]]; then
  echo "invalid --domain-suffix" >&2
  exit 1
fi

require_cmd aws
require_cmd python3
require_cmd shasum

if [[ -z "$IDEMPOTENCY_TOKEN" ]]; then
  IDEMPOTENCY_TOKEN="$(printf '%s' "$DOMAIN_SUFFIX" | shasum -a 256 | awk '{print $1}' | cut -c1-24)"
fi

export AWS_PROFILE="$AWS_PROFILE_NAME"

WILDCARD_DOMAIN="*.${DOMAIN_SUFFIX}"
ROOT_DOMAIN="${DOMAIN_SUFFIX}"

CERT_ARN="$(aws acm request-certificate \
  --region "$AWS_REGION" \
  --domain-name "$WILDCARD_DOMAIN" \
  --subject-alternative-names "$ROOT_DOMAIN" \
  --validation-method DNS \
  --idempotency-token "$IDEMPOTENCY_TOKEN" \
  --options CertificateTransparencyLoggingPreference=ENABLED \
  --query CertificateArn \
  --output text)"

DESCRIBE_JSON="$(aws acm describe-certificate \
  --region "$AWS_REGION" \
  --certificate-arn "$CERT_ARN" \
  --output json)"

for _ in $(seq 1 15); do
  HAS_RECORD="$(
    python3 - <<'PY' "$DESCRIBE_JSON"
import json
import sys
payload = json.loads(sys.argv[1]).get("Certificate", {})
ok = False
for item in payload.get("DomainValidationOptions", []):
    rr = item.get("ResourceRecord") or {}
    if (rr.get("Name") or "").strip() and (rr.get("Value") or "").strip():
        ok = True
        break
print("yes" if ok else "no")
PY
  )"
  if [[ "$HAS_RECORD" == "yes" ]]; then
    break
  fi
  sleep 2
  DESCRIBE_JSON="$(aws acm describe-certificate \
    --region "$AWS_REGION" \
    --certificate-arn "$CERT_ARN" \
    --output json)"
done

echo "acm certificate requested"
echo "  region: ${AWS_REGION}"
echo "  cert_arn: ${CERT_ARN}"
echo
echo "cloudflare dns validation records (set to DNS only / gray cloud):"
python3 - <<'PY' "$DESCRIBE_JSON"
import json
import sys

payload = json.loads(sys.argv[1]).get("Certificate", {})
print(f"  status: {payload.get('Status', 'UNKNOWN')}")
print("")
seen = set()
for item in payload.get("DomainValidationOptions", []):
    rr = item.get("ResourceRecord") or {}
    name = (rr.get("Name") or "").rstrip(".")
    value = (rr.get("Value") or "").rstrip(".")
    rtype = rr.get("Type") or "CNAME"
    if not name or not value:
        continue
    key = (name, value, rtype)
    if key in seen:
        continue
    seen.add(key)
    print(f"- type: {rtype}")
    print(f"  name: {name}")
    print(f"  value: {value}")
print("")
PY

echo "next:"
echo "  1) add the CNAME validation record(s) in Cloudflare"
echo "  2) wait until cert status becomes ISSUED"
echo "  3) put cert ARN into infra/terraform/ecs-fargate/terraform.tfvars (acm_certificate_arn)"
