import type { OpenClawConfig } from "../config/config.js";
import type { PluginRuntime } from "../plugins/runtime/types.js";

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

export type ResolveSenderCommandAuthorizationWithRuntimeParams = Omit<
  ResolveSenderCommandAuthorizationParams,
  "shouldComputeCommandAuthorized" | "resolveCommandAuthorizedFromAuthorizers"
> & {
  configuredGroupAllowFrom?: string[];
  runtime: PluginRuntime["channel"]["commands"];
};

export async function resolveSenderCommandAuthorizationWithRuntime(
  params: ResolveSenderCommandAuthorizationWithRuntimeParams,
): Promise<{
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}> {
  return await resolveSenderCommandAuthorization({
    cfg: params.cfg,
    rawBody: params.rawBody,
    isGroup: params.isGroup,
    dmPolicy: params.dmPolicy,
    configuredAllowFrom: params.configuredAllowFrom,
    senderId: params.senderId,
    isSenderAllowed: params.isSenderAllowed,
    readAllowFromStore: params.readAllowFromStore,
    shouldComputeCommandAuthorized: params.runtime.shouldComputeCommandAuthorized,
    resolveCommandAuthorizedFromAuthorizers:
      params.runtime.resolveCommandAuthorizedFromAuthorizers,
  });
}

export type DirectDmAuthorizationOutcome = "authorized" | "unauthorized" | "disabled";

export function resolveDirectDmAuthorizationOutcome(params: {
  isGroup: boolean;
  dmPolicy: string;
  senderAllowedForCommands: boolean;
}): DirectDmAuthorizationOutcome {
  if (params.isGroup || params.dmPolicy === "disabled") {
    return "disabled";
  }
  if (params.dmPolicy === "open") {
    return "authorized";
  }
  return params.senderAllowedForCommands ? "authorized" : "unauthorized";
}
