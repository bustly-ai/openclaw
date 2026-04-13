variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "openclaw"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "vpc_cidr" {
  description = "CIDR for VPC"
  type        = string
  default     = "10.44.0.0/16"
}

variable "container_port" {
  description = "Gateway container port"
  type        = number
  default     = 17999
}

variable "allowed_ingress_cidrs" {
  description = "CIDRs allowed to reach ALB listener"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "acm_certificate_arn" {
  description = "Optional ACM cert ARN for HTTPS listener"
  type        = string
  default     = ""
}

variable "alb_internal" {
  description = "Whether ALB is internal"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
