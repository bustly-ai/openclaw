#!/usr/bin/env node
/**
 * Ads Core Ops CLI
 * Unified advertising operations command line tool
 */

import {
  loadCredentials,
  saveCredentials,
  getCredentialsPath,
  sanitizeCredentials,
  validateKlaviyoCredentials,
  validateGoogleAdsCredentials,
  validateMetaAdsCredentials,
  API_KEY_URLS,
} from "../src/credentials.js";
import { GoogleAdsClient } from "../src/google-ads.js";
import { KlaviyoClient } from "../src/klaviyo.js";
import { MetaAdsClient } from "../src/meta-ads.js";

// CLI argument parsing

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
      const key = withoutPrefix.slice(0, eqIndex);
      const value = withoutPrefix.slice(eqIndex + 1);
      flags[key] = value;
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
  console.error(`\u274C Error: ${message}`);
}

// Help

function showHelp() {
  console.log(`
Ads Core Ops - Unified Advertising Operations CLI

Usage:
  node scripts/run.js <command> [args]
  node scripts/run.js <platform> <command> [args]

Core Commands:
  platforms             List all supported platforms
  status                Show credential status for each platform

Platforms:
  klaviyo      Klaviyo marketing automation
  google-ads   Google Ads
  meta-ads     Meta (Facebook) Ads
  config       Configuration management

Klaviyo Commands:
  profiles              List all profiles
  profile <id>          Get a single profile
  lists                 List all lists
  segments              List all segments
  campaigns             List all campaigns
  flows                 List all flows
  metrics               List all metrics
  events                List all events
  templates             List all templates

Google Ads Commands:
  customers             List accessible customer accounts
  campaigns             List campaigns
  ad-groups             List ad groups
  keywords              List keywords
  ads                   List ads
  search <gaql>         Execute GAQL query

Meta Ads Commands:
  account               Get ad account info
  campaigns             List campaigns
  adsets                List ad sets
  ads                   List ads
  insights              Get performance insights

Config Commands:
  config show                    Show current config
  config path                    Show config file path
  config set-klaviyo <api-key>   Set Klaviyo API Key
  config set-google-ads <json>   Set Google Ads config (JSON)
  config set-meta-ads <json>     Set Meta Ads config (JSON)

Environment Variables:
  KLAVIYO_API_KEY       Klaviyo API Key (optional, uses config file first)
  GOOGLE_ADS_*          Google Ads config (optional)
  META_ACCESS_TOKEN     Meta Access Token (optional)
  META_AD_ACCOUNT_ID    Meta Ad Account ID (optional)

Examples:
  # Klaviyo
  node scripts/run.js klaviyo profiles
  node scripts/run.js klaviyo lists
  node scripts/run.js klaviyo campaigns

  # Google Ads
  node scripts/run.js google-ads customers
  node scripts/run.js google-ads campaigns --customer-id 1234567890

  # Meta Ads
  node scripts/run.js meta-ads campaigns
  node scripts/run.js meta-ads insights --date-preset last_7d

  # Config
  node scripts/run.js config show
  node scripts/run.js config set-klaviyo pk_xxx

Config file: ${getCredentialsPath()}
`);
}

// Klaviyo commands

async function handleKlaviyo(subcommand, flags) {
  const client = new KlaviyoClient();

  switch (subcommand) {
    case "profiles": {
      const result = await client.getProfiles({
        pageSize: typeof flags.limit === "string" ? parseInt(flags.limit, 10) : 20,
      });
      printJson(result);
      break;
    }

    case "profile": {
      const profileId = flags.id;
      if (!profileId) {
        printError("Profile ID is required. Use --id <profile-id>");
        process.exit(1);
      }
      const result = await client.getProfile(profileId);
      printJson(result);
      break;
    }

    case "lists": {
      const result = await client.getLists();
      printJson(result);
      break;
    }

    case "segments": {
      const result = await client.getSegments();
      printJson(result);
      break;
    }

    case "campaigns": {
      const channel = flags.channel || "email";
      const result = await client.getCampaigns({ channel });
      printJson(result);
      break;
    }

    case "flows": {
      const result = await client.getFlows();
      printJson(result);
      break;
    }

    case "metrics": {
      const result = await client.getMetrics();
      printJson(result);
      break;
    }

    case "events": {
      const filter = flags.filter;
      const result = await client.getEvents({ filter });
      printJson(result);
      break;
    }

    case "templates": {
      const result = await client.getTemplates();
      printJson(result);
      break;
    }

    default:
      printError(`Unknown Klaviyo command: ${subcommand}`);
      console.log(
        "\nAvailable commands: profiles, profile, lists, segments, campaigns, flows, metrics, events, templates",
      );
      process.exit(1);
  }
}

// Google Ads commands

async function handleGoogleAds(subcommand, flags) {
  const client = new GoogleAdsClient();

  switch (subcommand) {
    case "customers": {
      const result = await client.listAccessibleCustomers();
      printJson(result);
      break;
    }

    case "campaigns": {
      const customerId = flags["customer-id"];
      if (!customerId) {
        printError("Customer ID is required. Use --customer-id <id>");
        process.exit(1);
      }
      const result = await client.getCampaigns(customerId, {
        status: flags.status,
        limit: typeof flags.limit === "string" ? parseInt(flags.limit, 10) : undefined,
      });
      printJson(result);
      break;
    }

    case "ad-groups":
    case "adgroups": {
      const customerId = flags["customer-id"];
      if (!customerId) {
        printError("Customer ID is required. Use --customer-id <id>");
        process.exit(1);
      }
      const result = await client.getAdGroups(customerId, {
        campaignId: flags["campaign-id"],
      });
      printJson(result);
      break;
    }

    case "keywords": {
      const customerId = flags["customer-id"];
      if (!customerId) {
        printError("Customer ID is required. Use --customer-id <id>");
        process.exit(1);
      }
      const result = await client.getKeywords(customerId, {
        dateRange: flags["date-range"] || "LAST_30_DAYS",
      });
      printJson(result);
      break;
    }

    case "ads": {
      const customerId = flags["customer-id"];
      if (!customerId) {
        printError("Customer ID is required. Use --customer-id <id>");
        process.exit(1);
      }
      const result = await client.getAds(customerId);
      printJson(result);
      break;
    }

    case "search": {
      const customerId = flags["customer-id"];
      const query = flags.query;
      if (!customerId || !query) {
        printError("Both --customer-id and --query are required");
        process.exit(1);
      }
      const result = await client.search(customerId, query);
      printJson(result);
      break;
    }

    default:
      printError(`Unknown Google Ads command: ${subcommand}`);
      console.log("\nAvailable commands: customers, campaigns, ad-groups, keywords, ads, search");
      process.exit(1);
  }
}

// Meta Ads commands

async function handleMetaAds(subcommand, flags) {
  const client = new MetaAdsClient();

  switch (subcommand) {
    case "account": {
      const result = await client.getAdAccount();
      printJson(result);
      break;
    }

    case "campaigns": {
      const result = await client.getCampaigns({
        limit: typeof flags.limit === "string" ? parseInt(flags.limit, 10) : undefined,
        status: flags.status ? [flags.status] : undefined,
      });
      printJson(result);
      break;
    }

    case "adsets":
    case "ad-sets": {
      const result = await client.getAdSets({
        campaignId: flags["campaign-id"],
      });
      printJson(result);
      break;
    }

    case "ads": {
      const result = await client.getAds({
        campaignId: flags["campaign-id"],
        adSetId: flags["adset-id"],
      });
      printJson(result);
      break;
    }

    case "insights": {
      const campaignId = flags["campaign-id"];
      const adSetId = flags["adset-id"];
      const adId = flags["ad-id"];
      const datePreset = flags["date-preset"] || "last_30d";

      let result;
      if (campaignId) {
        result = await client.getCampaignInsights(campaignId, { datePreset });
      } else if (adSetId) {
        result = await client.getAdSetInsights(adSetId, { datePreset });
      } else if (adId) {
        result = await client.getAdInsights(adId, { datePreset });
      } else {
        result = await client.getAccountInsights({ datePreset });
      }
      printJson(result);
      break;
    }

    default:
      printError(`Unknown Meta Ads command: ${subcommand}`);
      console.log("\nAvailable commands: account, campaigns, adsets, ads, insights");
      process.exit(1);
  }
}

// Platform info

const PLATFORMS = {
  klaviyo: {
    name: "Klaviyo",
    description: "Email marketing automation",
    apiEndpoint: "https://a.klaviyo.com/api",
    authMethod: "API Key (pk_)",
    keyUrl: "https://www.klaviyo.com/create-private-api-key",
    requiredFields: ["apiKey"],
  },
  "google-ads": {
    name: "Google Ads",
    description: "Search and display advertising",
    apiEndpoint: "https://googleads.googleapis.com/v23",
    authMethod: "OAuth2 + Developer Token",
    keyUrl: "https://developers.google.com/google-ads/api/docs/first-call/overview",
    requiredFields: ["developerToken", "clientId", "clientSecret", "refreshToken"],
  },
  "meta-ads": {
    name: "Meta Ads",
    description: "Facebook/Instagram advertising",
    apiEndpoint: "https://graph.facebook.com/v25.0",
    authMethod: "Access Token",
    keyUrl: "https://developers.facebook.com/tools/explorer/",
    requiredFields: ["accessToken", "adAccountId"],
  },
};

function handlePlatforms() {
  const platforms = Object.entries(PLATFORMS).map(([id, info]) => ({
    id,
    name: info.name,
    description: info.description,
    api_endpoint: info.apiEndpoint,
    auth_method: info.authMethod,
  }));

  printJson({
    total_platforms: platforms.length,
    platforms,
  });
}

function handleStatus() {
  const creds = loadCredentials();
  const results = [];

  for (const [id, info] of Object.entries(PLATFORMS)) {
    const platformCreds = creds[id];
    const hasCreds = Boolean(platformCreds);

    const missingFields = [];
    if (hasCreds && typeof platformCreds === "object") {
      const credObj = platformCreds;
      for (const field of info.requiredFields) {
        if (!credObj[field]) {
          missingFields.push(field);
        }
      }
    }

    const configured = hasCreds && missingFields.length === 0;

    results.push({
      platform: id,
      name: info.name,
      configured,
      status: configured ? "ready" : hasCreds ? "incomplete" : "not_configured",
      ...(missingFields.length > 0 ? { missing_fields: missingFields } : {}),
      key_url: info.keyUrl,
    });
  }

  const configuredCount = results.filter((r) => r.configured).length;

  printJson({
    total_platforms: results.length,
    configured_platforms: configuredCount,
    status: results,
    config_file: getCredentialsPath(),
  });
}

// Config management

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

    case "path": {
      console.log(getCredentialsPath());
      break;
    }

    case "set-klaviyo": {
      const apiKey = args[2];
      if (!apiKey) {
        printError("API Key is required");
        process.exit(1);
      }
      const creds = { apiKey };
      const errors = validateKlaviyoCredentials(creds);
      if (errors.length > 0) {
        printError(errors.join(", "));
        process.exit(1);
      }
      saveCredentials({ ...loadCredentials(), klaviyo: creds });
      console.log("\u2705 Klaviyo credentials saved");
      break;
    }

    case "set-google-ads": {
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
      const errors = validateGoogleAdsCredentials(creds);
      if (errors.length > 0) {
        printError(errors.join(", "));
        process.exit(1);
      }
      saveCredentials({ ...loadCredentials(), "google-ads": creds });
      console.log("\u2705 Google Ads credentials saved");
      break;
    }

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
      console.log("\u2705 Meta Ads credentials saved");
      break;
    }

    default:
      printError(`Unknown config command: ${subcommand}`);
      console.log("\nAvailable commands: show, path, set-klaviyo, set-google-ads, set-meta-ads");
      process.exit(1);
  }
}

// Main

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
    if (error instanceof Error) {
      printError(error.message);
    }
    process.exit(1);
  }
}

main();
