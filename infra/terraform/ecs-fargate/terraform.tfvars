aws_region   = "ap-southeast-1"
project_name = "openclaw"
environment  = "staging"

# Test env ACM cert (runtime-staging.bustly.ai wildcard)
acm_certificate_arn = "arn:aws:acm:ap-southeast-1:916873233694:certificate/fe106198-ff3e-43ce-99f1-85bf2313af61"

# Optional: tighten source CIDR in production
allowed_ingress_cidrs = ["0.0.0.0/0"]

tags = {
  Owner = "bustly"
}
