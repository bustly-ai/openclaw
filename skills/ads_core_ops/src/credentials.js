/**
 * Unified Credentials Management
 * All platform API Keys stored in ~/.bustly/ads_credentials.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const DEFAULT_REVISION = "2026-01-15";

/**
 * API Key URLs for each platform
 */
export const API_KEY_URLS = {
  klaviyo: "https://www.klaviyo.com/create-private-api-key",
  "google-ads": "https://developers.google.com/google-ads/api/docs/first-call/overview",
  "meta-ads": "https://developers.facebook.com/tools/explorer/",
};

/**
 * Get credentials file path
 */
export function getCredentialsPath() {
  const homeDir = homedir();
  const stateDir = resolve(homeDir, ".bustly");
  return resolve(stateDir, "ads_credentials.json");
}

/**
 * Ensure .bustly directory exists
 */
function ensureStateDir() {
  const homeDir = homedir();
  const stateDir = resolve(homeDir, ".bustly");
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
}

/**
 * Load all credentials
 */
export function loadCredentials() {
  const path = getCredentialsPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to load credentials from ${path}: ${error}`);
  }
}

/**
 * Save all credentials
 */
export function saveCredentials(credentials) {
  ensureStateDir();
  const path = getCredentialsPath();
  writeFileSync(path, JSON.stringify(credentials, null, 2), "utf-8");
}

/**
 * Get credentials for a specific platform (with detailed error messages)
 */
export function getPlatformCredentials(platform) {
  const credentials = loadCredentials();
  const platformCreds = credentials[platform];

  if (!platformCreds) {
    throwMissingCredentialsError(platform);
  }

  return platformCreds;
}

/**
 * Throw missing credentials error (with setup URL)
 */
function throwMissingCredentialsError(platform) {
  const path = getCredentialsPath();
  const url = API_KEY_URLS[platform];

  let setupGuide = "";

  switch (platform) {
    case "klaviyo":
      setupGuide = `
\u274C Missing Klaviyo API Key

To get your Klaviyo API Key:
1. Go to: ${url}
2. Create a new Private API Key
3. Select required scopes (Profiles, Lists, Campaigns, etc.)
4. Copy the key (starts with 'pk_')

Then configure it:
  node scripts/run.js config set-klaviyo pk_your_key_here

Or add to ${path}:
{
  "klaviyo": {
    "apiKey": "pk_xxx",
    "revision": "2026-01-15"
  }
}`;
      break;

    case "google-ads":
      setupGuide = `
\u274C Missing Google Ads Credentials

To set up Google Ads API access:
1. Go to: ${url}
2. Get Developer Token from Google Ads API Center
3. Create OAuth2 credentials in Google Cloud Console
4. Generate refresh token via OAuth flow

Then configure it:
  node scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'

Or add to ${path}:
{
  "google-ads": {
    "developerToken": "xxx",
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx",
    "refreshToken": "xxx",
    "loginCustomerId": "1234567890"
  }
}`;
      break;

    case "meta-ads":
      setupGuide = `
\u274C Missing Meta Ads Credentials

To get your Meta Ads credentials:
1. Go to: ${url}
2. Generate User Access Token with 'ads_read' permission
3. Or create System User token in Business Manager (recommended)

Then configure it:
  node scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'

Or add to ${path}:
{
  "meta-ads": {
    "accessToken": "xxx",
    "adAccountId": "123456789"
  }
}`;
      break;

    default:
      setupGuide = `No credentials found for platform: ${platform}`;
  }

  throw new Error(setupGuide);
}

/**
 * Set credentials for a specific platform
 */
export function setPlatformCredentials(platform, creds) {
  const credentials = loadCredentials();
  credentials[platform] = creds;
  saveCredentials(credentials);
}

/**
 * Get example credentials
 */
export function getExampleCredentials(platform) {
  switch (platform) {
    case "klaviyo":
      return {
        apiKey: "pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        revision: DEFAULT_REVISION,
      };
    case "google-ads":
      return {
        developerToken: "xxxxxxxxxxxxxxxxxxxxxx",
        clientId: "xxxxxxxxxxxx.apps.googleusercontent.com",
        clientSecret: "xxxxxxxxxxxxxxxx",
        refreshToken: "xxxxxxxxxxxxxxxx",
        loginCustomerId: "1234567890",
      };
    case "meta-ads":
      return {
        accessToken: "xxxxxxxxxxxxxxxx",
        adAccountId: "123456789",
      };
    default:
      return {};
  }
}

/**
 * Hide sensitive fields (for displaying config)
 */
export function sanitizeCredentials(creds) {
  if (!creds || typeof creds !== "object") {
    return {};
  }

  const sanitized = { ...creds };
  const sensitiveFields = [
    "apiKey",
    "accessToken",
    "refreshToken",
    "clientSecret",
    "developerToken",
    "matonApiKey",
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "***hidden***";
    }
  }

  return sanitized;
}

/**
 * Validate Klaviyo credentials
 */
export function validateKlaviyoCredentials(creds) {
  const errors = [];
  if (!creds.apiKey) {
    errors.push("apiKey is required");
  }
  if (creds.apiKey && !creds.apiKey.startsWith("pk_")) {
    errors.push("apiKey should start with 'pk_'");
  }
  return errors;
}

/**
 * Validate Google Ads credentials
 */
export function validateGoogleAdsCredentials(creds) {
  const errors = [];
  if (!creds.developerToken) {
    errors.push("developerToken is required");
  }
  if (!creds.clientId) {
    errors.push("clientId is required");
  }
  if (!creds.clientSecret) {
    errors.push("clientSecret is required");
  }
  if (!creds.refreshToken) {
    errors.push("refreshToken is required");
  }
  return errors;
}

/**
 * Validate Meta Ads credentials
 */
export function validateMetaAdsCredentials(creds) {
  const errors = [];
  if (!creds.accessToken) {
    errors.push("accessToken is required");
  }
  if (!creds.adAccountId) {
    errors.push("adAccountId is required");
  }
  return errors;
}
