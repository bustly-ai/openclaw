import { electronRendererHostAdapter } from "./host-electron";

export type RendererHostAdapter = {
  readonly platform: "electron" | "cloud" | "custom";
  gatewayStatus: () => Promise<GatewayStatus>;
  gatewayStart: () => Promise<{ success: boolean; error?: string }>;
  gatewayConnectConfig: () => Promise<GatewayConnectConfig>;
  gatewayRestoreLastGoodConfig: () => Promise<{ success: boolean; error?: string }>;
  openclawInit: (options?: PresetConfigOptions) => Promise<InitializationResult>;
  openclawIsInitialized: () => Promise<boolean>;
  getAppInfo: () => Promise<AppInfo>;
  bustlyIsLoggedIn: () => Promise<{ success: boolean; loggedIn: boolean; error?: string }>;
  bustlyLogin: () => Promise<{ success: boolean; loginTraceId?: string; error?: string }>;
  bustlyPollLogin: (
    loginTraceId: string,
  ) => Promise<{ success: boolean; pending: boolean; error?: string }>;
  bustlyCancelLogin: (loginTraceId?: string) => Promise<{ success: boolean; error?: string }>;
  bustlyGetUserInfo: () => Promise<{ success: boolean; user: BustlyUserInfo | null; error?: string }>;
  bustlyLogout: () => Promise<{ success: boolean; error?: string }>;
  bustlyOpenSettings?: () => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceSettings?: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceInvite?: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceManage?: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspacePricing?: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceCreate?: (workspaceId?: string) => Promise<{ success: boolean; error?: string }>;
  resolvePastedPath?: (params: {
    file?: File;
    entryPath?: string;
    entryName?: string;
    transferPaths?: string[];
    fallbackKind: "file" | "directory";
  }) => Promise<{ path: string; kind: "file" | "directory" | null }>;
  selectChatContextPaths?: () => Promise<ChatContextPathSelection[]>;
  resolveChatImagePreview?: (path: string) => Promise<string | null>;
  resolveChatMediaPreview?: (path: string) => Promise<{
    dataUrl: string;
    mimeType: string;
    kind: "image" | "video" | "audio";
  } | null>;
  openLocalPath?: (path: string) => Promise<{ success: boolean; error?: string }>;
  openExternalUrl?: (url: string) => Promise<{ success: boolean; error?: string }>;
  getNativeFullscreenStatus?: () => Promise<{ isNativeFullscreen: boolean }>;
  updaterStartInstall?: () => Promise<{ success: boolean; error?: string }>;
  updaterInstall?: () => Promise<{ success: boolean; error?: string }>;
  updaterStatus?: () => Promise<{ ready: boolean; version?: string | null; state: DesktopUpdateState }>;
  consumePendingDeepLink?: () => Promise<DeepLinkData | null>;
  onGatewayLifecycle?: (callback: (data: GatewayLifecycleData) => void) => () => void;
  onBustlyLoginRefresh?: (callback: () => void) => () => void;
  onBustlyLoginProgress?: (callback: () => void) => () => void;
  onNativeFullscreenChange?: (callback: (data: { isNativeFullscreen: boolean }) => void) => () => void;
  onUpdateStatus?: (callback: (data: { event: string; state?: DesktopUpdateState }) => void) => () => void;
  onDeepLink?: (callback: (data: DeepLinkData) => void) => () => void;
};

declare global {
  interface Window {
    __OPENCLAW_RENDERER_HOST_ADAPTER__?: RendererHostAdapter;
  }
}

let hostAdapterOverride: RendererHostAdapter | null = null;

export function setRendererHostAdapter(adapter: RendererHostAdapter | null): void {
  hostAdapterOverride = adapter;
}

export function getRendererHostAdapter(): RendererHostAdapter {
  if (hostAdapterOverride) {
    return hostAdapterOverride;
  }
  if (window.__OPENCLAW_RENDERER_HOST_ADAPTER__) {
    return window.__OPENCLAW_RENDERER_HOST_ADAPTER__;
  }
  if (window.electronAPI) {
    return electronRendererHostAdapter;
  }
  throw new Error("No renderer host adapter configured");
}
