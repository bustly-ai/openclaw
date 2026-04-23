# ECS/Fargate 最小执行清单（你只需要做这些）

## 0. 当前已完成

- AWS 账号已可用（`AWS_PROFILE=bustly-staging aws sts get-caller-identity` 已通过）。
- Region 统一：`ap-southeast-1`（新加坡）。
- 模式：`每 workspace 一个 runtime service`。

## 1. 你要做的（一次性）

1. 安装 Terraform（>= 1.6）。
2. 在仓库里创建 tfvars：

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
cp infra/terraform/ecs-fargate/terraform.tfvars.example infra/terraform/ecs-fargate/terraform.tfvars
```

3. 按需编辑 `infra/terraform/ecs-fargate/terraform.tfvars`：
- 现在没域名/证书：先不填 `acm_certificate_arn`。
- 有证书后再补，自动切 `wss`。

## 2. 我已经给你写好的脚本

- `scripts/cloud/ecs/bootstrap-shared-infra.sh`
- `scripts/cloud/ecs/build-and-push-image.sh`
- `scripts/cloud/ecs/request-runtime-acm-cert.sh`
- `scripts/cloud/ecs/provision-workspace-runtime.sh`
- `scripts/cloud/ecs/smoke-workspace-runtime.sh`
- `scripts/cloud/ecs/destroy-workspace-runtime.sh`

## 3. 直接执行顺序（staging）

### 3.1 起共享底座

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/bootstrap-shared-infra.sh
```

### 3.2 构建并推镜像

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/build-and-push-image.sh --image-tag staging-001
```

### 3.3 为某个 workspace 创建 runtime

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
IMAGE_URI=$(AWS_PROFILE=bustly-staging terraform -chdir=infra/terraform/ecs-fargate output -raw ecr_repository_url):staging-001
AWS_PROFILE=bustly-staging scripts/cloud/ecs/provision-workspace-runtime.sh \
  --workspace-id <workspace-id> \
  --image "$IMAGE_URI" \
  --routing-mode host \
  --runtime-domain-suffix runtime-staging.bustly.ai \
  --skip-channels 1
```

> 脚本会输出：`ws_url` 和 `gateway_token`。

### 3.3.1 测试域名证书（一次性）

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/request-runtime-acm-cert.sh \
  --domain-suffix runtime-staging.bustly.ai
```

按输出把 CNAME 验证记录加到 Cloudflare（`DNS only`），证书签发后执行 `terraform apply` 开启 ALB 443。

### 3.4 跑 smoke

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/smoke-workspace-runtime.sh --workspace-id <workspace-id>
```

### 3.5 回收某个 workspace runtime

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/destroy-workspace-runtime.sh --workspace-id <workspace-id>
```

## 4. 域名和证书后续接入

你现在可以先用 ALB 域名跑通。后续你准备好：

- Route53 域名
- ACM 证书（新加坡区）

我再帮你补最后一步：

1. `terraform.tfvars` 写入 `acm_certificate_arn`
2. `terraform apply`
3. 连接地址从 `ws://` 升级到 `wss://`
