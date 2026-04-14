function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function resolveBustlyAccountApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = trimEnv(env.BUSTLY_ACCOUNT_API_BASE_URL) || trimEnv(env.BUSTLY_API_BASE_URL);
  if (!baseUrl) {
    throw new Error("Missing Bustly account API base URL");
  }
  return baseUrl.replace(/\/+$/, "");
}

export function resolveBustlyAccountWebBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = trimEnv(env.BUSTLY_ACCOUNT_WEB_BASE_URL) || trimEnv(env.BUSTLY_WEB_BASE_URL);
  if (!baseUrl) {
    throw new Error("Missing Bustly web base URL");
  }
  return baseUrl.replace(/\/+$/, "");
}
