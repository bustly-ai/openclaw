/**
 * Google Ads API Client
 * Direct requests to Google Ads API (not via Maton Gateway)
 */

import { getPlatformCredentials } from "./credentials.js";

const GOOGLE_ADS_API_URL = "https://googleads.googleapis.com/v23";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Google Ads API Error
 */
export class GoogleAdsError extends Error {
  constructor(status, statusText, body, details) {
    super(`Google Ads Error ${status}: ${statusText}`);
    this.name = "GoogleAdsError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.details = details;
  }
}

/**
 * Google Ads Client
 */
export class GoogleAdsClient {
  constructor(config) {
    if (
      config?.developerToken &&
      config?.clientId &&
      config?.clientSecret &&
      config?.refreshToken
    ) {
      this.developerToken = config.developerToken;
      this.clientId = config.clientId;
      this.clientSecret = config.clientSecret;
      this.refreshToken = config.refreshToken;
      this.loginCustomerId = config.loginCustomerId;
    } else {
      const creds = getPlatformCredentials("google-ads");
      this.developerToken = creds.developerToken;
      this.clientId = creds.clientId;
      this.clientSecret = creds.clientSecret;
      this.refreshToken = creds.refreshToken;
      this.loginCustomerId = creds.loginCustomerId;
    }

    const missing = [];
    if (!this.developerToken) missing.push("developerToken");
    if (!this.clientId) missing.push("clientId");
    if (!this.clientSecret) missing.push("clientSecret");
    if (!this.refreshToken) missing.push("refreshToken");

    if (missing.length > 0) {
      throw new Error(`
\u274C Missing Google Ads Credentials: ${missing.join(", ")}

To set up Google Ads API access:
1. Go to: https://developers.google.com/google-ads/api/docs/first-call/overview
2. Get Developer Token from Google Ads API Center
3. Create OAuth2 credentials in Google Cloud Console
4. Generate refresh token via OAuth flow

Then configure it:
  node scripts/run.js config set-google-ads '{"developerToken":"xxx","clientId":"xxx","clientSecret":"xxx","refreshToken":"xxx"}'
`);
    }
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GoogleAdsError(response.status, response.statusText, error);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken;
  }

  async request(path, options = {}) {
    const { method = "GET", body, customerId } = options;

    const accessToken = await this.getAccessToken();
    const url = `${GOOGLE_ADS_API_URL}${path}`;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "developer-token": this.developerToken,
    };

    if (this.loginCustomerId) {
      headers["login-customer-id"] = this.loginCustomerId;
    }

    if (customerId) {
      headers["login-customer-id"] = customerId.replace(/-/g, "");
    }

    const requestConfig = {
      method,
      headers,
    };

    if (body && method === "POST") {
      requestConfig.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestConfig);

    if (!response.ok) {
      const error = await response.text();
      let details;
      try {
        details = JSON.parse(error);
      } catch {
        // ignore
      }
      throw new GoogleAdsError(response.status, response.statusText, error, details);
    }

    return response.json();
  }

  // Customer API

  async listAccessibleCustomers() {
    return this.request("/customers:listAccessibleCustomers");
  }

  async getCustomer(customerId) {
    const cleanId = customerId.replace(/-/g, "");
    return this.request(`/customers/${cleanId}`);
  }

  // Search API (GAQL)

  async search(customerId, query, options) {
    const cleanId = customerId.replace(/-/g, "");
    const body = { query };

    if (options?.pageSize) {
      body.pageSize = options.pageSize;
    }
    if (options?.pageToken) {
      body.pageToken = options.pageToken;
    }

    return this.request(`/customers/${cleanId}/googleAds:search`, {
      method: "POST",
      body,
      customerId: cleanId,
    });
  }

  async searchStream(customerId, query) {
    const cleanId = customerId.replace(/-/g, "");

    return this.request(`/customers/${cleanId}/googleAds:searchStream`, {
      method: "POST",
      body: { query },
      customerId: cleanId,
    });
  }

  // Common queries

  async getCampaigns(customerId, options) {
    let query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.campaign_budget
      FROM campaign
    `;

    const conditions = [];
    if (options?.status) {
      conditions.push(`campaign.status = '${options.status}'`);
    } else {
      conditions.push("campaign.status != 'REMOVED'");
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY campaign.name";

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    return this.search(customerId, query);
  }

  async getCampaignMetrics(customerId, options) {
    let query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING ${options?.dateRange || "LAST_30_DAYS"}
    `;

    if (options?.campaignId) {
      query += ` AND campaign.id = ${options.campaignId}`;
    }

    query += " ORDER BY metrics.impressions DESC";

    return this.search(customerId, query);
  }

  async getAdGroups(customerId, options) {
    let query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        campaign.id,
        campaign.name
      FROM ad_group
    `;

    const conditions = [];
    if (options?.campaignId) {
      conditions.push(`campaign.id = ${options.campaignId}`);
    }
    if (options?.status) {
      conditions.push(`ad_group.status = '${options.status}'`);
    } else {
      conditions.push("ad_group.status != 'REMOVED'");
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY campaign.name, ad_group.name";

    return this.search(customerId, query);
  }

  async getKeywords(customerId, options) {
    let query = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group.id,
        ad_group.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM keyword_view
    `;

    const conditions = [];
    if (options?.adGroupId) {
      conditions.push(`ad_group.id = ${options.adGroupId}`);
    }
    if (options?.dateRange) {
      conditions.push(`segments.date DURING ${options.dateRange}`);
    } else {
      conditions.push("segments.date DURING LAST_30_DAYS");
    }

    query += ` WHERE ${conditions.join(" AND ")}`;
    query += " ORDER BY metrics.impressions DESC";

    return this.search(customerId, query);
  }

  async getAds(customerId, options) {
    let query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ad_group_ad.ad.type,
        ad_group.id,
        campaign.id
      FROM ad_group_ad
    `;

    const conditions = [];
    if (options?.adGroupId) {
      conditions.push(`ad_group.id = ${options.adGroupId}`);
    }
    if (options?.status) {
      conditions.push(`ad_group_ad.status = '${options.status}'`);
    } else {
      conditions.push("ad_group_ad.status != 'REMOVED'");
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY campaign.id, ad_group.id";

    return this.search(customerId, query);
  }
}