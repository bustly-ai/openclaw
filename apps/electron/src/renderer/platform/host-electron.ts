import type { RendererHostAdapter } from "./host";

function requireElectronApi(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error("Electron API not available");
  }
  return window.electronAPI;
}

export const electronRendererHostAdapter: RendererHostAdapter = {
  platform: "electron",
  gatewayStatus: async () => await requireElectronApi().gatewayStatus(),
  gatewayStart: async () => await requireElectronApi().gatewayStart(),
  gatewayConnectConfig: async () => await requireElectronApi().gatewayConnectConfig(),
  gatewayRestoreLastGoodConfig: async () =>
    await requireElectronApi().gatewayRestoreLastGoodConfig(),
  openclawInit: async (options?: PresetConfigOptions) => await requireElectronApi().openclawInit(options),
  openclawIsInitialized: async () => await requireElectronApi().openclawIsInitialized(),
  getAppInfo: async () => await requireElectronApi().getAppInfo(),
  bustlyIsLoggedIn: async () => await requireElectronApi().bustlyIsLoggedIn(),
  bustlyLogin: async () => await requireElectronApi().bustlyLogin(),
  bustlyPollLogin: async (loginTraceId: string) =>
    await requireElectronApi().bustlyPollLogin(loginTraceId),
  bustlyCancelLogin: async (loginTraceId?: string) =>
    await requireElectronApi().bustlyCancelLogin(loginTraceId),
  bustlyGetUserInfo: async () => await requireElectronApi().bustlyGetUserInfo(),
  bustlyLogout: async () => await requireElectronApi().bustlyLogout(),
  bustlyOpenSettings: async () => await requireElectronApi().bustlyOpenSettings(),
  bustlyOpenWorkspaceSettings: async (workspaceId: string) =>
    await requireElectronApi().bustlyOpenWorkspaceSettings(workspaceId),
  bustlyOpenWorkspaceInvite: async (workspaceId: string) =>
    await requireElectronApi().bustlyOpenWorkspaceInvite(workspaceId),
  bustlyOpenWorkspaceManage: async (workspaceId: string) =>
    await requireElectronApi().bustlyOpenWorkspaceManage(workspaceId),
  bustlyOpenWorkspacePricing: async (workspaceId: string) =>
    await requireElectronApi().bustlyOpenWorkspacePricing(workspaceId),
  bustlyOpenWorkspaceCreate: async (workspaceId?: string) =>
    await requireElectronApi().bustlyOpenWorkspaceCreate(workspaceId),
  resolvePastedPath: async (params) => await requireElectronApi().resolvePastedPath(params),
  selectChatContextPaths: async () => await requireElectronApi().selectChatContextPaths(),
  resolveChatImagePreview: async (path: string) => await requireElectronApi().resolveChatImagePreview(path),
  resolveChatMediaPreview: async (path: string) => await requireElectronApi().resolveChatMediaPreview(path),
  openLocalPath: async (path: string) => await requireElectronApi().openLocalPath(path),
  openExternalUrl: async (url: string) => await requireElectronApi().openExternalUrl(url),
  getNativeFullscreenStatus: async () => await requireElectronApi().getNativeFullscreenStatus(),
  updaterStartInstall: async () => await requireElectronApi().updaterStartInstall(),
  updaterInstall: async () => await requireElectronApi().updaterInstall(),
  updaterStatus: async () => await requireElectronApi().updaterStatus(),
  consumePendingDeepLink: async () => await requireElectronApi().consumePendingDeepLink(),
  onGatewayLifecycle: (callback: (data: GatewayLifecycleData) => void) =>
    requireElectronApi().onGatewayLifecycle(callback),
  onBustlyLoginRefresh: (callback: () => void) =>
    requireElectronApi().onBustlyLoginRefresh(callback),
  onNativeFullscreenChange: (callback: (data: { isNativeFullscreen: boolean }) => void) =>
    requireElectronApi().onNativeFullscreenChange(callback),
  onUpdateStatus: (callback: (data: { event: string; state?: DesktopUpdateState }) => void) =>
    requireElectronApi().onUpdateStatus(callback),
  onDeepLink: (callback: (data: DeepLinkData) => void) =>
    requireElectronApi().onDeepLink(callback),
};
