# feat/cloud_server 合并 remote main 说明（2026-02-12）

## 1. 合并背景

- 本次目标：将 `origin/main` 合并到本地 `feat/cloud_server`，并保留 Bustly 产品化改造逻辑。
- 约束：不改动远程 `main`、不改动远程 `feat/electron`，仅在 `feat/cloud_server` 完成合并与冲突处理。

## 2. 基线与提交信息

- 合并前 `feat/cloud_server` 基线：`0412c4d08`
- 参与合并的 `origin/main` 提交：`b094491cf`
- 合并提交（本地）：`5883a3683ec024908f4ef77c5d8da9c52242f999`

验证结果：

- `git merge-base --is-ancestor origin/main feat/cloud_server` 返回 `0`
- `git rev-list --left-right --count feat/cloud_server...origin/main` 为 `104 0`

结论：`origin/main` 在当时已完整纳入 `feat/cloud_server`。

## 3. 变更规模

对比区间：`0412c4d08..5883a3683`

- 文件变更：`1988`
- 代码变更：`+166,323 / -28,307`

按顶层目录（文件数）统计：

- `src`: 895
- `docs`: 536
- `extensions`: 244
- `ui`: 120
- `apps`: 71

## 4. main 合并带来的主要新增能力

### 4.1 Web 控制台能力增强

- 新增 Agents Dashboard（代理总览、文件管理、工具策略、技能、频道、Cron 入口）
- 新增 Usage Dashboard（Token/成本/时序/会话日志分析）
- 控制台路由与渲染能力扩展，支持更多后台控制面板

### 4.2 Gateway / Agent 管理增强

- 新增 `agents.create / agents.update / agents.delete`
- 新增 `agents.files.list / agents.files.set`
- 通过 Gateway 可对代理生命周期和关键工作区文件进行集中管理

### 4.3 Memory 体系升级

- 引入可选 QMD backend（启动、更新、队列、容错等机制）
- 增强语义检索与索引稳定性
- 新增/完善 Voyage embeddings 能力（含 batch 路径）

### 4.4 Cron 调度增强

- delivery 语义规范化（如 `announce` / `none`）并兼容历史字段
- 增强 one-shot 任务行为、避免重复触发
- 增强 timer 重入保护、错误回退与调度稳定性

### 4.5 渠道与插件生态扩展

- Feishu/Lark 插件能力增强（频道与文档/权限相关工具）
- 新增 IRC 一等频道插件
- Telegram/Discord/Slack/WhatsApp 等渠道的大量稳定性与线程/路由修复

### 4.6 模型与 Provider 扩展

- 扩展 xAI Grok、Together、Qianfan、Cloudflare AI Gateway、Custom Provider 等支持
- `web_search` 增加 Grok provider
- Onboarding/鉴权选项覆盖更多 provider 场景

### 4.7 安全增强

- 新增技能/插件代码安全扫描能力
- SSRF 防护、凭据保护、allowlist/owner 权限、gateway scope 约束增强

### 4.8 CLI 与工程化优化

- 路径解析增强（含 `OPENCLAW_HOME`、`OPENCLAW_STATE_DIR` 场景）
- `logs` 支持本地时区显示
- 构建链路与 CI 流程进行提速与稳定性优化

## 5. 与 Bustly 产品化分支相关的保留项（冲突处理重点）

本次冲突处理明确保留了 Bustly 侧关键逻辑，重点包括：

- 状态目录与文案：`~/.bustly` 相关路径语义
- Bustly 登录/OAuth 流程相关入口与展示
- Bustly 品牌化 UI 关键部分
- 与产品链路相关的 chat/gateway 关键行为未被主线覆盖掉

## 6. 结论

本次合并属于“主线能力大规模同步 + 产品化逻辑保留”的结果：

- `main` 新特性已合入
- Bustly 产品改造主干逻辑已保留
- 后续可在 `feat/cloud_server` 上继续进行产品功能升级

## 7. 2026-02-25 续合并补充记录（再次同步 remote main）

### 7.1 本轮合并基线

- 本轮合并前 `feat/cloud_server` 基线：`109d2e97b`
- 本轮参与合并的 `origin/main` 提交：`8930dc0a7`
- 本轮合并提交（本地）：`5fd039ee1b57d5b4479461ec0acf1a191ce324ae`

验证结果：

- `git merge-base --is-ancestor origin/main feat/cloud_server` 返回 `0`
- `git rev-list --left-right --count feat/cloud_server...origin/main` 为 `106 0`
- `git ls-files -u` 为空（无未解决 merge 冲突）

结论：截至本轮合并提交，`origin/main` 已完整纳入 `feat/cloud_server`，冲突已全部落地处理。

### 7.2 本轮冲突处理与保留策略（补充）

- 继续保留 Bustly 定制：`~/.bustly` 状态目录语义、默认端口 `17999`、Bustly 登录/OAuth/UI 入口、Gateway 相关扩展逻辑
- 吸收主线新增安全与功能变更（Gateway / UI / tests / docs 等大规模更新）
- 保留 `extensions/google-antigravity-auth`（主线删除但 Bustly 分支仍依赖）

### 7.3 为 `apps/electron` 本地启动新增的修复（本轮验证前）

- 修复 `pnpm-lock.yaml`，补回 `apps/electron` importer（通过 `pnpm --filter bustly` 重新生成 lockfile）
- `openclaw/apps/electron/package.json`：将 `zod` 升级到 `^4.3.6`，适配合并后的主线代码用法（`z.registry()` 等）
- `openclaw/apps/electron/src/main/cli-utils.ts`：增强 Node 二进制选择逻辑，优先选择满足 `>=22.12.0` 的 Node（避免 Gateway 子进程落到系统 Node 20）
- 新增 `openclaw/extensions/google-antigravity-auth/openclaw.plugin.json`：补齐插件 manifest，避免配置校验失败
- 重建 `openclaw/dist`（`pnpm -C openclaw exec tsdown`），避免旧产物引用过时依赖导致 Gateway 启动异常

### 7.4 `apps/electron` 本地启动与流程校验（2026-02-25）

启动命令：

```bash
env -u ELECTRON_RUN_AS_NODE pnpm -C openclaw/apps/electron run dev
```

关键启动日志（已观察到）：

- Vite renderer 启动成功：`http://localhost:5180/`
- Electron 主进程启动成功（读取 `~/.bustly/openclaw.json`）
- Bustly OAuth 回调服务启动成功：`http://127.0.0.1:18790`
- Gateway 启动成功：`Gateway started successfully`
- Gateway WebSocket 监听成功：`ws://127.0.0.1:17999`
- Browser control 服务监听成功：`http://127.0.0.1:18001/`（`auth=token`）

端口与 HTTP 探活（本地）：

- `5180`（Vite）监听正常，`curl http://localhost:5180` 返回 `HTTP/1.1 200 OK`
- `17999`（Gateway WS）监听正常；访问根路径返回 `503`（提示 Control UI assets 缺失，不影响 Electron 应用本身启动）
- `18001`（Browser control）监听正常，未携带 token 访问根路径返回 `401 Unauthorized`（符合预期）
- `18790`（Bustly OAuth callback）监听正常

备注：

- `pnpm` 启动阶段仍可能显示 engine warning（外层执行环境 Node 20），但 Gateway 子进程已通过本轮修复自动选用满足要求的 Node 22，实际启动不再被阻塞。

### 7.5 白屏问题补充（2026-02-25）

现象：

- Electron 主窗口可打开，但 Control UI 显示空白页（白屏）
- DevTools 中可见请求 `main?meta=1` 返回 `{"avatarUrl":null}`（该返回本身正常，不是根因）

根因：

- `openclaw/ui/src/ui/app-render.helpers.ts` 在合并后遗漏了 `focusActive` / `disableFocusToggle` 变量定义
- 运行时触发 `ReferenceError: focusActive is not defined`，导致 Control UI 前端渲染崩溃

修复：

- 补回变量定义（对齐主线实现）
- 重新执行 `pnpm -C openclaw ui:build` 生成新的 `dist/control-ui` 静态资源

验证：

- Headless Chrome 诊断脚本确认 `pageErrors = 0`
- `http://127.0.0.1:17999/?token=...` 返回 `OpenClaw Control` 页面，非 `503`
- Gateway 日志出现 `client=openclaw-control-ui webchat`

### 7.6 右上角登录态未更新排查（2026-02-25）

现象：

- 右上角点击 `Log in →`，浏览器完成登录并回跳本地 `127.0.0.1:18790`
- 返回桌面应用后，右上角登录态未变更（仍显示未登录）

定位过程与结论：

- `main?meta=1` 返回 `{"avatarUrl":null}` 为正常头像元信息请求，非根因
- 本地 OAuth callback 服务工作正常（可收到 `/authorize?code=...&state=...` 回调）
- 首轮排查时使用测试环境 `.env`（`test-www` / `test.agent-api`），token exchange 被后端拒绝：
  - API 返回：`status: 1`
  - 错误消息：`Your subscription has expired`
- 因 token exchange 失败，`bustlyOauth.json` 不会写入用户信息和 token，因此 UI 保持未登录是符合逻辑的表现，不是“登录态刷新事件失效”

为避免误判补充的 UI 反馈改动：

- `openclaw/ui/src/ui/app-render.ts`：右上角登录按钮在登录失败时显示错误态（`Log in (failed)`）
- `openclaw/ui/src/styles/layout.css`：新增 `bustly-login-btn--error` 样式
- 鼠标悬停按钮可看到失败原因（tooltip，来自 `oauthLoginError`）

在用户更新 `openclaw/apps/electron/.env` 后复测：

- 新环境变量已被 Electron 主进程成功加载（日志可见 `OPENCLAW_CONFIG_PATH` / `OPENCLAW_STATE_DIR` / `BUSTLY_*`）
- 登录地址切换到生产环境：
  - `BUSTLY_WEB_BASE_URL=https://www.bustly.shop`
  - `BUSTLY_API_BASE_URL=https://gateway.bustly.shop`
- OAuth 回调成功后，token exchange 成功：
  - API 返回：`status: 0`, `message: Request successful`
- `~/.bustly/bustlyOauth.json` 已写入有效登录态（用户 `andy@crunchpod.app`）

补充说明：

- 本轮验证中登录链路已成功，但桌面端是否直接进入完整控制台界面仍取决于本地 `openclaw.json` 配置文件是否存在（与 Bustly 登录态为两条独立状态链路）。
