import type { OpenClawConfig } from "../config/config.js";

export type ResolveSenderCommandAuthorizationParams = {
  cfg: OpenClawConfig;
  rawBody: string;
  isGroup: boolean;
  dmPolicy: string;
  configuredAllowFrom: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
  readAllowFromStore: () => Promise<string[]>;
  shouldComputeCommandAuthorized: (rawBody: string, cfg: OpenClawConfig) => boolean;
  resolveCommandAuthorizedFromAuthorizers: (params: {
    useAccessGroups: boolean;
    authorizers: Array<{ configured: boolean; allowed: boolean }>;
  }) => boolean;
};

export type CommandAuthorizationRuntime = {
  shouldComputeCommandAuthorized: (rawBody: string, cfg: OpenClawConfig) => boolean;
  resolveCommandAuthorizedFromAuthorizers: (params: {
    useAccessGroups: boolean;
    authorizers: Array<{ configured: boolean; allowed: boolean }>;
  }) => boolean;
};

export type ResolveSenderCommandAuthorizationWithRuntimeParams = Omit<
  ResolveSenderCommandAuthorizationParams,
  "shouldComputeCommandAuthorized" | "resolveCommandAuthorizedFromAuthorizers"
> & {
  runtime: CommandAuthorizationRuntime;
};

export async function resolveSenderCommandAuthorization(
  params: ResolveSenderCommandAuthorizationParams,
): Promise<{
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}> {
  const shouldComputeAuth = params.shouldComputeCommandAuthorized(params.rawBody, params.cfg);
  const storeAllowFrom =
    !params.isGroup &&
    params.dmPolicy !== "allowlist" &&
    (params.dmPolicy !== "open" || shouldComputeAuth)
      ? await params.readAllowFromStore().catch(() => [])
      : [];
  const effectiveAllowFrom = [...params.configuredAllowFrom, ...storeAllowFrom];
  const useAccessGroups = params.cfg.commands?.useAccessGroups !== false;
  const senderAllowedForCommands = params.isSenderAllowed(params.senderId, effectiveAllowFrom);
  const commandAuthorized = shouldComputeAuth
    ? params.resolveCommandAuthorizedFromAuthorizers({
        useAccessGroups,
        authorizers: [
          { configured: effectiveAllowFrom.length > 0, allowed: senderAllowedForCommands },
        ],
      })
    : undefined;

  return {
    shouldComputeAuth,
    effectiveAllowFrom,
    senderAllowedForCommands,
    commandAuthorized,
  };
}

export async function resolveSenderCommandAuthorizationWithRuntime(
  params: ResolveSenderCommandAuthorizationWithRuntimeParams,
): ReturnType<typeof resolveSenderCommandAuthorization> {
  return resolveSenderCommandAuthorization({
    ...params,
    shouldComputeCommandAuthorized: params.runtime.shouldComputeCommandAuthorized,
    resolveCommandAuthorizedFromAuthorizers: params.runtime.resolveCommandAuthorizedFromAuthorizers,
  });
}
