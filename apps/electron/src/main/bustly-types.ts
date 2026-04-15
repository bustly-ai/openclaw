export type BustlySupabaseConfig = {
  url: string;
  anonKey: string;
};

export type BustlySessionContract = {
  bustlySessionId?: string;
  supabaseAccessToken?: string;
  supabaseAccessTokenExpiresAt?: number;
  bustlyRefreshToken?: string;
  legacySupabaseRefreshToken?: string;
  capabilities?: string[];
};

export type BustlyOAuthUser = BustlySessionContract & {
  userAccessToken?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  workspaceId: string;
  skills: string[];
};

export type BustlyOAuthLegacyAuthFields = {
  userAccessToken?: string;
  userRefreshToken?: string;
  sessionExpiresIn?: number;
  sessionExpiresAt?: number;
  sessionTokenType?: string;
};

export type BustlyOAuthUserLegacy = BustlyOAuthUser & BustlyOAuthLegacyAuthFields;

export type BustlyOAuthStateLegacy = Omit<BustlyOAuthState, "user"> & {
  user?: BustlyOAuthUserLegacy;
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

function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toPositiveFiniteNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function normalizeBustlyOAuthState(
  state: BustlyOAuthState | BustlyOAuthStateLegacy | null | undefined,
): BustlyOAuthState | null {
  if (!state?.user) {
    return state ?? null;
  }

  const currentUser = state.user;
  const legacyUser = currentUser as BustlyOAuthUserLegacy;
  const {
    userRefreshToken: _legacyRefreshToken,
    sessionExpiresIn: _legacySessionExpiresIn,
    sessionExpiresAt: _legacySessionExpiresAt,
    sessionTokenType: _legacySessionTokenType,
    ...v13SafeUser
  } = legacyUser;
  const nextSupabaseAccessToken =
    trimToUndefined(currentUser.supabaseAccessToken) ?? trimToUndefined(legacyUser.userAccessToken);
  const nextSupabaseAccessTokenExpiresAt =
    toPositiveFiniteNumber(currentUser.supabaseAccessTokenExpiresAt) ??
    toPositiveFiniteNumber(legacyUser.sessionExpiresAt);
  const nextBustlySessionId = trimToUndefined(currentUser.bustlySessionId);
  const nextBustlyRefreshToken = trimToUndefined(currentUser.bustlyRefreshToken);
  const nextLegacySupabaseRefreshToken =
    trimToUndefined(currentUser.legacySupabaseRefreshToken) ?? trimToUndefined(legacyUser.userRefreshToken);
  const nextUserAccessToken = nextSupabaseAccessToken;
  const hasLegacyAuthFields = Boolean(
    _legacyRefreshToken || _legacySessionExpiresIn || _legacySessionExpiresAt || _legacySessionTokenType,
  );

  if (
    !hasLegacyAuthFields &&
    nextSupabaseAccessToken === currentUser.supabaseAccessToken &&
    nextSupabaseAccessTokenExpiresAt === currentUser.supabaseAccessTokenExpiresAt &&
    nextBustlySessionId === currentUser.bustlySessionId &&
    nextBustlyRefreshToken === currentUser.bustlyRefreshToken &&
    nextLegacySupabaseRefreshToken === currentUser.legacySupabaseRefreshToken &&
    nextUserAccessToken === currentUser.userAccessToken
  ) {
    return state;
  }

  return {
    ...state,
    user: {
      ...v13SafeUser,
      userAccessToken: nextUserAccessToken,
      bustlySessionId: nextBustlySessionId,
      supabaseAccessToken: nextSupabaseAccessToken,
      supabaseAccessTokenExpiresAt: nextSupabaseAccessTokenExpiresAt,
      bustlyRefreshToken: nextBustlyRefreshToken,
      legacySupabaseRefreshToken: nextLegacySupabaseRefreshToken,
    },
  };
}
