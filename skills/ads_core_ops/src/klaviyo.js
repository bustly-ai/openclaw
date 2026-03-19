/**
 * Klaviyo API Client
 * Direct requests to Klaviyo REST API
 */

import { getPlatformCredentials } from "./credentials.js";

const DEFAULT_BASE_URL = "https://a.klaviyo.com/api";
const DEFAULT_REVISION = "2026-01-15";

/**
 * Klaviyo API Error
 */
export class KlaviyoError extends Error {
  constructor(status, statusText, body) {
    super(`Klaviyo Error ${status}: ${statusText}`);
    this.name = "KlaviyoError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Klaviyo Client
 */
export class KlaviyoClient {
  constructor(config) {
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
      this.revision = config.revision || DEFAULT_REVISION;
    } else {
      const creds = getPlatformCredentials("klaviyo");
      this.apiKey = creds.apiKey;
      this.revision = creds.revision || DEFAULT_REVISION;
    }
    this.baseUrl = config?.baseUrl || DEFAULT_BASE_URL;

    if (!this.apiKey) {
      throw new Error(`
\u274C Missing Klaviyo API Key

To get your Klaviyo API Key:
1. Go to: https://www.klaviyo.com/create-private-api-key
2. Create a new Private API Key
3. Copy the key (starts with 'pk_')

Then configure it:
  node scripts/run.js config set-klaviyo pk_your_key_here
`);
    }
  }

  buildUrl(path, params) {
    const baseUrl = this.baseUrl.replace(/\/$/, "");
    const cleanPath = path.replace(/^\//, "");
    let url = `${baseUrl}/${cleanPath}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, value);
      });
      const paramString = searchParams.toString();
      if (paramString) {
        url += `?${paramString}`;
      }
    }

    return url;
  }

  async request(path, options = {}) {
    const {
      method = "GET",
      params,
      body,
      fields,
      wrapBody = true,
    } = options;

    let url = this.buildUrl(path, params);

    if (fields) {
      const fieldParams = Object.entries(fields)
        .map(([resourceType, fieldList]) => `fields[${resourceType}]=${fieldList}`)
        .join("&");
      url += (url.includes("?") ? "&" : "?") + fieldParams;
    }

    const headers = {
      Authorization: `Klaviyo-API-Key ${this.apiKey}`,
      revision: this.revision,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const requestConfig = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      requestConfig.body = wrapBody
        ? JSON.stringify({ data: body })
        : JSON.stringify(body);
    }

    const response = await fetch(url, requestConfig);

    if (!response.ok) {
      const error = await response.text();
      throw new KlaviyoError(response.status, response.statusText, error);
    }

    return response.json();
  }

  // Profiles API

  async getProfiles(options) {
    const params = {};
    if (options?.filter) params.filter = options.filter;
    if (options?.pageSize) params["page[size]"] = String(options.pageSize);
    if (options?.sort) params.sort = options.sort;

    const fields = options?.fields ? { profile: options.fields } : undefined;

    return this.request("/profiles", { params, fields });
  }

  async getProfile(profileId) {
    return this.request(`/profiles/${profileId}`);
  }

  async createProfile(attributes) {
    return this.request("/profiles", {
      method: "POST",
      body: {
        type: "profile",
        attributes,
      },
    });
  }

  async updateProfile(profileId, attributes) {
    return this.request(`/profiles/${profileId}`, {
      method: "PATCH",
      body: {
        type: "profile",
        id: profileId,
        attributes,
      },
    });
  }

  // Lists API

  async getLists(options) {
    const fields = options?.fields ? { list: options.fields } : undefined;
    return this.request("/lists", { fields });
  }

  async getList(listId) {
    return this.request(`/lists/${listId}`);
  }

  async createList(name) {
    return this.request("/lists", {
      method: "POST",
      body: {
        type: "list",
        attributes: { name },
      },
    });
  }

  async addProfilesToList(listId, profileIds) {
    return this.request(`/lists/${listId}/relationships/profiles`, {
      method: "POST",
      body: profileIds.map((id) => ({
        type: "profile",
        id,
      })),
      wrapBody: false,
    });
  }

  async removeProfilesFromList(listId, profileIds) {
    return this.request(`/lists/${listId}/relationships/profiles`, {
      method: "DELETE",
      body: profileIds.map((id) => ({
        type: "profile",
        id,
      })),
      wrapBody: false,
    });
  }

  // Segments API

  async getSegments(options) {
    const fields = options?.fields ? { segment: options.fields } : undefined;
    return this.request("/segments", { fields });
  }

  async getSegment(segmentId) {
    return this.request(`/segments/${segmentId}`);
  }

  // Campaigns API

  async getCampaigns(options) {
    const params = {};
    if (options?.channel) {
      params.filter = `equals(messages.channel,"${options.channel}")`;
    }
    if (options?.filter) {
      params.filter = options.filter;
    }

    const fields = options?.fields ? { campaign: options.fields } : undefined;

    return this.request("/campaigns", { params, fields });
  }

  async getCampaign(campaignId) {
    return this.request(`/campaigns/${campaignId}`);
  }

  async sendCampaign(campaignId) {
    return this.request("/campaign-send-jobs", {
      method: "POST",
      body: {
        type: "campaign-send-job",
        attributes: {
          relationships: {
            campaign: {
              data: {
                type: "campaign",
                id: campaignId,
              },
            },
          },
        },
      },
    });
  }

  // Flows API

  async getFlows(options) {
    const params = {};
    if (options?.filter) params.filter = options.filter;

    const fields = options?.fields ? { flow: options.fields } : undefined;

    return this.request("/flows", { params, fields });
  }

  async getFlow(flowId) {
    return this.request(`/flows/${flowId}`);
  }

  // Events API

  async getEvents(options) {
    const params = {};
    if (options?.filter) params.filter = options.filter;
    if (options?.pageSize) params["page[size]"] = String(options.pageSize);

    return this.request("/events", { params });
  }

  async createEvent(event) {
    return this.request("/events", {
      method: "POST",
      body: {
        type: "event",
        attributes: event,
      },
    });
  }

  // Metrics API

  async getMetrics(options) {
    const fields = options?.fields ? { metric: options.fields } : undefined;
    return this.request("/metrics", { fields });
  }

  async getMetric(metricId) {
    return this.request(`/metrics/${metricId}`);
  }

  async getMetricData(metricId, options) {
    const params = {};
    if (options?.filter) params.filter = options.filter;
    if (options?.pageSize) params["page[size]"] = String(options.pageSize);

    return this.request(`/metrics/${metricId}/data`, { params });
  }

  // Templates API

  async getTemplates(options) {
    const params = {};
    if (options?.filter) params.filter = options.filter;

    const fields = options?.fields ? { template: options.fields } : undefined;

    return this.request("/templates", { params, fields });
  }

  async getTemplate(templateId) {
    return this.request(`/templates/${templateId}`);
  }

  // Catalogs API

  async getCatalogs(options) {
    const fields = options?.fields ? { catalog: options.fields } : undefined;
    return this.request("/catalogs", { fields });
  }

  // Webhooks API

  async getWebhooks(options) {
    const fields = options?.fields ? { webhook: options.fields } : undefined;
    return this.request("/webhooks", { fields });
  }

  async createWebhook(webhook) {
    return this.request("/webhooks", {
      method: "POST",
      body: {
        type: "webhook",
        attributes: webhook,
      },
    });
  }
}