import type { RendererHostAdapter } from "./host";

export type CloudGatewayConnection = {
  wsUrl: string;
  token?: string | null;
  host?: string;
  port?: number;
};

export type CloudHostAppInfo = Pick<AppInfo, "name" | "version"> & Partial<AppInfo>;

export type CloudHostAdapterOptions = {
  getGatewayConnection: () => Promise<CloudGatewayConnection>;
  auth: {
    isLoggedIn: () => Promise<boolean>;
    getUserInfo: () => Promise<BustlyUserInfo | null>;
    startLogin: () => Promise<{ loginTraceId: string }>;
    pollLogin: (loginTraceId: string) => Promise<{ pending: boolean }>;
    cancelLogin: (loginTraceId?: string) => Promise<void>;
    logout: () => Promise<void>;
  };
  appInfo?: CloudHostAppInfo;
};

export function createCloudRendererHostAdapter(options: CloudHostAdapterOptions): RendererHostAdapter {
  const defaultAppInfo: AppInfo = {
    name: options.appInfo?.name ?? "OpenClaw",
    version: options.appInfo?.version ?? "cloud",
    electronVersion: options.appInfo?.electronVersion ?? "cloud",
    nodeVersion: options.appInfo?.nodeVersion ?? "cloud",
  };
  const LOGIN_STATE_POLL_MS = 1_000;

  return {
    platform: "cloud",
    gatewayStatus: async () => {
      const connection = await options.getGatewayConnection();
      const wsUrl = connection.wsUrl.trim();
      const parsed = new URL(wsUrl);
      const port = connection.port ?? Number(parsed.port || (parsed.protocol === "wss:" ? "443" : "80"));
      const host = connection.host?.trim() || parsed.hostname;
      return {
        running: true,
        pid: null,
        port,
        host,
        bind: "cloud",
        wsUrl,
        initialized: true,
      };
    },
    gatewayStart: async () => ({ success: true }),
    gatewayConnectConfig: async () => {
      const connection = await options.getGatewayConnection();
      const wsUrl = connection.wsUrl.trim();
      const parsed = new URL(wsUrl);
      const port = connection.port ?? Number(parsed.port || (parsed.protocol === "wss:" ? "443" : "80"));
      const host = connection.host?.trim() || parsed.hostname;
      return {
        wsUrl,
        token: connection.token?.trim() || null,
        host,
        port,
      };
    },
    gatewayRestoreLastGoodConfig: async () => ({ success: false, error: "Not supported in cloud host" }),
    openclawInit: async () => ({
      success: true,
      configPath: "cloud",
      gatewayPort: 0,
      gatewayBind: "cloud",
      workspace: "cloud",
    }),
    openclawIsInitialized: async () => true,
    getAppInfo: async () => defaultAppInfo,
    bustlyIsLoggedIn: async () => ({ success: true, loggedIn: await options.auth.isLoggedIn() }),
    bustlyLogin: async () => {
      const result = await options.auth.startLogin();
      return { success: true, loginTraceId: result.loginTraceId };
    },
    bustlyPollLogin: async (loginTraceId: string) => {
      const status = await options.auth.pollLogin(loginTraceId);
      return { success: true, pending: status.pending };
    },
    bustlyCancelLogin: async (loginTraceId?: string) => {
      await options.auth.cancelLogin(loginTraceId);
      return { success: true };
    },
    bustlyGetUserInfo: async () => ({ success: true, user: await options.auth.getUserInfo() }),
    bustlyLogout: async () => {
      await options.auth.logout();
      return { success: true };
    },
    onBustlyLoginRefresh: (callback: () => void) => {
      let disposed = false;
      let lastKnown: boolean | null = null;

      const poll = async () => {
        if (disposed) {
          return;
        }
        try {
          const next = await options.auth.isLoggedIn();
          if (lastKnown === null) {
            lastKnown = next;
            return;
          }
          if (next !== lastKnown) {
            lastKnown = next;
            callback();
          }
        } catch {
          // Ignore auth probe errors in refresh polling.
        }
      };

      void poll();
      const timer = window.setInterval(() => {
        void poll();
      }, LOGIN_STATE_POLL_MS);

      return () => {
        disposed = true;
        window.clearInterval(timer);
      };
    },
  };
}
