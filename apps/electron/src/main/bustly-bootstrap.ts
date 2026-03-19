import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ERRORS_FILENAME,
  DEFAULT_FEATURE_REQUESTS_FILENAME,
  DEFAULT_LEARNINGS_DIRNAME,
  DEFAULT_LEARNINGS_FILENAME,
  isWorkspaceOnboardingCompleted,
  loadWorkspaceTemplate,
} from "../../../../src/agents/workspace";
import type { BustlyOAuthState } from "./bustly-types.js";
import { readBustlyOAuthState } from "./bustly-oauth.js";

const MANAGED_MARKER = "<!-- Managed by Bustly bootstrap. Edit with care. -->";
const CONTEXT_VERSION = 1;
const DEFAULT_LEARNINGS_TEMPLATE = `# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice
**Areas**: frontend | backend | infra | tests | docs | config
**Statuses**: pending | in_progress | resolved | wont_fix | promoted | promoted_to_skill

`;
const DEFAULT_ERRORS_TEMPLATE = `# Errors Log

Command failures, exceptions, and unexpected behaviors.

---
`;
const DEFAULT_FEATURE_REQUESTS_TEMPLATE = `# Feature Requests

Capabilities requested by user that don't currently exist.

---
`;

type WorkspaceRow = {
  id: string;
  name: string;
  logo_url: string | null;
  owner_id: string | null;
  settings: Record<string, unknown> | null;
  status: string;
};

type WorkspaceMemberRow = {
  role: string;
  status: string;
  joined_at: string | null;
};

type WorkspaceIntegrationRow = {
  id: number;
  platform: string;
  status: string;
  connected_at: string | null;
  last_synced_at: string | null;
  error_message: string | null;
};

type WorkspaceBillingWindowRow = {
  valid_from: string;
  valid_to: string;
  internal_budget_microusd: number;
  internal_used_microusd: number;
  status: string;
};

type WorkspacePulseRow = {
  timezone: string | null;
  report_utc_hour: number | null;
  shop_info: Record<string, unknown> | null;
  status: string | null;
  report_status: string | null;
};

type ShopifyMappingRow = {
  shopify_shop_id: string;
  role: string | null;
  status: number | null;
};

type ShopifyShopRow = {
  id: string;
  shop_domain: string | null;
  shop_name: string | null;
  email: string | null;
  currency: string | null;
  iana_timezone: string | null;
  status: string | null;
};

type BigCommerceMappingRow = {
  store_hash: string;
  role: string | null;
  status: number | null;
};

type BigCommerceAccountRow = {
  id: string;
  store_hash: string;
  name: string | null;
  secure_url: string | null;
  domain: string | null;
  currency: string | null;
  iana_timezone: string | null;
  status: string | null;
};

type WooMappingRow = {
  woocommerce_account_id: string | null;
  site_url: string | null;
  site_id: string | null;
  role: string | null;
  status: number | null;
};

type WooAccountRow = {
  id: string;
  site_url: string | null;
  site_name: string | null;
  store_url: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
};

type MagentoMappingRow = {
  magento_account_id: string;
  role: string | null;
  status: number | null;
};

type MagentoAccountRow = {
  id: string;
  name: string | null;
  base_url: string | null;
  currency: string | null;
  timezone: string | null;
  status: string | null;
};

type GoogleAdsMappingRow = {
  customer_id: string;
  role: string | null;
  status: string | null;
};

type GoogleAdsAccountRow = {
  customer_id: string;
  account_name: string | null;
  currency_code: string | null;
  time_zone: string | null;
  status: string | null;
  last_synced_at: string | null;
};

type KlaviyoMappingRow = {
  klaviyo_account_id: string;
  role: string | null;
  status: number | null;
};

type KlaviyoAccountRow = {
  account_id: string;
  account_name: string | null;
  timezone: string | null;
  currency_code: string | null;
  status: string | null;
  webhooks_registered: boolean | null;
};

type AliExpressMappingRow = {
  aliexpress_account_id: string;
  account_id: number | null;
  account_name: string | null;
  shop_name: string | null;
  role: string | null;
  status: number | null;
};

type AliExpressAccountRow = {
  id: string;
  account_id: number | null;
  account_name: string | null;
  shop_name: string | null;
  login_email: string | null;
  status: string | null;
};

type CommerceStore = {
  platform: string;
  name: string;
  url: string | null;
  currency: string | null;
  timezone: string | null;
  role: string | null;
  status: string;
};

type MarketingPlatform = {
  platform: string;
  accountLabel: string;
  status: string;
  timezone: string | null;
  lastSyncedAt: string | null;
  source: "supabase" | "local";
};

type SourcingConnection = {
  platform: string;
  accountLabel: string;
  shopName: string | null;
  status: string;
};

type LocalAdsCredentialStatus = {
  klaviyo: boolean;
  googleAds: boolean;
  metaAds: boolean;
};

export type BustlyBootstrapContext = {
  version: number;
  generatedAt: string;
  workspace: {
    id: string;
    name: string;
    status: string;
    industry: string | null;
    logoUrl: string | null;
    ownerId: string | null;
    memberRole: string | null;
    memberCount: number;
    operatorName: string;
    operatorEmail: string;
  };
  commerce: {
    storefronts: CommerceStore[];
    primaryStoreUrl: string | null;
    primaryStoreName: string | null;
    primaryTimezone: string | null;
    primaryCurrency: string | null;
  };
  sourcing: {
    connections: SourcingConnection[];
  };
  marketing: {
    platforms: MarketingPlatform[];
    localCredentials: LocalAdsCredentialStatus;
  };
  monitoring: {
    billing: {
      active: boolean;
      validFrom: string | null;
      validTo: string | null;
      budgetUsd: number | null;
      usedUsd: number | null;
    };
    pulse: {
      enabled: boolean;
      timezone: string | null;
      reportUtcHour: number | null;
      status: string | null;
      reportStatus: string | null;
      brandName: string | null;
      brandDomain: string | null;
    };
  };
  gaps: string[];
};

function createSupabaseClient(state: BustlyOAuthState): SupabaseClient {
  const url = state.supabase?.url?.trim();
  const anonKey = state.supabase?.anonKey?.trim();
  const accessToken = state.user?.userAccessToken?.trim();
  if (!url || !anonKey || !accessToken) {
    throw new Error("Missing Bustly Supabase credentials for workspace bootstrap.");
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function normalizeLine(value: string | null | undefined, fallback = "Unknown"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function titleCasePlatform(value: string): string {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toUsd(micros: number | null | undefined): number | null {
  if (typeof micros !== "number" || !Number.isFinite(micros)) {
    return null;
  }
  return Math.round((micros / 1_000_000) * 100) / 100;
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key) => values[key] ?? "");
}

function renderBulletList(lines: string[]): string {
  if (lines.length === 0) {
    return "- None connected yet";
  }
  return lines.map((line) => `- ${line}`).join("\n");
}

function renderCommerceStores(stores: CommerceStore[]): string {
  return renderBulletList(
    stores.map((store) =>
      [
        store.platform,
        store.name,
        store.url ? `(${store.url})` : null,
        store.currency ? `currency=${store.currency}` : null,
        store.timezone ? `timezone=${store.timezone}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

function compactDefined<T>(values: Array<T | null | undefined>): T[] {
  return values.filter((value): value is T => value != null);
}

function dedupeStorefronts(stores: CommerceStore[]): CommerceStore[] {
  const byKey = new Map<string, CommerceStore>();
  for (const store of stores) {
    const key = [
      store.platform.trim().toLowerCase(),
      (store.url ?? "").trim().toLowerCase(),
      store.name.trim().toLowerCase(),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, store);
      continue;
    }
    const score = (entry: CommerceStore) =>
      Number(Boolean(entry.url)) + Number(Boolean(entry.timezone)) + Number(Boolean(entry.currency));
    if (score(store) > score(existing)) {
      byKey.set(key, store);
    }
  }
  return [...byKey.values()];
}

function isConnectedStatus(status: number | string | null | undefined): boolean {
  if (typeof status === "number") {
    return status === 1;
  }
  if (typeof status !== "string") {
    return false;
  }
  const normalized = status.trim().toLowerCase();
  return normalized === "active" || normalized === "connected" || normalized === "enabled";
}

function renderMarketingPlatforms(platforms: MarketingPlatform[]): string {
  return renderBulletList(
    platforms.map((platform) =>
      [
        platform.platform,
        platform.accountLabel,
        `status=${platform.status}`,
        platform.source === "local" ? "source=local-skill-credentials" : "source=workspace-integration",
      ].join(" "),
    ),
  );
}

function renderSourcingConnections(connections: SourcingConnection[]): string {
  return renderBulletList(
    connections.map((item) =>
      [
        item.platform,
        item.accountLabel,
        item.shopName ? `shop=${item.shopName}` : null,
        `status=${item.status}`,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

function summarizePlatforms(platforms: string[], fallback: string): string {
  const unique = Array.from(new Set(platforms.map((item) => item.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return fallback;
  }
  return unique.map(titleCasePlatform).join(", ");
}

function getShopInfoString(
  pulse: WorkspacePulseRow | null,
  keys: string[],
): string | null {
  const shopInfo = pulse?.shop_info;
  if (!shopInfo || typeof shopInfo !== "object") {
    return null;
  }
  for (const key of keys) {
    const value = shopInfo[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function readLocalAdsCredentialStatus(): Promise<LocalAdsCredentialStatus> {
  const credentialPath = path.join(homedir(), ".bustly", "ads_credentials.json");
  try {
    const raw = await fs.readFile(credentialPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const hasObject = (key: string) =>
      Boolean(parsed[key] && typeof parsed[key] === "object" && !Array.isArray(parsed[key]));
    return {
      klaviyo: hasObject("klaviyo"),
      googleAds: hasObject("google-ads"),
      metaAds: hasObject("meta-ads"),
    };
  } catch {
    return {
      klaviyo: false,
      googleAds: false,
      metaAds: false,
    };
  }
}

async function fetchSingle<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<T | null> {
  const result = await promise;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function fetchMany<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const result = await promise;
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data ?? [];
}

async function fetchManyOptional<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  params: {
    label: string;
    warnings: string[];
    fallback?: T[];
  },
): Promise<T[]> {
  const result = await promise;
  if (result.error) {
    params.warnings.push(`${params.label}: ${result.error.message}`);
    return params.fallback ?? [];
  }
  return result.data ?? [];
}

async function buildBustlyBootstrapContext(params: {
  workspaceId: string;
  workspaceName?: string;
}): Promise<BustlyBootstrapContext> {
  const state = readBustlyOAuthState();
  if (!state?.user?.userId) {
    throw new Error("Missing Bustly OAuth user for workspace bootstrap.");
  }

  const client = createSupabaseClient(state);
  const workspaceId = params.workspaceId.trim();
  const userId = state.user.userId;
  const warnings: string[] = [];

  const [workspace, membershipRows, memberRows, integrations, billingRows, pulseRows] =
    await Promise.all([
    fetchSingle<WorkspaceRow>(
      client.from("workspaces").select("id, name, logo_url, owner_id, settings, status").eq("id", workspaceId).maybeSingle(),
      "workspaces lookup failed",
    ),
    fetchMany<WorkspaceMemberRow>(
      client
        .from("workspace_members")
        .select("role, status, joined_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .limit(1),
      "workspace_members lookup failed",
    ),
    fetchMany(
      client.from("workspace_members").select("workspace_id").eq("workspace_id", workspaceId).eq("status", "ACTIVE"),
      "workspace_members count lookup failed",
    ),
    fetchMany<WorkspaceIntegrationRow>(
      client
        .from("workspace_integrations")
        .select("id, platform, status, connected_at, last_synced_at, error_message")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      "workspace_integrations lookup failed",
    ),
    fetchMany<WorkspaceBillingWindowRow>(
      client
        .from("workspace_billing_windows")
        .select("valid_from, valid_to, internal_budget_microusd, internal_used_microusd, status")
        .eq("workspace_id", workspaceId)
        .order("valid_to", { ascending: false })
        .limit(1),
      "workspace_billing_windows lookup failed",
    ),
    fetchMany<WorkspacePulseRow>(
      client
        .from("workspace_pulse_status")
        .select("timezone, report_utc_hour, shop_info, status, report_status")
        .eq("workspace_id", workspaceId)
        .limit(1),
      "workspace_pulse_status lookup failed",
    ),
  ]);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found for bootstrap.`);
  }

  const membership = membershipRows[0] ?? null;
  const billing = billingRows[0] ?? null;
  const pulse = pulseRows[0] ?? null;
  const localCredentials = await readLocalAdsCredentialStatus();

  const [
    shopifyMappings,
    bigCommerceMappings,
    wooMappings,
    magentoMappings,
    googleAdsMappings,
    klaviyoMappings,
    aliexpressMappings,
  ] = await Promise.all([
      fetchMany<ShopifyMappingRow>(
        client.from("workspace_shopify_mappings").select("shopify_shop_id, role, status").eq("workspace_id", workspaceId),
        "workspace_shopify_mappings lookup failed",
      ),
    fetchMany<BigCommerceMappingRow>(
      client.from("workspace_bigcommerce_mappings").select("store_hash, role, status").eq("workspace_id", workspaceId),
      "workspace_bigcommerce_mappings lookup failed",
    ),
    fetchMany<WooMappingRow>(
      client
        .from("workspace_woocommerce_mappings")
        .select("woocommerce_account_id, site_url, site_id, role, status")
        .eq("workspace_id", workspaceId),
      "workspace_woocommerce_mappings lookup failed",
    ),
    fetchMany<MagentoMappingRow>(
      client.from("workspace_magento_mappings").select("magento_account_id, role, status").eq("workspace_id", workspaceId),
      "workspace_magento_mappings lookup failed",
    ),
    fetchMany<GoogleAdsMappingRow>(
      client.from("workspace_google_ads_mappings").select("customer_id, role, status").eq("workspace_id", workspaceId),
      "workspace_google_ads_mappings lookup failed",
    ),
    fetchMany<KlaviyoMappingRow>(
      client.from("workspace_klaviyo_mappings").select("klaviyo_account_id, role, status").eq("workspace_id", workspaceId),
      "workspace_klaviyo_mappings lookup failed",
    ),
    fetchMany<AliExpressMappingRow>(
      client
        .from("workspace_aliexpress_mappings")
        .select("aliexpress_account_id, account_id, account_name, shop_name, role, status")
        .eq("workspace_id", workspaceId),
      "workspace_aliexpress_mappings lookup failed",
    ),
  ]);

  const connectedShopifyMappings = shopifyMappings.filter((row) => isConnectedStatus(row.status));
  const connectedBigCommerceMappings = bigCommerceMappings.filter((row) =>
    isConnectedStatus(row.status),
  );
  const connectedWooMappings = wooMappings.filter((row) => isConnectedStatus(row.status));
  const connectedMagentoMappings = magentoMappings.filter((row) => isConnectedStatus(row.status));
  const connectedGoogleAdsMappings = googleAdsMappings.filter((row) =>
    isConnectedStatus(row.status),
  );
  const connectedKlaviyoMappings = klaviyoMappings.filter((row) => isConnectedStatus(row.status));
  const connectedAliExpressMappings = aliexpressMappings.filter((row) =>
    isConnectedStatus(row.status),
  );

  const shopifyIds = connectedShopifyMappings.map((row) => row.shopify_shop_id).filter(Boolean);
  const bigCommerceHashes = connectedBigCommerceMappings.map((row) => row.store_hash).filter(Boolean);
  const wooIds = connectedWooMappings.map((row) => row.woocommerce_account_id).filter(Boolean) as string[];
  const magentoIds = connectedMagentoMappings.map((row) => row.magento_account_id).filter(Boolean);
  const googleCustomerIds = connectedGoogleAdsMappings.map((row) => row.customer_id).filter(Boolean);
  const klaviyoAccountIds = connectedKlaviyoMappings.map((row) => row.klaviyo_account_id).filter(Boolean);
  const aliexpressIds = connectedAliExpressMappings.map((row) => row.aliexpress_account_id).filter(Boolean);

  const [shopifyShops, bigCommerceAccounts, wooAccounts, magentoAccounts, googleAdsAccounts, klaviyoAccounts, aliexpressAccounts] =
    await Promise.all([
      shopifyIds.length > 0
        ? fetchManyOptional(
            client
              .from("shopify_shops")
              .select("id, shop_domain, shop_name, email, currency, iana_timezone, status")
              .in("id", shopifyIds),
            { label: "shopify_shops lookup failed", warnings },
          )
        : Promise.resolve([] as ShopifyShopRow[]),
      bigCommerceHashes.length > 0
        ? fetchManyOptional<BigCommerceAccountRow>(
            client
              .from("bigcommerce_accounts")
              .select("id, store_hash, name, secure_url, domain, currency, iana_timezone, status")
              .in("store_hash", bigCommerceHashes),
            { label: "bigcommerce_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as BigCommerceAccountRow[]),
      wooIds.length > 0
        ? fetchManyOptional(
            client
              .from("woocommerce_accounts")
              .select("id, site_url, site_name, store_url, currency, timezone, status")
              .in("id", wooIds),
            { label: "woocommerce_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as WooAccountRow[]),
      magentoIds.length > 0
        ? fetchManyOptional(
            client
              .from("magento_accounts")
              .select("id, name, base_url, currency, timezone, status")
              .in("id", magentoIds),
            { label: "magento_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as MagentoAccountRow[]),
      googleCustomerIds.length > 0
        ? fetchManyOptional(
            client
              .from("google_ad_accounts")
              .select("customer_id, account_name, currency_code, time_zone, status, last_synced_at")
              .in("customer_id", googleCustomerIds),
            { label: "google_ad_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as GoogleAdsAccountRow[]),
      klaviyoAccountIds.length > 0
        ? fetchManyOptional(
            client
              .from("klaviyo_accounts")
              .select("account_id, account_name, timezone, currency_code, status, webhooks_registered")
              .in("account_id", klaviyoAccountIds),
            { label: "klaviyo_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as KlaviyoAccountRow[]),
      aliexpressIds.length > 0
        ? fetchManyOptional(
            client
              .from("aliexpress_accounts")
              .select("id, account_id, account_name, shop_name, login_email, status")
              .in("id", aliexpressIds),
            { label: "aliexpress_accounts lookup failed", warnings },
          )
        : Promise.resolve([] as AliExpressAccountRow[]),
    ]);

  const shopifyById = new Map(shopifyShops.map((row) => [row.id, row]));
  const bigCommerceByHash = new Map(bigCommerceAccounts.map((row) => [row.store_hash, row]));
  const wooById = new Map(wooAccounts.map((row) => [row.id, row]));
  const magentoById = new Map(magentoAccounts.map((row) => [row.id, row]));
  const googleByCustomerId = new Map(googleAdsAccounts.map((row) => [row.customer_id, row]));
  const klaviyoById = new Map(klaviyoAccounts.map((row) => [row.account_id, row]));
  const aliexpressById = new Map(aliexpressAccounts.map((row) => [row.id, row]));

  const storefronts = dedupeStorefronts(compactDefined([
    ...connectedShopifyMappings.map((mapping) => {
      const shop = shopifyById.get(mapping.shopify_shop_id);
      if (!shop?.shop_domain && !shop?.shop_name) {
        return null;
      }
      return {
        platform: "shopify",
        name: normalizeLine(shop?.shop_name || shop?.shop_domain, "Shopify store"),
        url: shop?.shop_domain ? `https://${shop.shop_domain}` : null,
        currency: shop?.currency ?? null,
        timezone: shop?.iana_timezone ?? null,
        role: mapping.role ?? null,
        status: normalizeLine(shop?.status, mapping.status === 1 ? "active" : "unknown"),
      };
    }),
    ...connectedBigCommerceMappings.map((mapping) => {
      const store = bigCommerceByHash.get(mapping.store_hash);
      if (!store?.secure_url && !store?.domain && !store?.name) {
        return null;
      }
      return {
        platform: "bigcommerce",
        name: normalizeLine(store?.name || store?.domain, "BigCommerce store"),
        url: store?.secure_url || store?.domain || null,
        currency: store?.currency ?? null,
        timezone: store?.iana_timezone ?? null,
        role: mapping.role ?? null,
        status: normalizeLine(store?.status, mapping.status === 1 ? "active" : "unknown"),
      };
    }),
    ...connectedWooMappings.map((mapping) => {
      const store = mapping.woocommerce_account_id
        ? wooById.get(mapping.woocommerce_account_id)
        : null;
      if (!store?.store_url && !store?.site_url && !mapping.site_url && !store?.site_name) {
        return null;
      }
      return {
        platform: "woocommerce",
        name: normalizeLine(store?.site_name || mapping.site_url, "WooCommerce store"),
        url: store?.store_url || store?.site_url || mapping.site_url || null,
        currency: store?.currency ?? null,
        timezone: store?.timezone ?? null,
        role: mapping.role ?? null,
        status: normalizeLine(store?.status, mapping.status === 1 ? "active" : "unknown"),
      };
    }),
    ...connectedMagentoMappings.map((mapping) => {
      const store = magentoById.get(mapping.magento_account_id);
      if (!store?.base_url && !store?.name) {
        return null;
      }
      return {
        platform: "magento",
        name: normalizeLine(store?.name, "Magento store"),
        url: store?.base_url || null,
        currency: store?.currency ?? null,
        timezone: store?.timezone ?? null,
        role: mapping.role ?? null,
        status: normalizeLine(store?.status, mapping.status === 1 ? "active" : "unknown"),
      };
    }),
  ]));

  const marketingPlatforms: MarketingPlatform[] = [
    ...connectedGoogleAdsMappings.map((mapping) => {
      const account = googleByCustomerId.get(mapping.customer_id);
      return {
        platform: "google_ads",
        accountLabel: normalizeLine(account?.account_name || mapping.customer_id, "Google Ads account"),
        status: normalizeLine(account?.status, mapping.status ?? "unknown"),
        timezone: account?.time_zone ?? null,
        lastSyncedAt: account?.last_synced_at ?? null,
        source: "supabase" as const,
      };
    }),
    ...connectedKlaviyoMappings.map((mapping) => {
      const account = klaviyoById.get(mapping.klaviyo_account_id);
      return {
        platform: "klaviyo",
        accountLabel: normalizeLine(account?.account_name || mapping.klaviyo_account_id, "Klaviyo account"),
        status: normalizeLine(account?.status, mapping.status === 1 ? "active" : "unknown"),
        timezone: account?.timezone ?? null,
        lastSyncedAt: null,
        source: "supabase" as const,
      };
    }),
  ];

  if (localCredentials.googleAds && !marketingPlatforms.some((entry) => entry.platform === "google_ads" && entry.source === "local")) {
    marketingPlatforms.push({
      platform: "google_ads",
      accountLabel: "Local ads_core_ops credential",
      status: "configured",
      timezone: null,
      lastSyncedAt: null,
      source: "local",
    });
  }
  if (localCredentials.klaviyo && !marketingPlatforms.some((entry) => entry.platform === "klaviyo" && entry.source === "local")) {
    marketingPlatforms.push({
      platform: "klaviyo",
      accountLabel: "Local ads_core_ops credential",
      status: "configured",
      timezone: null,
      lastSyncedAt: null,
      source: "local",
    });
  }
  if (localCredentials.metaAds) {
    marketingPlatforms.push({
      platform: "meta_ads",
      accountLabel: "Local ads_core_ops credential",
      status: "configured",
      timezone: null,
      lastSyncedAt: null,
      source: "local",
    });
  }

  const sourcingConnections: SourcingConnection[] = connectedAliExpressMappings.map((mapping) => {
    const account = aliexpressById.get(mapping.aliexpress_account_id);
    return {
      platform: "aliexpress",
      accountLabel: normalizeLine(account?.account_name || mapping.account_name || String(mapping.account_id ?? ""), "AliExpress account"),
      shopName: account?.shop_name || mapping.shop_name || null,
      status: normalizeLine(account?.status, mapping.status === 1 ? "active" : "unknown"),
    };
  });

  const pulseBrandName = getShopInfoString(pulse, ["brand_name", "shop_name", "store_name"]);
  const pulseBrandDomain = getShopInfoString(pulse, ["brand_domain", "shop_domain", "store_domain"]);

  const gaps: string[] = [];
  if (storefronts.length === 0) {
    gaps.push("No connected commerce storefront is visible in workspace mappings.");
  }
  if (sourcingConnections.length === 0) {
    gaps.push("No connected sourcing account is visible for source-product.");
  }
  if (marketingPlatforms.length === 0) {
    gaps.push("No marketing platform is currently configured in workspace mappings or local ads credentials.");
  }
  if (!billing || billing.status !== "ACTIVE") {
    gaps.push("Workspace billing window is missing or inactive; commerce reads may be blocked.");
  }
  if (!pulse?.report_status || pulse.report_status.toLowerCase() !== "active") {
    gaps.push("Pulse monitoring is not fully active yet.");
  }
  if (integrations.some((entry) => entry.status !== "ACTIVE")) {
    gaps.push("One or more workspace integrations are connected but not fully ACTIVE.");
  }
  if (integrations.some((entry) => Boolean(entry.error_message?.trim()))) {
    gaps.push("At least one workspace integration reports a recent sync or connection error.");
  }
  for (const warning of warnings) {
    gaps.push(warning);
  }

  return {
    version: CONTEXT_VERSION,
    generatedAt: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      name: params.workspaceName?.trim() || workspace.name,
      status: workspace.status,
      industry:
        typeof workspace.settings?.industry === "string" ? workspace.settings.industry : null,
      logoUrl: workspace.logo_url,
      ownerId: workspace.owner_id,
      memberRole: membership?.role ?? null,
      memberCount: memberRows.length,
      operatorName: state.user.userName?.trim() || "Unknown",
      operatorEmail: state.user.userEmail?.trim() || "Unknown",
    },
    commerce: {
      storefronts,
      primaryStoreUrl: pulseBrandDomain ? `https://${pulseBrandDomain}` : null,
      primaryStoreName: pulseBrandName,
      primaryTimezone: storefronts[0]?.timezone ?? pulse?.timezone ?? null,
      primaryCurrency: storefronts[0]?.currency ?? null,
    },
    sourcing: {
      connections: sourcingConnections,
    },
    marketing: {
      platforms: marketingPlatforms,
      localCredentials,
    },
    monitoring: {
      billing: {
        active: Boolean(billing && billing.status === "ACTIVE"),
        validFrom: billing?.valid_from ?? null,
        validTo: billing?.valid_to ?? null,
        budgetUsd: toUsd(billing?.internal_budget_microusd),
        usedUsd: toUsd(billing?.internal_used_microusd),
      },
      pulse: {
        enabled: Boolean(pulse),
        timezone: pulse?.timezone ?? null,
        reportUtcHour: pulse?.report_utc_hour ?? null,
        status: pulse?.status ?? null,
        reportStatus: pulse?.report_status ?? null,
        brandName: pulseBrandName,
        brandDomain: pulseBrandDomain,
      },
    },
    gaps,
  };
}

function buildTemplateValues(context: BustlyBootstrapContext): Record<string, string> {
  const industry = context.workspace.industry ?? "ecommerce";
  const billingSummary = context.monitoring.billing.active
    ? `ACTIVE window until ${context.monitoring.billing.validTo ?? "unknown"}; budget=${context.monitoring.billing.budgetUsd ?? "unknown"} USD; used=${context.monitoring.billing.usedUsd ?? "unknown"} USD`
    : "Billing is not confirmed ACTIVE; commerce reads/writes may be blocked.";
  const knownConstraints = [
    billingSummary,
    ...context.gaps.filter((gap) => gap !== "Workspace billing window is missing or inactive; commerce reads may be blocked."),
  ].join(" | ");
  const workspaceNotes = [
    `status=${context.workspace.status}`,
    `members=${context.workspace.memberCount}`,
    context.monitoring.pulse.enabled ? `pulse=${context.monitoring.pulse.reportStatus ?? "configured"}` : "pulse=not_configured",
  ].join(", ");
  const commercePlatformSummary = summarizePlatforms(
    context.commerce.storefronts.map((entry) => entry.platform),
    "None connected yet",
  );
  const sourcingPlatformSummary = summarizePlatforms(
    context.sourcing.connections.map((entry) => entry.platform),
    "None connected yet",
  );
  const marketingPlatformSummary = summarizePlatforms(
    context.marketing.platforms.map((entry) => entry.platform),
    "None connected yet",
  );

  return {
    WORKSPACE_NAME: context.workspace.name,
    WORKSPACE_STATUS: context.workspace.status,
    WORKSPACE_INDUSTRY: industry,
    OPERATOR_NAME: context.workspace.operatorName,
    OPERATOR_EMAIL: context.workspace.operatorEmail,
    MEMBER_COUNT: String(context.workspace.memberCount),
    COMMERCE_PLATFORM_SUMMARY: commercePlatformSummary,
    SOURCING_PLATFORM_SUMMARY: sourcingPlatformSummary,
    MARKETING_PLATFORM_SUMMARY: marketingPlatformSummary,
    KNOWN_CONSTRAINTS: knownConstraints,
    WORKSPACE_NOTES: workspaceNotes,
    COMMERCE_STORES: renderCommerceStores(context.commerce.storefronts),
    SOURCING_CONNECTIONS: renderSourcingConnections(context.sourcing.connections),
    MARKETING_PLATFORMS: renderMarketingPlatforms(context.marketing.platforms),
  };
}

async function loadRenderedTemplate(
  name: string,
  values: Record<string, string>,
): Promise<string> {
  const template = await loadWorkspaceTemplate(name);
  return `${MANAGED_MARKER}\n${renderTemplate(template, values).trim()}\n`;
}

async function writeManagedFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf-8");
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, {
      encoding: "utf-8",
      flag: "wx",
    });
  } catch (error) {
    const anyError = error as { code?: string };
    if (anyError.code !== "EEXIST") {
      throw error;
    }
  }
}

async function ensureBustlyLearnings(workspaceDir: string): Promise<void> {
  const learningsDir = path.join(workspaceDir, DEFAULT_LEARNINGS_DIRNAME);
  await fs.mkdir(learningsDir, { recursive: true });
  await Promise.all([
    writeFileIfMissing(path.join(learningsDir, DEFAULT_LEARNINGS_FILENAME), DEFAULT_LEARNINGS_TEMPLATE),
    writeFileIfMissing(path.join(learningsDir, DEFAULT_ERRORS_FILENAME), DEFAULT_ERRORS_TEMPLATE),
    writeFileIfMissing(
      path.join(learningsDir, DEFAULT_FEATURE_REQUESTS_FILENAME),
      DEFAULT_FEATURE_REQUESTS_TEMPLATE,
    ),
  ]);
}

export async function initializeBustlyWorkspaceBootstrap(params: {
  workspaceDir: string;
  workspaceId: string;
  workspaceName?: string;
  force?: boolean;
}): Promise<void> {
  const completed = await isWorkspaceOnboardingCompleted(params.workspaceDir);
  if (completed && !params.force) {
    return;
  }

  const context = await buildBustlyBootstrapContext({
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
  });
  const values = buildTemplateValues(context);
  const workspaceDir = params.workspaceDir;

  await fs.mkdir(workspaceDir, { recursive: true });
  await ensureBustlyLearnings(workspaceDir);

  const [agents, soul, identity, user, tools, heartbeat, bootstrap] = await Promise.all([
    loadRenderedTemplate("AGENTS.md", values),
    loadRenderedTemplate("SOUL.md", values),
    loadRenderedTemplate("IDENTITY.md", values),
    loadRenderedTemplate("USER.md", values),
    loadRenderedTemplate("TOOLS.md", values),
    loadRenderedTemplate("HEARTBEAT.md", values),
    loadRenderedTemplate("BOOTSTRAP.md", values),
  ]);

  await Promise.all([
    writeManagedFile(path.join(workspaceDir, "AGENTS.md"), agents),
    writeManagedFile(path.join(workspaceDir, "SOUL.md"), soul),
    writeManagedFile(path.join(workspaceDir, "IDENTITY.md"), identity),
    writeManagedFile(path.join(workspaceDir, "USER.md"), user),
    writeManagedFile(path.join(workspaceDir, "TOOLS.md"), tools),
    writeManagedFile(path.join(workspaceDir, "HEARTBEAT.md"), heartbeat),
    writeManagedFile(path.join(workspaceDir, "BOOTSTRAP.md"), bootstrap),
  ]);
}
