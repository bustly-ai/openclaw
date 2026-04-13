locals {
  active_listener_arn = var.acm_certificate_arn != "" ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  ws_scheme           = var.acm_certificate_arn != "" ? "wss" : "ws"
}

output "aws_region" {
  value = var.aws_region
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = [for subnet in aws_subnet.public : subnet.id]
}

output "public_subnet_ids_csv" {
  value = join(",", [for subnet in aws_subnet.public : subnet.id])
}

output "alb_dns_name" {
  value = aws_lb.runtime.dns_name
}

output "alb_arn" {
  value = aws_lb.runtime.arn
}

output "alb_listener_http_arn" {
  value = aws_lb_listener.http.arn
}

output "alb_listener_https_arn" {
  value = var.acm_certificate_arn != "" ? aws_lb_listener.https[0].arn : ""
}

output "alb_listener_arn_for_rules" {
  value = local.active_listener_arn
}

output "ws_scheme" {
  value = local.ws_scheme
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.runtime.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.runtime.arn
}

output "runtime_security_group_id" {
  value = aws_security_group.runtime.id
}

output "efs_file_system_id" {
  value = aws_efs_file_system.runtime.id
}

output "ecs_task_execution_role_arn" {
  value = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "cloudwatch_log_group_name" {
  value = aws_cloudwatch_log_group.runtime.name
}

output "workspace_runtime_table_name" {
  value = aws_dynamodb_table.workspace_runtime_mapping.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.runtime.repository_url
}

output "container_port" {
  value = var.container_port
}
