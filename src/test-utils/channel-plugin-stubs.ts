import {
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "../channels/plugins/config-helpers.js";
import {
  normalizeSlackMessagingTarget,
  looksLikeSlackTargetId,
} from "../channels/plugins/normalize/slack.js";
import {
  looksLikeTelegramTargetId,
  normalizeTelegramMessagingTarget,
} from "../channels/plugins/normalize/telegram.js";
import {
  looksLikeWhatsAppTargetId,
  normalizeWhatsAppMessagingTarget,
} from "../channels/plugins/normalize/whatsapp.js";
import { slackOutbound } from "../channels/plugins/outbound/slack.js";
import { telegramOutbound } from "../channels/plugins/outbound/telegram.js";
import { whatsappOutbound } from "../channels/plugins/outbound/whatsapp.js";
import {
  applyAccountNameToChannelSection,
  migrateBaseNameToDefaultAccount,
} from "../channels/plugins/setup-helpers.js";
import { collectDiscordStatusIssues } from "../channels/plugins/status-issues/discord.js";
import { collectTelegramStatusIssues } from "../channels/plugins/status-issues/telegram.js";
import { collectWhatsAppStatusIssues } from "../channels/plugins/status-issues/whatsapp.js";
import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  ChannelSetupInput,
} from "../channels/plugins/types.js";
import { resolveWhatsAppHeartbeatRecipients } from "../channels/plugins/whatsapp-heartbeat.js";
import type { OpenClawConfig } from "../config/config.js";
import { collectStatusIssuesFromLastError } from "../plugin-sdk/status-helpers.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";
import {
  listTelegramAccountIds,
  resolveDefaultTelegramAccountId,
  resolveTelegramAccount,
} from "../telegram/accounts.js";
import { probeTelegram } from "../telegram/probe.js";
import { createChannelTestPluginBase } from "./channel-plugins.js";

type ChannelSection = Record<string, unknown> & {
  accounts?: Record<string, Record<string, unknown>>;
};

function readChannelSection(cfg: OpenClawConfig, sectionKey: string): ChannelSection | undefined {
  const section = (cfg.channels as Record<string, unknown> | undefined)?.[sectionKey];
  if (!section || typeof section !== "object") {
    return undefined;
  }
  return section as ChannelSection;
}

function hasBaseFields(section?: ChannelSection): boolean {
  if (!section) {
    return false;
  }
  return Object.entries(section).some(([key, value]) => key !== "accounts" && value !== undefined);
}

function listSectionAccountIds(cfg: OpenClawConfig, sectionKey: string): string[] {
  const section = readChannelSection(cfg, sectionKey);
  if (!section) {
    return [];
  }

  const ids = new Set<string>();
  for (const key of Object.keys(section.accounts ?? {})) {
    ids.add(normalizeAccountId(key));
  }
  if (hasBaseFields(section)) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  return [...ids].toSorted((a, b) => a.localeCompare(b));
}

function resolveSectionAccount(
  cfg: OpenClawConfig,
  sectionKey: string,
  accountId?: string | null,
): Record<string, unknown> {
  const normalizedAccountId = normalizeAccountId(accountId);
  const section = readChannelSection(cfg, sectionKey);
  const { accounts: _ignored, ...base } = section ?? {};
  const account = section?.accounts?.[normalizedAccountId] ?? {};
  return {
    ...base,
    ...account,
    accountId: normalizedAccountId,
  };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value
    .map((entry) => String(entry).trim())
    .filter((entry): entry is string => Boolean(entry));
  return entries.length > 0 ? entries : undefined;
}

function hasMeaningfulWhatsAppConfig(account: Record<string, unknown>): boolean {
  return Object.entries(account).some(([key, value]) => {
    if (value === undefined) {
      return false;
    }
    return key !== "accountId" && key !== "allowFrom" && key !== "enabled" && key !== "name";
  });
}

function normalizeTelegramConfigAliases(cfg: OpenClawConfig): OpenClawConfig {
  const telegram = cfg.channels?.telegram;
  if (!telegram) {
    return cfg;
  }

  const nextTelegram = { ...telegram };
  if (typeof telegram.token === "string" && !telegram.botToken) {
    nextTelegram.botToken = telegram.token;
  }
  if (telegram.accounts && typeof telegram.accounts === "object") {
    nextTelegram.accounts = Object.fromEntries(
      Object.entries(telegram.accounts).map(([accountId, account]) => {
        if (
          account &&
          typeof account === "object" &&
          typeof account.token === "string" &&
          !(account as { botToken?: unknown }).botToken
        ) {
          return [accountId, { ...account, botToken: account.token }];
        }
        return [accountId, account];
      }),
    );
  }

  return {
    ...cfg,
    channels: {
      ...(cfg.channels ?? {}),
      telegram: nextTelegram,
    },
  } as OpenClawConfig;
}

function writeAccountFieldsToSection(params: {
  cfg: OpenClawConfig;
  sectionKey: string;
  accountId?: string | null;
  fields: Record<string, unknown>;
  alwaysUseAccounts?: boolean;
}): OpenClawConfig {
  const normalizedAccountId = normalizeAccountId(params.accountId);
  let cfg = params.cfg;
  if (normalizedAccountId !== DEFAULT_ACCOUNT_ID) {
    cfg = migrateBaseNameToDefaultAccount({
      cfg,
      channelKey: params.sectionKey,
    });
  }

  const section = readChannelSection(cfg, params.sectionKey) ?? {};
  const baseAccounts = section.accounts ?? {};
  const hasAccounts = Object.keys(baseAccounts).length > 0;
  const useAccounts =
    params.alwaysUseAccounts === true || normalizedAccountId !== DEFAULT_ACCOUNT_ID || hasAccounts;
  const { accounts: _ignored, ...base } = section;
  const channels = cfg.channels ?? {};

  if (!useAccounts && normalizedAccountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...channels,
        [params.sectionKey]: {
          ...base,
          ...params.fields,
          enabled: true,
        },
      },
    } as OpenClawConfig;
  }

  return {
    ...cfg,
    channels: {
      ...channels,
      [params.sectionKey]: {
        ...base,
        enabled: true,
        accounts: {
          ...baseAccounts,
          [normalizedAccountId]: {
            ...(baseAccounts[normalizedAccountId] ?? {}),
            ...params.fields,
            enabled: true,
          },
        },
      },
    },
  } as OpenClawConfig;
}

function applyConfiguredAccount(params: {
  cfg: OpenClawConfig;
  sectionKey: string;
  accountId?: string | null;
  input: ChannelSetupInput;
  fields: Record<string, unknown>;
  alwaysUseAccounts?: boolean;
}): OpenClawConfig {
  let next = writeAccountFieldsToSection({
    cfg: params.cfg,
    sectionKey: params.sectionKey,
    accountId: params.accountId,
    fields: params.fields,
    alwaysUseAccounts: params.alwaysUseAccounts,
  });
  if (params.input.name?.trim()) {
    next = applyAccountNameToChannelSection({
      cfg: next,
      channelKey: params.sectionKey,
      accountId: normalizeAccountId(params.accountId),
      name: params.input.name,
      alwaysUseAccounts: params.alwaysUseAccounts,
    });
  }
  return next;
}

function createSectionPlugin(params: {
  id: "discord" | "signal" | "slack" | "whatsapp";
  label: string;
  selectionLabel?: string;
  docsPath?: string;
  isConfigured: (account: Record<string, unknown>) => boolean;
  applyAccountConfig: (
    cfg: OpenClawConfig,
    accountId: string,
    input: ChannelSetupInput,
  ) => OpenClawConfig;
  collectStatusIssues?: (
    accounts: ChannelAccountSnapshot[],
  ) => ReturnType<typeof collectStatusIssuesFromLastError>;
  outbound?: ChannelPlugin["outbound"];
  messaging?: ChannelPlugin["messaging"];
  heartbeat?: ChannelPlugin["heartbeat"];
  resolveAllowFrom?: (cfg: OpenClawConfig, accountId?: string | null) => string[] | undefined;
}): ChannelPlugin {
  const base = createChannelTestPluginBase({
    id: params.id,
    label: params.label,
    docsPath: params.docsPath,
    capabilities: { chatTypes: ["direct", "group"], media: true },
  });

  return {
    ...base,
    meta: {
      ...base.meta,
      selectionLabel: params.selectionLabel ?? params.label,
    },
    config: {
      listAccountIds: (cfg) => listSectionAccountIds(cfg, params.id),
      resolveAccount: (cfg, accountId) => resolveSectionAccount(cfg, params.id, accountId),
      isConfigured: (account) =>
        params.isConfigured((account as Record<string, unknown> | null) ?? {}),
      isEnabled: (account) => (account as { enabled?: boolean } | null)?.enabled !== false,
      ...(params.resolveAllowFrom
        ? {
            resolveAllowFrom: ({
              cfg,
              accountId,
            }: {
              cfg: OpenClawConfig;
              accountId?: string | null;
            }) => params.resolveAllowFrom?.(cfg, accountId),
          }
        : {}),
      setAccountEnabled: ({ cfg, accountId, enabled }) =>
        setAccountEnabledInConfigSection({
          cfg,
          sectionKey: params.id,
          accountId: accountId ?? DEFAULT_ACCOUNT_ID,
          enabled,
          allowTopLevel: true,
        }),
      deleteAccount: ({ cfg, accountId }) =>
        deleteAccountFromConfigSection({
          cfg,
          sectionKey: params.id,
          accountId: accountId ?? DEFAULT_ACCOUNT_ID,
          clearBaseFields: [
            "token",
            "botToken",
            "appToken",
            "account",
            "allowFrom",
            "name",
            "enabled",
          ],
        }),
    },
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }) =>
        params.applyAccountConfig(cfg, accountId, input),
      applyAccountName: ({ cfg, accountId, name }) =>
        applyAccountNameToChannelSection({
          cfg,
          channelKey: params.id,
          accountId,
          name,
        }),
    },
    ...(params.collectStatusIssues
      ? {
          status: {
            collectStatusIssues: params.collectStatusIssues,
          },
        }
      : {}),
    ...(params.outbound ? { outbound: params.outbound } : {}),
    ...(params.heartbeat ? { heartbeat: params.heartbeat } : {}),
    ...(params.messaging ? { messaging: params.messaging } : {}),
  } as ChannelPlugin;
}

export function createDiscordTestPlugin(): ChannelPlugin {
  return createSectionPlugin({
    id: "discord",
    label: "Discord",
    docsPath: "/channels/discord",
    isConfigured: (account) => typeof account.token === "string" && account.token.trim().length > 0,
    applyAccountConfig: (cfg, accountId, input) =>
      applyConfiguredAccount({
        cfg,
        sectionKey: "discord",
        accountId,
        input,
        fields: {
          token: input.token,
        },
      }),
    collectStatusIssues: collectDiscordStatusIssues,
  });
}

export function createSignalTestPlugin(): ChannelPlugin {
  return createSectionPlugin({
    id: "signal",
    label: "Signal",
    docsPath: "/channels/signal",
    isConfigured: (account) =>
      typeof account.account === "string" && account.account.trim().length > 0,
    applyAccountConfig: (cfg, accountId, input) =>
      applyConfiguredAccount({
        cfg,
        sectionKey: "signal",
        accountId,
        input,
        fields: {
          account: input.signalNumber,
        },
      }),
    collectStatusIssues: (accounts) =>
      collectStatusIssuesFromLastError(
        "signal",
        accounts as Array<{ accountId: string; lastError?: unknown }>,
      ),
  });
}

export function createSlackTestPlugin(): ChannelPlugin {
  return createSectionPlugin({
    id: "slack",
    label: "Slack",
    docsPath: "/channels/slack",
    isConfigured: (account) =>
      (typeof account.botToken === "string" && account.botToken.trim().length > 0) ||
      (typeof account.appToken === "string" && account.appToken.trim().length > 0),
    applyAccountConfig: (cfg, accountId, input) =>
      applyConfiguredAccount({
        cfg,
        sectionKey: "slack",
        accountId,
        input,
        fields: {
          botToken: input.botToken,
          appToken: input.appToken,
        },
      }),
    outbound: slackOutbound,
    messaging: {
      normalizeTarget: normalizeSlackMessagingTarget,
      targetResolver: {
        looksLikeId: looksLikeSlackTargetId,
        hint: "<channel:ID|user:ID>",
      },
    },
  });
}

export function createTelegramTestPlugin(): ChannelPlugin {
  const base = createChannelTestPluginBase({
    id: "telegram",
    label: "Telegram",
    docsPath: "/channels/telegram",
    capabilities: { chatTypes: ["direct", "group"], media: true },
  });

  return {
    ...base,
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      defaultAccountId: (cfg) => resolveDefaultTelegramAccountId(cfg),
      resolveAccount: (cfg, accountId) =>
        resolveTelegramAccount({ cfg: normalizeTelegramConfigAliases(cfg), accountId }),
      isConfigured: (account) =>
        ((account as { tokenSource?: string } | null)?.tokenSource ?? "none") !== "none",
      isEnabled: (account) => (account as { enabled?: boolean } | null)?.enabled !== false,
      setAccountEnabled: ({ cfg, accountId, enabled }) =>
        setAccountEnabledInConfigSection({
          cfg,
          sectionKey: "telegram",
          accountId: accountId ?? DEFAULT_ACCOUNT_ID,
          enabled,
          allowTopLevel: true,
        }),
      deleteAccount: ({ cfg, accountId }) =>
        deleteAccountFromConfigSection({
          cfg,
          sectionKey: "telegram",
          accountId: accountId ?? DEFAULT_ACCOUNT_ID,
          clearBaseFields: ["botToken", "tokenFile", "name", "enabled"],
        }),
    },
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }) =>
        applyConfiguredAccount({
          cfg,
          sectionKey: "telegram",
          accountId,
          input,
          fields: {
            botToken: input.token ?? input.botToken,
            tokenFile: input.tokenFile,
          },
        }),
      applyAccountName: ({ cfg, accountId, name }) =>
        applyAccountNameToChannelSection({
          cfg,
          channelKey: "telegram",
          accountId,
          name,
        }),
    },
    status: {
      probeAccount: async ({ account, timeoutMs }) => {
        const token = (account as { token?: string }).token ?? "";
        return await probeTelegram(token, timeoutMs);
      },
      collectStatusIssues: collectTelegramStatusIssues,
    },
    outbound: telegramOutbound,
    messaging: {
      normalizeTarget: normalizeTelegramMessagingTarget,
      targetResolver: {
        looksLikeId: looksLikeTelegramTargetId,
        hint: "<chatId|@username>",
      },
    },
  } as ChannelPlugin;
}

export function createWhatsAppTestPlugin(): ChannelPlugin {
  return createSectionPlugin({
    id: "whatsapp",
    label: "WhatsApp",
    selectionLabel: "WhatsApp Web",
    docsPath: "/channels/whatsapp",
    // Keep allowFrom-only setups unconfigured so tests still model
    // "linked runtime required" behavior for default channel selection.
    isConfigured: (account) => hasMeaningfulWhatsAppConfig(account),
    applyAccountConfig: (cfg, accountId, input) =>
      applyConfiguredAccount({
        cfg,
        sectionKey: "whatsapp",
        accountId,
        input,
        fields: {
          allowFrom: toStringArray(input.dmAllowlist),
        },
      }),
    collectStatusIssues: collectWhatsAppStatusIssues,
    outbound: whatsappOutbound,
    messaging: {
      normalizeTarget: normalizeWhatsAppMessagingTarget,
      targetResolver: {
        looksLikeId: looksLikeWhatsAppTargetId,
        hint: "<E.164|group JID>",
      },
    },
    resolveAllowFrom: (cfg, accountId) => {
      const account = resolveSectionAccount(cfg, "whatsapp", accountId);
      return toStringArray(account.allowFrom);
    },
    heartbeat: {
      checkReady: async ({ deps }) => {
        const linked = (await deps?.webAuthExists?.()) ?? true;
        const listenerActive = deps?.hasActiveWebListener?.() ?? true;
        return linked && listenerActive
          ? { ok: true, reason: "ready" }
          : { ok: false, reason: "whatsapp-not-linked" };
      },
      resolveRecipients: ({ cfg, opts }) => resolveWhatsAppHeartbeatRecipients(cfg, opts),
    },
  });
}
