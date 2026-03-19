const REMOTE_TEMPLATE_ENV_KEY = "BUSTLY_WORKSPACE_TEMPLATE_BASE_URL";

function logRemoteTemplate(message: string, extra?: unknown) {
  if (extra === undefined) {
    console.log(`[Bustly Prompts] ${message}`);
    return;
  }
  console.log(`[Bustly Prompts] ${message}`, extra);
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, "");
}

export function resolveRemoteWorkspaceTemplateBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return normalizeBaseUrl(env[REMOTE_TEMPLATE_ENV_KEY]);
}

export function buildRemoteWorkspaceTemplateSourceKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveRemoteWorkspaceTemplateBaseUrl(env) ?? "local";
}

export async function loadRemoteWorkspaceTemplate(
  name: string,
  opts?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  },
): Promise<string | undefined> {
  const env = opts?.env ?? process.env;
  const baseUrl = resolveRemoteWorkspaceTemplateBaseUrl(env);
  if (!baseUrl) {
    return undefined;
  }

  const fetchImpl =
    opts?.fetchImpl ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
  const targetUrl = `${baseUrl}/${encodeURIComponent(name)}`;

  if (!fetchImpl) {
    logRemoteTemplate(`fetch unavailable for remote template ${name}; falling back to local template`);
    return undefined;
  }

  try {
    logRemoteTemplate(`fetching remote template ${name}`, { url: targetUrl });
    const response = await fetchImpl(targetUrl);
    if (!response.ok) {
      throw new Error(`Remote workspace template fetch failed: ${response.status} ${response.statusText}`);
    }
    const content = await response.text();
    logRemoteTemplate(`fetched remote template ${name}`, { url: targetUrl });
    return content;
  } catch (error) {
    logRemoteTemplate(`remote fetch failed for ${name}, falling back to local template`, {
      url: targetUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
