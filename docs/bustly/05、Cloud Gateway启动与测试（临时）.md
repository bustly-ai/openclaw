# Cloud Gateway 启动与测试（临时，自动化版）

> 适用：Bustly Cloud Runtime（workspace 维度，ECS/Fargate）

## 1. 测试目标

本文件聚焦自动化测试：

- 验证 workspace runtime 的创建、连通、消息链路、回收。
- 验证 Web 混合模式（WS + HTTP）可在同一 workspace 子域名工作。
- 验证关键负例（鉴权、过期 OAuth、接口启用状态）。

## 2. 前置条件

1. Node `>= 22.12.0`（本地运行 `pnpm openclaw` 必须）。
2. AWS Profile 可用（示例：`bustly-staging`）。
3. 共享基础设施已存在（Terraform `infra/terraform/ecs-fargate`）。
4. 测试证书已签发（`runtime-staging.bustly.ai`）。
5. Cloudflare 已配置：
   - `CNAME runtime-staging -> <alb-dns>`（DNS only）
   - `CNAME *.runtime-staging -> <alb-dns>`（DNS only）

## 3. 自动化执行主链路（推荐）

## 3.1 构建并推镜像

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/build-and-push-image.sh --image-tag staging-006
```

## 3.2 创建 workspace runtime（host-based）

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

输出中记录：

- `http_base_url`
- `ws_url`
- `gateway_token`

## 3.3 一键 smoke

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/smoke-workspace-runtime.sh --workspace-id <workspace_id>
```

通过标准：

- ALB target 变为 `healthy`
- `health` 返回 `ok=true`
- `bustly.workspace.get-active` 返回 workspace 与 agent 目录

说明：

- 在 `destroy -> recreate` 场景下，ALB target 从 `unhealthy` 收敛到 `healthy`
  可能需要 2-3 分钟
- 原因通常不是 runtime 已坏，而是 ALB 健康检查间隔与健康阈值较保守

## 4. 自动化测试用例清单

## 4.1 基础设施与证书

| 用例ID | 检查点        | 命令                                             | 通过标准        |
| ------ | ------------- | ------------------------------------------------ | --------------- |
| INF-01 | ACM 证书状态  | `aws acm describe-certificate ...`               | `Status=ISSUED` |
| INF-02 | Listener 状态 | `aws elbv2 describe-listeners ...`               | 有 `:443 HTTPS` |
| INF-03 | 子域名解析    | `dig +short ws-<slug>.runtime-staging.bustly.ai` | 解析到 ALB      |

## 4.2 WS 主链路

| 用例ID | 检查点         | 命令                                           | 通过标准                                         |
| ------ | -------------- | ---------------------------------------------- | ------------------------------------------------ |
| WS-00  | 握手参数校验   | Web 壳发 `connect`                             | `client.id=cli` 等字段合法，连接不被 `1008` 关闭 |
| WS-01  | 健康检查       | `raw-gateway-call health`                      | `ok=true`                                        |
| WS-02  | 当前 workspace | `raw-gateway-call bustly.workspace.get-active` | workspaceId 正确                                 |
| WS-03  | workspace 切换 | `raw-gateway-call bustly.workspace.set-active` | 返回切换成功                                     |
| WS-04  | 会话创建       | `raw-gateway-call bustly.sessions.create`      | 返回 `sessionKey`                                |
| WS-05  | 消息闭环       | `chat.send -> agent.wait -> chat.history`      | 历史有用户消息和 assistant 输出                  |
| WS-06  | 诊断导出       | `bustly.runtime.report-issue`                  | 返回 `archivePath`                               |

示例：

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
WS_URL="wss://<workspace_host>.runtime-staging.bustly.ai"
TOKEN="<gateway_token>"

node scripts/cloud/ecs/raw-gateway-call.mjs --url "$WS_URL" --token "$TOKEN" --method health --params '{}'
node scripts/cloud/ecs/raw-gateway-call.mjs --url "$WS_URL" --token "$TOKEN" --method bustly.workspace.get-active --params '{}'
```

## 4.3 HTTP 辅助链路（混合模式）

| 用例ID  | 检查点                          | 命令                        | 预期                                                         |
| ------- | ------------------------------- | --------------------------- | ------------------------------------------------------------ |
| HTTP-01 | `/tools/invoke` 路由与鉴权      | `POST /tools/invoke`        | 带 token 返回业务错误（如参数缺失）；不带 token 返回 401/403 |
| HTTP-02 | `/api/media` 路由               | `GET /api/media`            | 无 path 参数返回 400                                         |
| HTTP-03 | OAuth callback 路由             | `GET /authorize`            | 缺少 code 时返回 400 登录失败页                              |
| HTTP-04 | `/v1/responses` 启用状态        | `POST /v1/responses`        | 未启用时 405；启用后进入鉴权/参数校验                        |
| HTTP-05 | `/v1/chat/completions` 启用状态 | `POST /v1/chat/completions` | 未启用时 405；启用后进入鉴权/参数校验                        |

## 4.4 插件能力（openclaw-lark）

| 用例ID | 检查点       | 命令/观察                                     | 通过标准                                         |
| ------ | ------------ | --------------------------------------------- | ------------------------------------------------ |
| PLG-01 | 插件加载成功 | 启动日志                                      | 不出现 `failed to load plugin ... openclaw-lark` |
| PLG-02 | 依赖完整性   | 检查 `extensions/openclaw-lark/src/core/*.js` | 依赖文件可解析，命令可注册                       |

## 4.5 负例与稳定性

| 用例ID | 场景                       | 预期                                      |
| ------ | -------------------------- | ----------------------------------------- |
| NEG-01 | token 错误                 | WS connect 失败 / HTTP 401                |
| NEG-02 | OAuth 过期                 | `chat.send` 可能报 `401 Invalid JWT`      |
| NEG-03 | 重建冲突                   | `service still draining` 时脚本自动重试   |
| NEG-04 | 运行中重建                 | `destroy -> provision` 后可恢复正常       |
| NEG-05 | WS 握手字段错误            | 连接被 `1008 invalid connect params` 拒绝 |
| NEG-06 | 缺少 `BUSTLY_WEB_BASE_URL` | `bustly.links.resolve` 返回 `UNAVAILABLE` |

## 5. 常见失败与自动化修复建议

## 5.1 `401 Invalid JWT`

原因：`~/.bustly/bustlyOauth.json` 会话过期。

处理：

1. 重新走 `oauth.login + oauth.poll`。
2. 重新执行 `provision-workspace-runtime.sh` 注入新状态。

## 5.2 `service name is still draining`

处理：

- 当前脚本已内置重试。
- 若持续失败，先 `destroy-workspace-runtime.sh` 再 `provision`。
- `recreate` 后 smoke 若前 1-2 分钟仍显示 `Target.FailedHealthChecks`，优先继续等待
  健康收敛，而不是立刻判定 runtime 启动失败。

## 5.3 Node 版本导致本地 CLI 失败

症状：`openclaw requires Node >=22.12.0`。

处理：

- 使用 Node 22 执行本地 `pnpm openclaw`。
- 自动化优先使用 `raw-gateway-call.mjs`（不依赖本地 openclaw CLI 连接逻辑）。

## 5.4 `invalid connect params`（WS code=1008）

原因：Web 壳握手参数不符合网关 schema，常见是 `client.id` 非预期值。

处理：

1. 对齐握手参数：`id=cli`、`mode=cli`、`version=dev`、`platform=web`。
2. 重新连接并执行 `health` 与 `bustly.workspace.get-active` 验证。

## 5.5 `bustly.links.resolve UNAVAILABLE`

原因：运行环境缺少 `BUSTLY_WEB_BASE_URL`。

处理：

1. 在 runtime 环境变量中补齐 `BUSTLY_WEB_BASE_URL=https://<workspace_host>.runtime-<env>.bustly.ai`。
2. 重新部署对应 workspace runtime。

## 6. 回收测试资源

```bash
cd /Users/qiuweijun/Desktop/project/bustly/openclaw
AWS_PROFILE=bustly-staging scripts/cloud/ecs/destroy-workspace-runtime.sh --workspace-id <workspace_id>
```

## 7. 建议的 CI 门槛

建议 CI 至少卡以下项：

1. `smoke-workspace-runtime.sh` 必须通过。
2. WS 消息闭环（`send/wait/history`）必须通过。
3. HTTP 路由检查（`/tools/invoke`、`/authorize`）必须通过。
4. `openclaw-lark` 插件加载检查必须通过。
5. destroy + recreate 一次必须通过。

## 8. 参考

- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/04、Cloud-Web壳能力对齐清单.md`
- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/06、Bustly Cloud Runtime完整部署方案.md`
