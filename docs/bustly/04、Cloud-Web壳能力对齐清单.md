# Bustly Cloud Web 壳能力对齐清单（Electron 对标 + WS/HTTP 混合模式）

## 1. 目标

本清单用于明确 `apps/electron` 与 Cloud Web 壳的能力对齐现状，并给出 Web 端在云部署下的协议接入方式。

本轮目标：

- Web 壳覆盖 Electron 的核心业务能力（账号、workspace、agent、session、chat、运营链接、runtime 诊断）。
- 采用 **WS + HTTP 混合模式**，不强迫前端全量改成单协议。
- 基于每 workspace 子域名（host-based routing）兼容现有 HTTP 根路径。

## 2. 云端通信模型（推荐）

## 2.1 WebSocket（主业务面）

WS 用于高频、有状态、事件流能力：

- `health`
- `bustly.workspace.get-active` / `bustly.workspace.set-active`
- `bustly.agents.*`
- `bustly.sessions.*`
- `chat.send` / `chat.history` / `chat.abort` / `chat.retry`
- `agent.wait`
- `bustly.links.resolve`
- `bustly.runtime.*`

## 2.2 HTTP（辅助面 / 兼容面）

HTTP 用于 OAuth 回调、OpenAI/OpenResponses 兼容、工具与媒体接口：

- `GET /authorize`（OAuth callback）
- `POST /tools/invoke`
- `GET /api/media?path=...`
- `POST /v1/chat/completions`（按配置启用）
- `POST /v1/responses`（按配置启用）

## 2.3 路由前提（关键）

要兼容 HTTP 根路径，必须使用 host-based：

- `https://<workspace-host>.runtime-<env>.bustly.ai`
- `wss://<workspace-host>.runtime-<env>.bustly.ai`

不建议继续用 path-based（`/runtime/<workspaceId>`）承载 HTTP 根路径接口。

## 2.4 WS 握手参数约束（避免 `invalid connect params`）

Web 壳在发起 WS 握手时，`connect` 请求中的 `client` 字段必须满足网关 schema。

最小建议值：

```json
{
  "method": "connect",
  "params": {
    "client": {
      "id": "cli",
      "version": "dev",
      "mode": "cli",
      "platform": "web"
    },
    "auth": {
      "token": "<gateway_token>"
    }
  }
}
```

若 `client.id` 等字段不符合约束，网关会返回 `code=1008` 并关闭连接。

## 3. Electron -> Cloud Web 对齐矩阵

| 能力域 | Electron 能力 | Cloud Web 方式 | 协议 | 状态 |
| --- | --- | --- | --- | --- |
| 登录态 | `bustlyIsLoggedIn` | `oauth.is-logged-in` | WS | 已对齐 |
| 用户信息 | `bustlyGetUserInfo` | `oauth.get-user-info` | WS | 已对齐 |
| 登录流程 | `bustlyLogin`/`bustlyCancelLogin` | `oauth.login`/`oauth.poll`/`oauth.cancel` + `GET /authorize` | WS + HTTP | 已对齐 |
| 登出 | `bustlyLogout` | `oauth.logout` | WS | 已对齐 |
| Supabase 配置 | `bustlyGetSupabaseConfig` | `bustly.supabase.get-config` | WS | 已对齐 |
| 工作区读取 | - | `bustly.workspace.get-active` | WS | 已对齐 |
| 工作区切换 | `bustlySetActiveWorkspace` | `bustly.workspace.set-active` | WS | 已对齐 |
| Agent 列表/增改删 | `bustlyListAgents/create/update/delete` | `bustly.agents.*` | WS | 已对齐 |
| Session 列表/创建 | `bustlyListAgentSessions`/`bustlyCreateAgentSession` | `bustly.sessions.list/create` | WS | 已对齐 |
| Session 修改/删除 | session 管理 | `sessions.patch` / `sessions.delete` | WS | 已对齐 |
| 消息发送 | 发送消息 | `chat.send` | WS | 已对齐 |
| 历史消息 | 拉历史 | `chat.history` | WS | 已对齐 |
| 等待完成 | run 等待 | `agent.wait` | WS | 已对齐 |
| 终止/重试 | 停止/重试 | `chat.abort` / `chat.retry` | WS | 已对齐 |
| 设置页跳转 | `bustlyOpenSettings*` | `bustly.links.resolve(kind=...)` | WS | 已对齐 |
| Runtime 健康 | Runtime 检查 | `bustly.runtime.health` | WS | 已对齐 |
| Runtime Manifest | Runtime 配置应用 | `bustly.runtime.manifest.apply` | WS | 已对齐 |
| 诊断包导出 | `bustlyReportIssue` | `bustly.runtime.report-issue` | WS | 已对齐 |
| 工具调用 | 部分本地流程 | `POST /tools/invoke` | HTTP | 已对齐 |
| 媒体取回 | 媒体预览/下载 | `GET /api/media` | HTTP | 已对齐 |
| OpenAI 兼容 | API 模式接入 | `POST /v1/chat/completions` | HTTP | 条件启用 |
| OpenResponses 兼容 | API 模式接入 | `POST /v1/responses` | HTTP | 条件启用 |

说明：

- `v1` 接口默认可关闭；若前端/集成方使用，需在网关配置中明确启用。
- `405` 常见于接口未启用，不代表路由失败。

## 4. Web 端连接契约（Control Plane 下发）

前端不直接拼接网关地址，统一由 Control Plane 下发：

```json
{
  "workspaceId": "b28df26f-a3f6-4490-b839-9420f6267d0f",
  "workspaceHost": "ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai",
  "wsUrl": "wss://ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai",
  "httpBaseUrl": "https://ws-b28df26f-a3f-c868d77b.runtime-staging.bustly.ai",
  "gatewayToken": "<short-lived-token>"
}
```

前端规范：

- WS：按 Gateway 协议握手，并调用 RPC。
- HTTP：使用 `Authorization: Bearer <gatewayToken>`。
- Token 由 Control Plane 短期下发，前端不长期固化。

## 5. WS + HTTP 混合最小流程

1. 前端从 Control Plane 获取 `wsUrl/httpBaseUrl/token`。
2. 通过 WS 调 `bustly.workspace.get-active` 校验会话上下文。
3. 通过 WS 创建 session 并发送消息（`bustly.sessions.create -> chat.send -> agent.wait -> chat.history`）。
4. 需要 HTTP 能力时复用同一 workspace host：
   - `POST /tools/invoke`
   - `GET /api/media`
   - OAuth 浏览器回跳 `GET /authorize`

## 6. 仍然桌面专属的能力

以下能力不做同形态云化：

- 系统文件选择器：`selectChatContextPaths`
- 本地路径打开：`openLocalPath` / `resolvePastedPath`
- 桌面升级器：`updater*`
- 原生窗口全屏状态：`getNativeFullscreenStatus`

Web 对应替代：

- 浏览器文件选择/拖拽上传
- 浏览器 URL/Blob 预览
- 镜像发布替代桌面升级器

## 7. 插件能力说明（openclaw-lark）

`openclaw-lark` 作为产品能力参与常规打包与验收，不做云端特判禁用。

若异常：

- 优先检查扩展产物与依赖路径完整性（如 `extensions/openclaw-lark/src/core/*.js`）。

## 8. 验收基线

满足以下即视为 Electron/Web 云端能力对齐通过：

1. WS 主链路全部可用（workspace/agent/session/chat/runtime）。
2. HTTP 辅助链路可用（`/authorize`、`/tools/invoke`、`/api/media`）。
3. WS 握手参数符合 schema，不再出现 `invalid connect params`。
4. 前端无需改 HTTP 根路径即可在 workspace 子域名上工作。
5. 桌面专属能力有明确 Web 替代路径。

## 9. 参考

- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/05、Cloud Gateway启动与测试（临时）.md`
- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/06、Bustly Cloud Runtime完整部署方案.md`
- `/Users/qiuweijun/Desktop/project/bustly/openclaw/docs/bustly/cloud-web-shell-test.html`
