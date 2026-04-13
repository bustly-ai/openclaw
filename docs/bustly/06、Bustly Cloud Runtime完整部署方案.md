# Bustly Cloud Runtime 完整部署方案（workspace 自动化部署与管理）

> 更新时间：2026-04-13

## 1. 目标

面向 OpenClaw 云端 runtime，落地以下能力：

1. **按 workspace 自动化部署**（每 workspace 一个 runtime service）。
2. **按 workspace 自动化管理**（创建、升级、切换、健康巡检、回收）。
3. 与 Control Plane / Account Service 边界清晰，职责不混淆。
4. 支持 Web 端 WS + HTTP 混合模式，不改现有 HTTP 根路径。

## 2. 当前已落地状态（staging）

Region：`ap-southeast-1`

已完成：

- ALB：`openclaw-staging-alb`（含 `80/HTTP` + `443/HTTPS` listener）。
- wildcard 证书：`*.runtime-staging.bustly.ai`（已 `ISSUED`）。
- 路由模式：已支持 `path` 与 `host`，推荐 `host`。
- 运行模式：ECS/Fargate + EFS + DynamoDB 映射表。
- workspace runtime 示例：
  - `workspace_host`: `ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai`
  - `ws_url`: `wss://ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai`
  - `http_base_url`: `https://ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai`

## 3. 服务边界（Notion 设计对齐）

## 3.1 Account Service

职责：

- 用户、workspace、membership 主数据。
- OAuth token 生命周期（签发、刷新、失效）。

不负责：

- runtime 部署与扩缩容。
- runtime token 分发与路由编排。

## 3.2 Control Plane Services

职责：

- runtime 编排：deploy/restart/drain/stop/health。
- runtime 路由注册（workspace -> host）。
- runtime token 生命周期（短期连接 token）。
- 运行态审计、健康聚合、告警。

不负责：

- provider OAuth 主权存储。

## 3.3 OpenClaw Cloud Runtime

职责：

- Gateway WS/HTTP 对外接口。
- agent/session/chat/workspace runtime 执行。
- 接收控制面配置并执行。

V1 兼容策略：

- 运行态继续兼容 `~/.bustly/bustlyOauth.json`。

## 3.4 三方关系总览（执行口径）

| 主题 | Account Service | Control Plane | OpenClaw Runtime |
| --- | --- | --- | --- |
| workspace 主数据 | 主责 | 读 | 读 |
| OAuth 生命周期 | 主责 | 读（同步状态） | 使用现态 |
| runtime 创建/销毁/升级 | - | 主责 | 被编排执行 |
| 运行路由（workspace->host） | - | 主责 | 被路由承载 |
| connect bundle 签发 | - | 主责 | 消费 token |
| WS/HTTP 业务执行 | - | - | 主责 |
| 健康与告警聚合 | - | 主责 | 上报状态 |

## 4. workspace 维度自动化管理模型

## 4.1 核心原则

- 1 workspace = 1 ECS service + 1 target group + 1 listener rule + 1 EFS access point。
- 数据隔离：每 workspace 独立状态目录（EFS AP）。
- 路由隔离：每 workspace 独立子域名（host-header）。

## 4.2 映射表（DynamoDB）建议字段

最小字段（已在脚本落地）：

- `workspace_id`
- `service_name`
- `task_definition_arn`
- `target_group_arn`
- `listener_rule_arn`
- `efs_access_point_id`
- `routing_mode`
- `workspace_host`
- `workspace_path`
- `http_base_url`
- `ws_url`
- `gateway_token`
- `created_at`
- `expires_at`

## 4.3 Control Plane 自动化动作（按 workspace）

建议收敛为以下动作：

1. `ensure-runtime(workspaceId)`
2. `upgrade-runtime(workspaceId, imageTag)`
3. `rotate-runtime-token(workspaceId)`
4. `workspace-switch(workspaceId)`
5. `drain-runtime(workspaceId)`
6. `destroy-runtime(workspaceId)`
7. `runtime-health(workspaceId)`

对应本仓库脚本：

- 创建：`provision-workspace-runtime.sh`
- 检查：`smoke-workspace-runtime.sh`
- 回收：`destroy-workspace-runtime.sh`

## 5. 自动化部署流程（workspace）

## 5.1 一次性底座

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/bootstrap-shared-infra.sh
```

## 5.2 镜像发布

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/build-and-push-image.sh --image-tag staging-006
```

## 5.3 按 workspace 自动创建

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
IMAGE_URI="$(AWS_PROFILE=bustly-staging terraform -chdir=infra/terraform/ecs-fargate output -raw ecr_repository_url):staging-006"
AWS_PROFILE=bustly-staging scripts/cloud/ecs/provision-workspace-runtime.sh \
  --workspace-id <workspace_id> \
  --image "$IMAGE_URI" \
  --routing-mode host \
  --runtime-domain-suffix runtime-staging.bustly.ai \
  --skip-channels 1 \
  --skip-cron 1
```

返回：

- `workspace_host`
- `http_base_url`
- `ws_url`
- `gateway_token`

Control Plane 应把这些整理成 Web 可消费的 `connect bundle`。

## 6. Web 接入契约（Control Plane -> Web）

```json
{
  "workspaceId": "<workspace_id>",
  "workspaceHost": "ws-<slug>.runtime-staging.bustly.ai",
  "httpBaseUrl": "https://ws-<slug>.runtime-staging.bustly.ai",
  "wsUrl": "wss://ws-<slug>.runtime-staging.bustly.ai",
  "gatewayToken": "<short-lived-token>"
}
```

要求：

- 前端不自行拼 host。
- 前端不持久化长期 token。
- WS 与 HTTP 使用同一 `workspaceHost`。

## 6.1 Web 混合模式兼容约束（不改前端根路径）

- WS：走 `wsUrl` 承载 RPC 与事件流（workspace/agent/session/chat）。
- HTTP：走 `httpBaseUrl` 承载根路径接口（`/authorize`、`/tools/invoke`、`/api/media`、可选 `/v1/*`）。
- 前端与 runtime 的通信地址全部来自 Control Plane 返回的 `connect bundle`。
- 若前端出现 `invalid connect params`，按网关 schema 修正握手字段（`client.id=cli` 等）。

## 7. 与 Control Plane / Account Service 的链路

## 7.1 授权链路

1. Web 发起 OAuth。
2. Account Service 完成 token 生命周期。
3. Control Plane 感知授权状态变化。
4. Control Plane 触发 runtime 配置同步/重建（如需）。

## 7.2 运行链路

1. Web 调 Control Plane 获取 `connect bundle`。
2. Web 连 runtime（WS + HTTP）。
3. runtime 上报状态到 Control Plane。
4. Control Plane 聚合健康和审计。

## 7.3 发布链路

1. CI 推镜像。
2. Control Plane 逐 workspace 执行升级。
3. 每个 workspace 执行 smoke。
4. 失败按 workspace 回滚，不影响其它 workspace。

## 7.4 Control Plane 对前端的最小接口建议

建议至少暴露以下接口（按 workspace）：

1. `POST /control/runtime/ensure`
2. `POST /control/runtime/destroy`
3. `POST /control/runtime/upgrade`
4. `GET /control/runtime/connect-bundle`
5. `GET /control/runtime/health`

其中 `connect-bundle` 响应需包含：`workspaceHost`、`httpBaseUrl`、`wsUrl`、`gatewayToken`、`expiresAt`。

## 8. 安全与多租户隔离

- 网络：runtime 仅接受来自 ALB 的流量。
- 存储：EFS AP 按 workspace 隔离目录权限。
- 鉴权：HTTP/WS 均需要 gateway token。
- 建议：token 由 Control Plane 短期下发并轮换。

## 9. 观测与治理

建议按 workspace 维度采集：

- connect 成功率
- WS RPC 错误率（method 维度）
- `chat.send -> agent.wait` 完成率
- HTTP 接口 4xx/5xx
- runtime 重启次数
- destroy/recreate 频率

## 10. 回滚与恢复

按 workspace 处理，不全局回滚：

1. 回滚镜像 tag（N-1）。
2. `destroy-runtime(workspaceId)`。
3. `ensure-runtime(workspaceId)` 重建。
4. 执行 smoke 与消息闭环。

## 11. 用户需要配合的最小事项

1. Cloudflare DNS（测试/正式域名与 wildcard）维护。
2. 提供 workspace_id（用于自动化创建 runtime）。
3. OAuth 正常可用（否则会出现 `401 Invalid JWT`）。

## 12. DoD（交付标准）

1. workspace runtime 可自动化创建、销毁、重建。
2. Control Plane 能返回标准 `connect bundle`。
3. Web 在 workspace 子域名下跑通 WS + HTTP 混合能力。
4. 自动化 smoke 和 e2e 用例稳定通过。
5. 问题可按 workspace 定位与回滚。

## 13. 关联文档

- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/04、Cloud-Web壳能力对齐清单.md`
- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/05、Cloud Gateway启动与测试（临时）.md`
- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/07、ECS-Fargate最小执行清单.md`
