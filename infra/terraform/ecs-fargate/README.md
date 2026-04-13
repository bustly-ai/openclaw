# OpenClaw ECS/Fargate Shared Infra

This Terraform stack creates the shared base for "one workspace = one runtime service":

- VPC + 2 public subnets
- ALB (HTTP, optional HTTPS if ACM cert is provided)
- ECS cluster (Fargate)
- EFS (for runtime state)
- CloudWatch log group
- DynamoDB mapping table (`workspace_id` -> runtime resources)
- ECR repo for OpenClaw runtime image

## Prerequisites

- Terraform >= 1.6
- AWS CLI configured (`AWS_PROFILE=bustly-staging`)
- Region: `ap-southeast-1`

## Quick start

```bash
cd infra/terraform/ecs-fargate
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Outputs used by scripts

The ECS workspace runtime scripts read these outputs:

- `ecs_cluster_name`
- `public_subnet_ids_csv`
- `runtime_security_group_id`
- `efs_file_system_id`
- `ecs_task_execution_role_arn`
- `ecs_task_role_arn`
- `cloudwatch_log_group_name`
- `workspace_runtime_table_name`
- `alb_listener_arn_for_rules`
- `alb_dns_name`
- `ws_scheme`

## Next step

After shared infra is up, run:

- `scripts/cloud/ecs/provision-workspace-runtime.sh`
- `scripts/cloud/ecs/destroy-workspace-runtime.sh`

