/**
 * Meta Ads API Client
 * Direct requests to Facebook Graph API
 */

import { getPlatformCredentials } from "./credentials.js";

const META_API_URL = "https://graph.facebook.com/v25.0";

/**
 * Meta Ads API Error
 */
export class MetaAdsError extends Error {
  constructor(status, statusText, body, errorData) {
    super(`Meta Ads Error ${status}: ${statusText}`);
    this.name = "MetaAdsError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.errorData = errorData;
  }
}

/**
 * Meta Ads Client
 */
export class MetaAdsClient {
  constructor(config) {
    if (config?.accessToken && config?.adAccountId) {
      this.accessToken = config.accessToken;
      this.adAccountId = config.adAccountId;
    } else {
      const creds = getPlatformCredentials("meta-ads");
      this.accessToken = creds.accessToken;
      this.adAccountId = creds.adAccountId;
    }

    if (!this.accessToken) {
      throw new Error(`
\u274C Missing Meta Ads Access Token

To get your Meta Ads Access Token:
1. Go to: https://developers.facebook.com/tools/explorer/
2. Generate User Access Token with 'ads_read' permission
3. Or create System User token in Business Manager (recommended)

Then configure it:
  node scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'
`);
    }

    if (!this.adAccountId) {
      throw new Error(`
\u274C Missing Meta Ads Ad Account ID

Your Ad Account ID is required. Find it in your Facebook Ads Manager:
1. Go to: https://www.facebook.com/ads/manager/accounts
2. Your Ad Account ID is shown in the URL or account settings

Then configure it:
  node scripts/run.js config set-meta-ads '{"accessToken":"xxx","adAccountId":"123456789"}'
`);
    }
  }

  getActId() {
    const id = this.adAccountId.replace(/^act_/, "");
    return `act_${id}`;
  }

  async request(path, options = {}) {
    const { method = "GET", params = {}, body } = options;

    const url = `${META_API_URL}/${path}`;

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value);
    });

    const requestConfig = {
      method,
      headers,
    };

    let fullUrl = url;
    if (method === "GET" && searchParams.toString()) {
      fullUrl = `${url}?${searchParams.toString()}`;
    }

    if (body && method === "POST") {
      requestConfig.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, requestConfig);

    if (!response.ok) {
      const error = await response.text();
      let errorData;
      try {
        const parsed = JSON.parse(error);
        errorData = parsed.error;
      } catch {
        // ignore
      }
      throw new MetaAdsError(response.status, response.statusText, error, errorData);
    }

    return response.json();
  }

  // Ad Account API

  async getAdAccount(fields) {
    const fieldList = fields || [
      "name",
      "account_status",
      "currency",
      "timezone_name",
      "amount_spent",
      "balance",
    ];

    return this.request(`${this.getActId()}?fields=${fieldList.join(",")}`);
  }

  // Campaigns API

  async getCampaigns(options) {
    const defaultFields = [
      "id",
      "name",
      "status",
      "effective_status",
      "objective",
      "daily_budget",
      "lifetime_budget",
      "created_time",
      "updated_time",
    ];

    const fields = options?.fields || defaultFields;
    const params = {
      fields: fields.join(","),
    };

    if (options?.limit) {
      params.limit = String(options.limit);
    }

    if (options?.status) {
      params.filtering = JSON.stringify([
        { field: "status", operator: "IN", value: options.status },
      ]);
    }

    if (options?.effectiveStatus) {
      params.filtering = JSON.stringify([
        { field: "effective_status", operator: "IN", value: options.effectiveStatus },
      ]);
    }

    return this.request(`${this.getActId()}/campaigns`, { params });
  }

  async getCampaign(campaignId, fields) {
    const fieldList = fields || [
      "id",
      "name",
      "status",
      "objective",
      "daily_budget",
      "lifetime_budget",
      "created_time",
      "updated_time",
    ];

    return this.request(`${campaignId}?fields=${fieldList.join(",")}`);
  }

  async createCampaign(campaign) {
    return this.request(`${this.getActId()}/campaigns`, {
      method: "POST",
      body: {
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status || "PAUSED",
        special_ad_categories: campaign.special_ad_categories || [],
        ...(campaign.daily_budget && { daily_budget: campaign.daily_budget }),
        ...(campaign.lifetime_budget && { lifetime_budget: campaign.lifetime_budget }),
        ...(campaign.bid_strategy && { bid_strategy: campaign.bid_strategy }),
      },
    });
  }

  async updateCampaign(campaignId, updates) {
    return this.request(campaignId, {
      method: "POST",
      body: updates,
    });
  }

  async pauseCampaign(campaignId) {
    return this.updateCampaign(campaignId, { status: "PAUSED" });
  }

  async activateCampaign(campaignId) {
    return this.updateCampaign(campaignId, { status: "ACTIVE" });
  }

  async deleteCampaign(campaignId) {
    return this.request(campaignId, {
      method: "DELETE",
    });
  }

  // Ad Sets API

  async getAdSets(options) {
    const defaultFields = [
      "id",
      "name",
      "status",
      "campaign_id",
      "daily_budget",
      "lifetime_budget",
      "targeting",
      "optimization_goal",
      "bid_amount",
      "billing_event",
    ];

    const fields = options?.fields || defaultFields;
    let endpoint = options?.campaignId
      ? `${options.campaignId}/adsets`
      : `${this.getActId()}/adsets`;

    const params = {
      fields: fields.join(","),
    };

    if (options?.limit) {
      params.limit = String(options.limit);
    }

    return this.request(endpoint, { params });
  }

  async getAdSet(adSetId, fields) {
    const fieldList = fields || [
      "id",
      "name",
      "status",
      "campaign_id",
      "daily_budget",
      "lifetime_budget",
      "targeting",
      "optimization_goal",
      "bid_amount",
      "billing_event",
    ];

    return this.request(`${adSetId}?fields=${fieldList.join(",")}`);
  }

  async createAdSet(adSet) {
    return this.request(`${this.getActId()}/adsets`, {
      method: "POST",
      body: adSet,
    });
  }

  async updateAdSet(adSetId, updates) {
    return this.request(adSetId, {
      method: "POST",
      body: updates,
    });
  }

  // Ads API

  async getAds(options) {
    const defaultFields = [
      "id",
      "name",
      "status",
      "adset_id",
      "campaign_id",
      "creative",
      "created_time",
    ];

    const fields = options?.fields || defaultFields;

    let endpoint = `${this.getActId()}/ads`;
    if (options?.adSetId) {
      endpoint = `${options.adSetId}/ads`;
    } else if (options?.campaignId) {
      endpoint = `${options.campaignId}/ads`;
    }

    const params = {
      fields: fields.join(","),
    };

    if (options?.limit) {
      params.limit = String(options.limit);
    }

    return this.request(endpoint, { params });
  }

  async getAd(adId, fields) {
    const fieldList = fields || ["id", "name", "status", "adset_id", "campaign_id", "creative"];

    return this.request(`${adId}?fields=${fieldList.join(",")}`);
  }

  // Insights API

  async getAccountInsights(options) {
    const defaultFields = [
      "spend",
      "impressions",
      "clicks",
      "reach",
      "cpc",
      "cpm",
      "ctr",
      "frequency",
    ];

    const fields = options?.fields || defaultFields;
    const params = {
      fields: fields.join(","),
    };

    if (options?.datePreset) {
      params.date_preset = options.datePreset;
    } else if (options?.dateRange) {
      params.time_range = JSON.stringify(options.dateRange);
    } else {
      params.date_preset = "last_30d";
    }

    if (options?.breakdowns) {
      params.breakdowns = options.breakdowns.join(",");
    }

    if (options?.timeIncrement) {
      params.time_increment = String(options.timeIncrement);
    }

    return this.request(`${this.getActId()}/insights`, { params });
  }

  async getCampaignInsights(campaignId, options) {
    const defaultFields = [
      "spend",
      "impressions",
      "clicks",
      "reach",
      "cpc",
      "cpm",
      "ctr",
      "actions",
    ];

    const fields = options?.fields || defaultFields;
    const params = {
      fields: fields.join(","),
    };

    if (options?.datePreset) {
      params.date_preset = options.datePreset;
    } else if (options?.dateRange) {
      params.time_range = JSON.stringify(options.dateRange);
    } else {
      params.date_preset = "last_7d";
    }

    return this.request(`${campaignId}/insights`, { params });
  }

  async getAdSetInsights(adSetId, options) {
    const defaultFields = ["spend", "impressions", "clicks", "cpc", "cpm", "ctr"];

    const fields = options?.fields || defaultFields;
    const params = {
      fields: fields.join(","),
      date_preset: options?.datePreset || "last_7d",
    };

    return this.request(`${adSetId}/insights`, { params });
  }

  async getAdInsights(adId, options) {
    const defaultFields = ["spend", "impressions", "clicks", "cpc", "cpm", "ctr"];

    const fields = options?.fields || defaultFields;
    const params = {
      fields: fields.join(","),
      date_preset: options?.datePreset || "last_7d",
    };

    return this.request(`${adId}/insights`, { params });
  }
}
