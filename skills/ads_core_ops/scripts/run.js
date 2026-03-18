#!/usr/bin/env node
/**
 * Ads Core Ops CLI
 * Gateway Mode: Klaviyo, Google Ads
 * Direct Mode: Meta Ads
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  loadCredentials,
  saveCredentials,
  getCredentialsPath,
  sanitizeCredentials,
  validateMetaAdsCredentials,
} from "../src/credentials.js";
import { MetaAdsClient } from "../src/meta-ads.js";

const DEFAULT_ADS_OPS_FUNCTION = process.env.ADS_CORE_OPS_FUNCTION || "ads-core-ops";

function resolveUserPath(input, homeDir) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("~")) {
    return resolve(trimmed.replace(/^~(?=$|[\\/])/, homeDir));
  }
  return resolve(trimmed);
}

function resolveStateDir() {
  const homeDir = homedir();
  const override = process.env.BUSTLY_STATE_DIR?.trim() || process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) return resolveUserPath(override, homeDir);
  return resolve(homeDir, ".bustly");
}

function loadBustlyOauthConfig() {
  try {
    const configPath = resolve(resolveStateDir(), "bustlyOauth.json");
    if (!existsSync(configPath)) return null;
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    const user = raw?.user || {};
    const supabase = raw?.supabase || {};
    const legacy = raw?.bustlySearchData || {};

    return {
      supabaseUrl: supabase.url || legacy.SEARCH_DATA_SUPABASE_URL || "",
      supabaseAnonKey: supabase.anonKey || legacy.SEARCH_DATA_SUPABASE_ANON_KEY || "",
      supabaseToken:
        user.userAccessToken ||
        legacy.SEARCH_DATA_SUPABASE_ACCESS_TOKEN ||
        legacy.SEARCH_DATA_TOKEN ||
        "",
      workspaceId: user.workspaceId || legacy.SEARCH_DATA_WORKSPACE_ID || "",
      userId: user.userId || "",
    };
  } catch {
    return null;
  }
}

function hasWorkspaceContext() {
  const oauth = loadBustlyOauthConfig();
  return Boolean(
    oauth?.supabaseUrl &&
    oauth?.supabaseAnonKey &&
    oauth?.supabaseToken &&
    oauth?.workspaceId &&
    oauth?.userId,
  );
}

function getGatewayConfig() {
  return (
    loadBustlyOauthConfig() || {
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabaseToken: "",
      workspaceId: "",
      userId: "",
    }
  );
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");

    if (eqIndex !== -1) {
      flags[withoutPrefix.slice(0, eqIndex)] = withoutPrefix.slice(eqIndex + 1);
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[withoutPrefix] = true;
      continue;
    }

    flags[withoutPrefix] = next;
    i++;
  }

  return {
    command: positional[0] || "",
    subcommand: positional[1] || "",
    flags,
  };
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printError(message) {
  console.error(`❌ Error: ${message}`);
}

function getPlatformDisplayName(platform) {
  if (platform === "klaviyo") return "Klaviyo";
  if (platform === "google-ads") return "Google Ads";
  if (platform === "meta-ads") return "Meta Ads";
  return "This platform";
}

function normalizeGatewayError(message, platform) {
  const text = String(message || "");
  const displayName = getPlatformDisplayName(platform);
  const integrationMessage = `${displayName} is not connected for this workspace. Go to Bustly > Integrations and authorize it first.`;

  if (
    text.includes("not connected for this workspace") ||
    text.includes("connection ID is missing") ||
    text.includes("No access token found in Nango connection")
  ) {
    return integrationMessage;
  }

  return text;
}

function parseJsonFlag(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON flag value");
  }
}

function parseLimit(flags, fallback = 50) {
  return typeof flags.limit === "string" ? Number.parseInt(flags.limit, 10) : fallback;
}

async function callAdsCoreOpsFunction(config, payload) {
  const url = `${config.supabaseUrl}/functions/v1/${DEFAULT_ADS_OPS_FUNCTION}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.supabaseToken}`,
      apikey: config.supabaseAnonKey,
    },
    body: JSON.stringify({
      workspace_id: config.workspaceId,
      user_id: config.userId,
      ...payload,
    }),
  });

  const text = await response.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const rawMessage =
      typeof parsed === "object" && parsed && parsed.error
        ? parsed.error
        : `Edge function error (${response.status}): ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`;
    throw new Error(normalizeGatewayError(rawMessage, payload.platform));
  }

  if (parsed.error) throw new Error(normalizeGatewayError(parsed.error, payload.platform));
  return parsed.result;
}

function requireWorkspaceContext() {
  if (!hasWorkspaceContext()) {
    printError("未授权，请先完成授权");
    process.exit(1);
  }
  return getGatewayConfig();
}

async function callGatewayRead(platform, entity, options = {}) {
  const config = requireWorkspaceContext();
  return callAdsCoreOpsFunction(config, {
    action: "DIRECT_READ",
    platform,
    entity,
    limit: options.limit || 50,
    filters: options.filters || {},
    cursor: options.cursor || "",
  });
}

async function callGatewayRelay(platform, request) {
  const config = requireWorkspaceContext();
  return callAdsCoreOpsFunction(config, {
    action: "NATIVE_PROXY",
    platform,
    request,
  });
}

function buildRelayRequest(flags, fallbackMethod = "GET") {
  const method = String(flags.method || fallbackMethod).toUpperCase();
  const path = String(flags.path || "").trim();
  if (!path) throw new Error("--path is required");

  return {
    method,
    path,
    query: parseJsonFlag(flags.query, {}),
    headers: parseJsonFlag(flags.headers, {}),
    body: flags.body ? parseJsonFlag(flags.body, null) : null,
  };
}

function showHelp() {
  console.log(`
Ads Core Ops - Unified Advertising Operations CLI

Platform Modes:
  Klaviyo     Gateway Mode (via Supabase Edge Function)
  Google Ads  Gateway Mode (via Supabase Edge Function)
  Meta Ads    Direct Mode (via local API Key)

Usage:
  node scripts/run.js <command> [args]
  node scripts/run.js <platform> <command> [args]

Core Commands:
  platforms             List all supported platforms
  status                Show authorization status for each platform

Klaviyo Gateway Commands:
  profiles | lists | segments | campaigns | flows | metrics | events | templates
  raw --path /profiles --query '{"page[size]":20}'

Google Ads Gateway Commands:
  customers | campaigns | ad-groups | keywords | ads
  search --customer-id 123 --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
  raw --path /customers/123/googleAds:search --body '{"query":"SELECT campaign.id FROM campaign LIMIT 10"}'

Meta Ads Direct Commands:
  account | campaigns | adsets | ads | insights

Config Commands (Meta Ads only):
  config show
  config path
  config set-meta-ads <json>

Examples:
  node scripts/run.js klaviyo profiles --limit 20
  node scripts/run.js klaviyo raw --path /profiles --query '{"page[size]":20}'
  node scripts/run.js google-ads customers
  node scripts/run.js google-ads search --customer-id 1234567890 --query "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
  node scripts/run.js google-ads raw --path /customers/1234567890/googleAds:search --body '{"query":"SELECT campaign.id FROM campaign LIMIT 10"}'
  node scripts/run.js meta-ads campaigns

Meta Ads Config file: ${getCredentialsPath()}
`);
}

async function handleKlaviyo(subcommand, flags) {
  const command = subcommand || "profiles";

  if (command === "raw" || command === "native") {
    const result = await callGatewayRelay(
      "klaviyo",
      buildRelayRequest(flags, flags.body ? "POST" : "GET"),
    );
    printJson(result);
    return;
  }

  const entityMap = {
    profiles: "profiles",
    profile: "profiles",
    lists: "lists",
    segments: "segments",
    campaigns: "campaigns",
    flows: "flows",
    metrics: "metrics",
    events: "events",
    templates: "templates",
  };

  const entity = entityMap[command];
  if (!entity) {
    printError(`Unknown Klaviyo command: ${command}`);
    console.log(
      "\nAvailable commands: profiles, lists, segments, campaigns, flows, metrics, events, templates, raw",
    );
    process.exit(1);
  }

  const result = await callGatewayRead("klaviyo", entity, {
    limit: parseLimit(flags, 50),
    filters: parseJsonFlag(flags.filters, {}),
    cursor: flags.cursor || "",
  });
  printJson(result);
}

async function handleGoogleAds(subcommand, flags) {
  const command = subcommand || "customers";

  if (command === "raw" || command === "native") {
    const result = await callGatewayRelay(
      "google-ads",
      buildRelayRequest(flags, flags.body ? "POST" : "GET"),
    );
    printJson(result);
    return;
  }

  if (command === "search") {
    const customerId = String(flags["customer-id"] || "").trim();
    const query = String(flags.query || "").trim();
    if (!customerId || !query) {
      printError("google-ads search requires --customer-id and --query");
      process.exit(1);
    }

    const result = await callGatewayRead("google-ads", "search", {
      limit: parseLimit(flags, 50),
      filters: { customer_id: customerId, query },
    });
    printJson(result);
    return;
  }

  const entityMap = {
    customers: "customers",
    campaigns: "campaigns",
    "ad-groups": "ad_groups",
    adgroups: "ad_groups",
    keywords: "keywords",
    ads: "ads",
  };

  const entity = entityMap[command];
  if (!entity) {
    printError(`Unknown Google Ads command: ${command}`);
    console.log(
      "\nAvailable commands: customers, campaigns, ad-groups, keywords, ads, search, raw",
    );
    process.exit(1);
  }

  const filters = parseJsonFlag(flags.filters, {});
  if (flags["customer-id"]) {
    filters.customer_id = flags["customer-id"];
  }
  if (flags.query) {
    filters.query = flags.query;
  }

  const result = await callGatewayRead("google-ads", entity, {
    limit: parseLimit(flags, 50),
    filters,
  });
  printJson(result);
}

async function handleMetaAds(subcommand, flags) {
  const client = new MetaAdsClient();

  switch (subcommand) {
    case "account":
      printJson(await client.getAdAccount());
      break;
    case "campaigns":
      printJson(
        await client.getCampaigns({
          limit: typeof flags.limit === "string" ? parseInt(flags.limit, 10) : undefined,
          status: flags.status ? [flags.status] : undefined,
        }),
      );
      break;
    case "adsets":
    case "ad-sets":
      printJson(await client.getAdSets({ campaignId: flags["campaign-id"] }));
      break;
    case "ads":
      printJson(
        await client.getAds({ campaignId: flags["campaign-id"], adSetId: flags["adset-id"] }),
      );
      break;
    case "insights": {
      const campaignId = flags["campaign-id"];
      const adSetId = flags["adset-id"];
      const adId = flags["ad-id"];
      const datePreset = flags["date-preset"] || "last_30d";
      if (campaignId) printJson(await client.getCampaignInsights(campaignId, { datePreset }));
      else if (adSetId) printJson(await client.getAdSetInsights(adSetId, { datePreset }));
      else if (adId) printJson(await client.getAdInsights(adId, { datePreset }));
      else printJson(await client.getAccountInsights({ datePreset }));
      break;
    }
    default:
      printError(`Unknown Meta Ads command: ${subcommand}`);
      console.log("\nAvailable commands: account, campaigns, adsets, ads, insights");
      process.exit(1);
  }
}

const PLATFORMS = {
  klaviyo: {
    name: "Klaviyo",
    description: "Email marketing automation (Gateway Mode)",
    apiEndpoint: "https://a.klaviyo.com/api",
    authMethod: "Gateway (Workspace OAuth)",
    mode: "gateway",
    requiredFields: [],
  },
  "google-ads": {
    name: "Google Ads",
    description: "Search and display advertising (Gateway Mode)",
    apiEndpoint: "https://googleads.googleapis.com/v23",
    authMethod: "Gateway (Workspace OAuth via Nango)",
    mode: "gateway",
    requiredFields: [],
  },
  "meta-ads": {
    name: "Meta Ads",
    description: "Facebook/Instagram advertising (Direct Mode)",
    apiEndpoint: "https://graph.facebook.com/v25.0",
    authMethod: "Access Token (Direct)",
    mode: "direct",
    requiredFields: ["accessToken", "adAccountId"],
  },
};

function handlePlatforms() {
  printJson({
    total_platforms: Object.keys(PLATFORMS).length,
    platforms: Object.entries(PLATFORMS).map(([id, info]) => ({
      id,
      name: info.name,
      description: info.description,
      api_endpoint: info.apiEndpoint,
      auth_method: info.authMethod,
      mode: info.mode,
    })),
  });
}

function handleStatus() {
  const hasWorkspace = hasWorkspaceContext();
  const creds = loadCredentials();
  const results = [];

  for (const [id, info] of Object.entries(PLATFORMS)) {
    if (info.mode === "gateway") {
      results.push({
        platform: id,
        name: info.name,
        mode: info.mode,
        configured: hasWorkspace,
        status: hasWorkspace ? "ready" : "not_authorized",
      });
      continue;
    }

    const platformCreds = creds[id];
    const hasCreds = Boolean(platformCreds);
    const missingFields = [];
    if (hasCreds && typeof platformCreds === "object") {
      for (const field of info.requiredFields) {
        if (!platformCreds[field]) missingFields.push(field);
      }
    }

    const configured = hasCreds && missingFields.length === 0;
    results.push({
      platform: id,
      name: info.name,
      mode: info.mode,
      configured,
      status: configured ? "ready" : hasCreds ? "incomplete" : "not_configured",
      ...(missingFields.length > 0 ? { missing_fields: missingFields } : {}),
    });
  }

  printJson({
    total_platforms: results.length,
    configured_platforms: results.filter((r) => r.configured).length,
    workspace_authorized: hasWorkspace,
    status: results,
    config_file: getCredentialsPath(),
  });
}

async function handleConfig(subcommand, args) {
  switch (subcommand) {
    case "show": {
      const creds = loadCredentials();
      const sanitized = {};
      for (const [platform, config] of Object.entries(creds)) {
        sanitized[platform] = sanitizeCredentials(config);
      }
      printJson(sanitized);
      break;
    }
    case "path":
      console.log(getCredentialsPath());
      break;
    case "set-klaviyo":
    case "set-google-ads":
      printError(
        `${subcommand.replace("set-", "")} now uses Gateway Mode. Configure via workspace authorization.`,
      );
      process.exit(1);
      break;
    case "set-meta-ads": {
      const jsonStr = args[2];
      if (!jsonStr) {
        printError("JSON configuration is required");
        process.exit(1);
      }
      let creds;
      try {
        creds = JSON.parse(jsonStr);
      } catch {
        printError("Invalid JSON");
        process.exit(1);
      }
      const errors = validateMetaAdsCredentials(creds);
      if (errors.length > 0) {
        printError(errors.join(", "));
        process.exit(1);
      }
      saveCredentials({ ...loadCredentials(), "meta-ads": creds });
      console.log("✅ Meta Ads credentials saved");
      break;
    }
    default:
      printError(`Unknown config command: ${subcommand}`);
      console.log("\nAvailable commands: show, path, set-meta-ads");
      process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    showHelp();
    return;
  }

  const { command, subcommand, flags } = parseArgs(args);

  try {
    switch (command) {
      case "platforms":
      case "providers":
        handlePlatforms();
        break;
      case "status":
      case "connections":
        handleStatus();
        break;
      case "klaviyo":
        await handleKlaviyo(subcommand, flags);
        break;
      case "google-ads":
      case "googleads":
        await handleGoogleAds(subcommand, flags);
        break;
      case "meta-ads":
      case "metaads":
        await handleMetaAds(subcommand, flags);
        break;
      case "config":
        await handleConfig(subcommand, args);
        break;
      default:
        printError(`Unknown command: ${command}`);
        console.log(
          "\nAvailable commands: platforms, status, klaviyo, google-ads, meta-ads, config",
        );
        process.exit(1);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
