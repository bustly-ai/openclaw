/**
 * TypeScript declarations for the electronAPI exposed via contextBridge
 */

interface PresetConfigOptions {
  /** Gateway port (default: 17999) */
  gatewayPort?: number;
  /** Gateway bind address (default: "loopback") */
  gatewayBind?: "loopback" | "lan" | "auto";
  /** Workspace directory (default: "$OPENCLAW_STATE_DIR/workspace", fallback "~/.bustly/workspace") */
  workspace?: string;
  /** Node manager for skills (default: "pnpm") */
  nodeManager?: "npm" | "pnpm" | "bun";
  /** OpenRouter API key for minimax model */
  openrouterApiKey?: string;
}

interface InitializationResult {
  success: boolean;
  configPath: string;
  gatewayPort: number;
  gatewayBind: string;
  workspace: string;
  error?: string;
}

interface GatewayStatus {
  running: boolean;
  pid: number | null;
  port: number;
  host: string;
  bind: string;
  wsUrl: string; // No token when auth is disabled
  initialized: boolean;
}

interface GatewayConnectConfig {
  wsUrl: string;
  token: string | null;
  host: string;
  port: number;
}

interface ChatContextPathSelection {
  path: string;
  name: string;
  kind: "file" | "directory";
  imageUrl?: string;
}

interface AppInfo {
  version: string;
  name: string;
  electronVersion: string;
  nodeVersion: string;
}

interface GatewayLogData {
  stream: "stdout" | "stderr";
  message: string;
}

interface GatewayExitData {
  code: number | null;
  signal: string | null;
}
interface GatewayLifecycleData {
  phase: "starting" | "stopping" | "ready" | "error";
  message: string | null;
  canRestoreLastGoodConfig: boolean;
}
interface MainLogData {
  message: string;
}
interface DeepLinkData {
  url: string;
  route: string | null;
  workspaceId: string | null;
}

interface DesktopUpdateState {
  sessionId: string | null;
  stage:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "launching-helper"
    | "downloading"
    | "preparing"
    | "downloaded"
    | "installing"
    | "restarted"
    | "error";
  currentVersion: string;
  targetVersion: string | null;
  ready: boolean;
  helperActive: boolean;
  progressPercent: number | null;
  transferred: number | null;
  total: number | null;
  bytesPerSecond: number | null;
  message: string | null;
  error: string | null;
  updatedAt: number;
}

interface BustlyUserInfo {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  workspaceId: string;
  skills: string[];
}

interface BustlySupabaseConfig {
  url: string;
  anonKey: string;
  accessToken: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
}

interface BustlyWorkspaceAgent {
  agentId: string;
  agentName: string;
  name: string;
  icon?: string;
  isMain: boolean;
  createdAt: number | null;
  updatedAt: number | null;
}

interface BustlyWorkspaceAgentSession {
  agentId: string;
  sessionKey: string;
  name: string;
  icon?: string;
  updatedAt: number | null;
}

interface ElectronAPI {
  // OpenClaw initialization
  openclawInit: (options?: PresetConfigOptions) => Promise<InitializationResult>;
  openclawIsInitialized: () => Promise<boolean>;
  openclawNeedsOnboard: () => Promise<boolean>;

  // Gateway management
  gatewayStart: (apiKey?: string) => Promise<{ success: boolean; error?: string }>;
  gatewayStop: () => Promise<{ success: boolean; error?: string }>;
  gatewayRestoreLastGoodConfig: () => Promise<{ success: boolean; error?: string }>;
  gatewayStatus: () => Promise<GatewayStatus>;
  gatewayConnectConfig: () => Promise<GatewayConnectConfig>;
  gatewayPatchSession: (
    key: string,
    patch: { label?: string | null; icon?: string | null },
  ) => Promise<{ success: boolean; error?: string }>;
  gatewayPatchSessionLabel: (key: string, label: string) => Promise<{ success: boolean; error?: string }>;
  gatewayPatchSessionModel: (
    key: string,
    model: string,
  ) => Promise<{ success: boolean; model?: string; error?: string }>;
  gatewayDeleteSession: (key: string) => Promise<{ success: boolean; error?: string }>;
  resolvePastedPath: (params: {
    file?: File;
    entryPath?: string;
    entryName?: string;
    transferPaths?: string[];
    fallbackKind: "file" | "directory";
  }) => Promise<{ path: string; kind: "file" | "directory" | null }>;
  selectChatContextPaths: () => Promise<ChatContextPathSelection[]>;
  resolveChatImagePreview: (path: string) => Promise<string | null>;
  resolveChatMediaPreview: (path: string) => Promise<{
    dataUrl: string;
    mimeType: string;
    kind: "image" | "video" | "audio";
  } | null>;
  openLocalPath: (path: string) => Promise<{ success: boolean; error?: string }>;
  getAppInfo: () => Promise<AppInfo>;
  getNativeFullscreenStatus: () => Promise<{ isNativeFullscreen: boolean }>;

  // Onboarding
  bustlyLogin: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
  bustlyCancelLogin: () => Promise<{ success: boolean; error?: string }>;
  bustlyIsLoggedIn: () => Promise<boolean>;
  bustlyGetUserInfo: () => Promise<BustlyUserInfo | null>;
  bustlyGetSupabaseConfig: () => Promise<BustlySupabaseConfig | null>;
  bustlySetActiveWorkspace: (
    workspaceId: string,
    workspaceName?: string,
  ) => Promise<{ success: boolean; agentId?: string; error?: string }>;
  bustlyListAgents: (workspaceId?: string) => Promise<BustlyWorkspaceAgent[]>;
  bustlyListAgentSessions: (workspaceId: string, agentId: string) => Promise<BustlyWorkspaceAgentSession[]>;
  bustlyCreateAgent: (
    workspaceId: string,
    name: string,
    icon?: string,
    workspaceName?: string,
  ) => Promise<{ success: boolean; agentId?: string; error?: string }>;
  bustlyCreateAgentSession: (params: {
    workspaceId: string;
    agentId: string;
    label?: string;
    promptExcerpt?: string;
    sampleRouteKey?: string;
  }) => Promise<{ success: boolean; sessionKey?: string; error?: string }>;
  bustlyUpdateAgent: (params: {
    workspaceId: string;
    agentId: string;
    name?: string;
    icon?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  bustlyDeleteAgent: (params: {
    workspaceId: string;
    agentId: string;
  }) => Promise<{ success: boolean; error?: string }>;
  bustlyLogout: () => Promise<{ success: boolean; error?: string }>;
  bustlyOpenLogin: () => Promise<{ success: boolean; error?: string }>;
  bustlyOpenSettings: () => Promise<{ success: boolean; error?: string }>;
  bustlyReportIssue: () => Promise<{ success: boolean; archivePath?: string; error?: string }>;
  bustlyOpenWorkspaceSettings: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceInvite: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceManage: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspacePricing: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  bustlyOpenWorkspaceCreate: (workspaceId?: string) => Promise<{ success: boolean; error?: string }>;
  updaterCheck: () => Promise<{ success: boolean; error?: string }>;
  updaterStartInstall: () => Promise<{ success: boolean; error?: string }>;
  updaterInstall: () => Promise<{ success: boolean; error?: string }>;
  updaterStatus: () => Promise<{ ready: boolean; version?: string | null; state: DesktopUpdateState }>;
  consumePendingDeepLink: () => Promise<DeepLinkData | null>;

  // Event listeners
  onGatewayLog: (callback: (data: GatewayLogData) => void) => () => void;
  onGatewayExit: (callback: (data: GatewayExitData) => void) => () => void;
  onGatewayLifecycle: (callback: (data: GatewayLifecycleData) => void) => () => void;
  onMainLog: (callback: (data: MainLogData) => void) => () => void;
  onBustlyLoginRefresh: (callback: () => void) => () => void;
  onUpdateStatus: (callback: (data: { event: string; state?: DesktopUpdateState }) => void) => () => void;
  onNativeFullscreenChange: (callback: (data: { isNativeFullscreen: boolean }) => void) => () => void;
  onDeepLink: (callback: (data: DeepLinkData) => void) => () => void;
  onBustlySessionLabelUpdated: (
    callback: (data: { agentId: string; sessionKey: string; label: string; updatedAt: number | null }) => void,
  ) => () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
