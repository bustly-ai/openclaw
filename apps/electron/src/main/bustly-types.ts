export type BustlySupabaseConfig = {
  url: string;
  anonKey: string;
};

export type BustlyOAuthUser = {
  userId: string;
  userName: string;
  userEmail: string;
  userAccessToken?: string;
  userRefreshToken?: string;
  sessionExpiresIn?: number;
  sessionExpiresAt?: number;
  sessionTokenType?: string;
  workspaceId: string;
  skills: string[];
};

export type BustlyOAuthState = {
  loginTraceId?: string;
  deviceId: string;
  callbackPort: number;
  authCode?: string;
  expiresAt?: number;
  user?: BustlyOAuthUser;
  loggedInAt?: number;
  supabase?: BustlySupabaseConfig;
};
