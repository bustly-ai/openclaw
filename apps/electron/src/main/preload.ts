import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";

type OpenClawInitOptions = {
  gatewayPort?: number;
  gatewayBind?: "loopback" | "lan" | "auto";
  workspace?: string;
  nodeManager?: "npm" | "pnpm" | "bun";
  openrouterApiKey?: string;
};

type GatewayLogPayload = { stream: "stdout" | "stderr"; message: string };
type GatewayExitPayload = { code: number | null; signal: string | null };
type MainLogPayload = { message: string };
type UpdateStatusPayload = { event: string };
type GatewayLifecyclePayload = {
  phase: "starting" | "stopping" | "ready" | "error";
  message: string | null;
  canRestoreLastGoodConfig: boolean;
};

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // OpenClaw initialization
  openclawInit: (options?: OpenClawInitOptions) => ipcRenderer.invoke("openclaw-init", options),
  openclawIsInitialized: () => ipcRenderer.invoke("openclaw-is-initialized"),
  openclawNeedsOnboard: () => ipcRenderer.invoke("openclaw-needs-onboard"),

  // Gateway management
  gatewayStart: (apiKey?: string) => ipcRenderer.invoke("gateway-start", apiKey),
  gatewayStop: () => ipcRenderer.invoke("gateway-stop"),
  gatewayRestoreLastGoodConfig: () => ipcRenderer.invoke("gateway-restore-last-good-config"),
  gatewayStatus: () => ipcRenderer.invoke("gateway-status"),
  gatewayConnectConfig: () => ipcRenderer.invoke("gateway-connect-config"),
  gatewayPatchSession: (key: string, patch: { label?: string | null; icon?: string | null }) =>
    ipcRenderer.invoke("gateway-patch-session", key, patch),
  gatewayPatchSessionLabel: (key: string, label: string) =>
    ipcRenderer.invoke("gateway-patch-session-label", key, label),
  gatewayPatchSessionModel: (key: string, model: string) =>
    ipcRenderer.invoke("gateway-patch-session-model", key, model),
  gatewayDeleteSession: (key: string) => ipcRenderer.invoke("gateway-delete-session", key),
  resolvePastedPath: (params: {
    file?: File;
    entryPath?: string;
    entryName?: string;
    transferPaths?: string[];
    fallbackKind: "file" | "directory";
  }) =>
    ipcRenderer.invoke("resolve-pasted-path", {
      directPath: params.file ? webUtils.getPathForFile(params.file) : "",
      entryPath: params.entryPath,
      entryName: params.entryName,
      transferPaths: params.transferPaths,
      fallbackKind: params.fallbackKind,
    }),
  selectChatContextPaths: () => ipcRenderer.invoke("dialog-select-chat-context-paths"),
  resolveChatImagePreview: (path: string) => ipcRenderer.invoke("resolve-chat-image-preview", path),
  openLocalPath: (path: string) => ipcRenderer.invoke("open-local-path", path),

  // App info
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  getNativeFullscreenStatus: () => ipcRenderer.invoke("window-native-fullscreen-status"),
  updaterCheck: () => ipcRenderer.invoke("updater-check"),
  updaterInstall: () => ipcRenderer.invoke("updater-install"),
  updaterStatus: () => ipcRenderer.invoke("updater-status"),

  // Onboarding
  bustlyLogin: () => ipcRenderer.invoke("bustly-login"),
  bustlyCancelLogin: () => ipcRenderer.invoke("bustly-cancel-login"),
  bustlyIsLoggedIn: () => ipcRenderer.invoke("bustly-is-logged-in"),
  bustlyGetUserInfo: () => ipcRenderer.invoke("bustly-get-user-info"),
  bustlyGetSupabaseConfig: () => ipcRenderer.invoke("bustly-get-supabase-config"),
  bustlySetActiveWorkspace: (workspaceId: string, workspaceName?: string) =>
    ipcRenderer.invoke("bustly-set-active-workspace", workspaceId, workspaceName),
  bustlyListAgents: (workspaceId?: string) => ipcRenderer.invoke("bustly-list-agents", workspaceId),
  bustlyListAgentSessions: (workspaceId: string, agentId: string) =>
    ipcRenderer.invoke("bustly-list-agent-sessions", workspaceId, agentId),
  bustlyCreateAgent: (workspaceId: string, name: string, icon?: string, workspaceName?: string) =>
    ipcRenderer.invoke("bustly-create-agent", workspaceId, name, icon, workspaceName),
  bustlyCreateAgentSession: (params: {
    workspaceId: string;
    agentId: string;
    label?: string;
    promptExcerpt?: string;
    sampleRouteKey?: string;
  }) =>
    ipcRenderer.invoke("bustly-create-agent-session", params),
  bustlyUpdateAgent: (params: { workspaceId: string; agentId: string; name?: string; icon?: string }) =>
    ipcRenderer.invoke("bustly-update-agent", params),
  bustlyDeleteAgent: (params: { workspaceId: string; agentId: string }) =>
    ipcRenderer.invoke("bustly-delete-agent", params),
  bustlyLogout: () => ipcRenderer.invoke("bustly-logout"),
  bustlyOpenLogin: () => ipcRenderer.invoke("bustly-open-login"),
  bustlyOpenSettings: () => ipcRenderer.invoke("bustly-open-settings"),
  bustlyReportIssue: () => ipcRenderer.invoke("bustly-report-issue"),
  bustlyOpenWorkspaceSettings: (workspaceId: string) =>
    ipcRenderer.invoke("bustly-open-workspace-settings", workspaceId),
  bustlyOpenWorkspaceInvite: (workspaceId: string) =>
    ipcRenderer.invoke("bustly-open-workspace-invite", workspaceId),
  bustlyOpenWorkspaceManage: (workspaceId: string) =>
    ipcRenderer.invoke("bustly-open-workspace-manage", workspaceId),
  bustlyOpenWorkspacePricing: (workspaceId: string) =>
    ipcRenderer.invoke("bustly-open-workspace-pricing", workspaceId),
  bustlyOpenWorkspaceCreate: (workspaceId?: string) => ipcRenderer.invoke("bustly-open-workspace-create", workspaceId),
  consumePendingDeepLink: () => ipcRenderer.invoke("deep-link-consume-pending"),

  // Event listeners
  onGatewayLog: (callback: (data: GatewayLogPayload) => void) => {
    const listener = (_event: IpcRendererEvent, data: GatewayLogPayload) => callback(data);
    ipcRenderer.on("gateway-log", listener);
    return () => ipcRenderer.removeListener("gateway-log", listener);
  },

  onGatewayExit: (callback: (data: GatewayExitPayload) => void) => {
    const listener = (_event: IpcRendererEvent, data: GatewayExitPayload) => callback(data);
    ipcRenderer.on("gateway-exit", listener);
    return () => ipcRenderer.removeListener("gateway-exit", listener);
  },
  onGatewayLifecycle: (callback: (data: GatewayLifecyclePayload) => void) => {
    const listener = (_event: IpcRendererEvent, data: GatewayLifecyclePayload) => callback(data);
    ipcRenderer.on("gateway-lifecycle", listener);
    return () => ipcRenderer.removeListener("gateway-lifecycle", listener);
  },
  onMainLog: (callback: (data: MainLogPayload) => void) => {
    const listener = (_event: IpcRendererEvent, data: MainLogPayload) => callback(data);
    ipcRenderer.on("main-log", listener);
    return () => ipcRenderer.removeListener("main-log", listener);
  },
  onUpdateStatus: (callback: (data: UpdateStatusPayload) => void) => {
    const listener = (_event: IpcRendererEvent, data: UpdateStatusPayload) => callback(data);
    ipcRenderer.on("update-status", listener);
    return () => ipcRenderer.removeListener("update-status", listener);
  },
  onNativeFullscreenChange: (callback: (data: { isNativeFullscreen: boolean }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { isNativeFullscreen: boolean }) => callback(data);
    ipcRenderer.on("window-native-fullscreen", listener);
    return () => ipcRenderer.removeListener("window-native-fullscreen", listener);
  },
  onBustlyLoginRefresh: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("bustly-login-refresh", listener);
    return () => ipcRenderer.removeListener("bustly-login-refresh", listener);
  },
  onDeepLink: (callback: (payload: { url: string; route: string | null; workspaceId: string | null }) => void) => {
    const listener = (_event: unknown, payload: { url: string; route: string | null; workspaceId: string | null }) =>
      callback(payload);
    ipcRenderer.on("deep-link", listener);
    return () => ipcRenderer.removeListener("deep-link", listener);
  },
  onBustlySessionLabelUpdated: (
    callback: (payload: { agentId: string; sessionKey: string; label: string; updatedAt: number | null }) => void,
  ) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: { agentId: string; sessionKey: string; label: string; updatedAt: number | null },
    ) => callback(payload);
    ipcRenderer.on("bustly-session-label-updated", listener);
    return () => ipcRenderer.removeListener("bustly-session-label-updated", listener);
  },
});
