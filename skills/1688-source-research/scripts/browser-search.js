#!/usr/bin/env node

const DEFAULT_LOGIN_URL = "https://www.1688.com/";

function toDesktopSortType(sort) {
  const value = String(sort || "sale").trim();
  if (value === "price_asc") return "price_asc";
  if (value === "price_desc") return "price_desc";
  if (value === "default" || value === "comprehensive" || value === "all") return "";
  return "sale_quantity_desc";
}

function buildDesktopSearchLandingUrl(sort, page) {
  const params = new URLSearchParams();
  const sortType = toDesktopSortType(sort);
  if (sortType) {
    params.set("sortType", sortType);
  }
  const pageIndex = Math.max(1, Number(page || 1) || 1);
  if (pageIndex > 1) {
    params.set("beginPage", String(pageIndex));
  }
  const query = params.toString();
  return query
    ? `https://s.1688.com/selloffer/offer_search.htm?${query}`
    : "https://s.1688.com/selloffer/offer_search.htm";
}

function urlContainsKeyword(rawUrl, keyword) {
  const expected = String(keyword || "").trim();
  if (!expected) return true;
  try {
    const url = new URL(String(rawUrl || ""));
    const candidates = [
      url.searchParams.get("keywords"),
      url.searchParams.get("keyword"),
      url.searchParams.get("q"),
      url.searchParams.get("search"),
    ]
      .map((value) => decodeURIComponent(String(value || "").trim()))
      .filter(Boolean);
    if (candidates.length === 0) return false;
    return candidates.some((value) => value.includes(expected));
  } catch {
    const normalizedUrl = decodeURIComponent(String(rawUrl || ""));
    return normalizedUrl.includes(expected);
  }
}

function usage() {
	console.error(`Usage:
	  node scripts/browser-search.js --keyword "<keyword>" [options]

	Options:
	  --sort <sale|price_asc|price_desc>
	  --limit <n>
	  --page <n>
	  --timeout <seconds>
	  --relay-host <host>         Bustly relay host (default 127.0.0.1)
	  --relay-port <port>         Bustly relay port (recommended)
	  --relay-port-candidates <csv>
	  --relay-token <token>       Bustly relay gateway token
	  --login-url <url>
	  --verbose
`);
}

function parseArgs(argv) {
  const args = {
    keyword: "",
	  sort: "sale",
	  limit: 20,
	  page: 1,
	  timeout: 20,
	  relayHost: "127.0.0.1",
	  relayPort: 0,
	  relayPortCandidates: "",
	  relayToken: "",
	  loginUrl: DEFAULT_LOGIN_URL,
	  verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--keyword") {
      args.keyword = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--sort") {
      args.sort = String(next || "").trim() || args.sort;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Math.max(1, Number(next || args.limit) || args.limit);
      index += 1;
      continue;
    }
    if (arg === "--page") {
      args.page = Math.max(1, Number(next || args.page) || args.page);
      index += 1;
      continue;
    }
	    if (arg === "--timeout") {
	      args.timeout = Math.max(1, Number(next || args.timeout) || args.timeout);
	      index += 1;
	      continue;
	    }
	    if (arg === "--relay-host") {
	      args.relayHost = String(next || "").trim() || args.relayHost;
	      index += 1;
	      continue;
    }
    if (arg === "--relay-port") {
      args.relayPort = Math.max(0, Number(next || args.relayPort) || 0);
      index += 1;
      continue;
    }
    if (arg === "--relay-port-candidates") {
      args.relayPortCandidates = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-token") {
      args.relayToken = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--login-url") {
      args.loginUrl = String(next || "").trim() || args.loginUrl;
      index += 1;
      continue;
    }
    if (arg === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.keyword) {
    usage();
    throw new Error("Missing required --keyword");
  }

  return args;
}

function debug(enabled, message) {
  if (enabled) {
    console.error(`[1688-relay] ${message}`);
  }
}

function createEmptyResult(keyword, pageSize, pageIndex) {
  return {
    success: true,
    source: "1688",
    request_id: `1688-${Date.now()}`,
    total_count: 0,
    products: [],
    page_size: pageSize,
    page_index: pageIndex,
    keyword,
  };
}

function isBlockedOrRiskUrl(url) {
  const value = String(url || "");
  return value.includes("/punish?") || value.includes("_____tmd_____");
}

function is1688OrLoginUrl(url) {
  const value = String(url || "");
  return value.includes("1688.com") || value.includes("login.taobao.com");
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (event) =>
        reject(event.error || new Error("WebSocket error")),
      );
      this.ws.addEventListener("message", (event) => {
        let message = {};
        try {
          message = JSON.parse(String(event.data || "{}"));
        } catch {
          return;
        }
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
          } else {
            pending.resolve(message.result || {});
          }
          return;
        }
        for (const listener of this.listeners) {
          listener(message);
        }
      });
      this.ws.addEventListener("close", () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error("CDP socket closed"));
        }
        this.pending.clear();
      });
    });
  }

  async send(method, params = {}, options = {}) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (options.sessionId) {
      payload.sessionId = options.sessionId;
    }
    this.ws.send(JSON.stringify(payload));
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression, options = {}) {
    const result = await this.send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: options.awaitPromise !== false,
        returnByValue: options.returnByValue !== false,
      },
      { sessionId: options.sessionId || "" },
    );
    return result?.result?.value;
  }

  onEvent(listener) {
    this.listeners.push(listener);
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

function withRelayHeaders(token) {
  const normalized = String(token || "").trim();
  return normalized ? { "x-openclaw-relay-token": normalized } : {};
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${url} responded with ${response.status}${body ? `: ${body}` : ""}`);
  }
  return response.json();
}

function appendTokenToWsUrl(wsUrl, token) {
  const normalized = String(token || "").trim();
  if (!normalized) return wsUrl;
  const separator = wsUrl.includes("?") ? "&" : "?";
  return `${wsUrl}${separator}token=${encodeURIComponent(normalized)}`;
}

function resolveConnection(args) {
  const relayHost = String(args.relayHost || "127.0.0.1").trim() || "127.0.0.1";
  const relayToken = String(args.relayToken || "").trim();
  const candidatePorts = [
    Number(args.relayPort || 0),
    ...String(args.relayPortCandidates || "")
      .split(",")
      .map((value) => Number(String(value || "").trim())),
  ].filter((value) => Number.isFinite(value) && Number(value) > 0);
  const relayPortCandidates = Array.from(new Set(candidatePorts)).map((value) => Number(value));
  const relayPort = relayPortCandidates[0] || 0;

  if (!Number.isFinite(relayPort) || relayPort <= 0 || relayPortCandidates.length === 0) {
    throw new Error("NO_RELAY_CONFIG: relay port is required for relay-only mode.");
  }
  if (!relayToken) {
    throw new Error("NO_RELAY_TOKEN: relay token is required for relay-only mode.");
  }

  return {
    isRelay: true,
    relayHost,
    relayPort,
    relayPortCandidates,
    relayToken,
    baseHttpUrl: `http://${relayHost}:${relayPort}`,
  };
}

async function getVersion(connection) {
  const relayHost = String(connection.relayHost || "127.0.0.1").trim() || "127.0.0.1";
  const relayToken = String(connection.relayToken || "").trim();
  const relayPortCandidates = Array.isArray(connection.relayPortCandidates)
    ? connection.relayPortCandidates
    : [connection.relayPort];
  if (!relayPortCandidates.length) {
    throw new Error("NO_RELAY_CONFIG: relay port is missing.");
  }
  if (!relayToken) {
    throw new Error("NO_RELAY_TOKEN: relay token is missing.");
  }
  const headers = withRelayHeaders(relayToken);
  let lastError = null;
  for (const relayPort of relayPortCandidates) {
    const baseUrl = `http://${relayHost}:${relayPort}`;
    try {
      const payload = await fetchJson(`${baseUrl}/json/version`, { headers });
      if (!payload?.webSocketDebuggerUrl) {
        throw new Error("No CDP websocket URL available from relay/json/version.");
      }
      return { payload, baseUrl, headers, relayPort };
    } catch (error) {
      lastError = error;
    }
  }
  const details = lastError ? String(lastError.message || lastError) : "unknown relay error";
  throw new Error(`NO_RELAY_SESSION: ${details} (tried ports: ${relayPortCandidates.join(",")})`);
}

async function listTargets(ctx) {
  return fetchJson(`${ctx.baseHttpUrl}/json/list`, { headers: ctx.headers });
}

function select1688Target(targets) {
  const pages = Array.isArray(targets)
    ? targets
        .filter((target) => target?.type === "page")
        .filter((target) => {
          const url = String(target?.url || "");
          return (
            !isBlockedOrRiskUrl(url) &&
            (url.includes("1688.com") || url.includes("login.taobao.com"))
          );
        })
    : [];

  const scored = pages
    .map((target) => {
      const url = String(target?.url || "");
      let score = 0;
      if (url.includes("/selloffer/offer_search.htm")) score += 120;
      if (url.includes("offer_search")) score += 100;
      if (url.includes("s.1688.com")) score += 90;
      if (url.includes("www.1688.com")) score += 70;
      if (url.includes("/search")) score += 60;
      if (url.includes("login.taobao.com")) score += 50;
      if (url.includes("m.1688.com")) score += 20;
      return { target, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.target || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createTargetViaCdp(ctx, url) {
  const client = new CDPClient(ctx.wsUrl);
  await client.open();
  try {
    const params = ctx.isRelay
      ? { url, asAgent: true, retain: false }
      : { url };
    const created = await client.send("Target.createTarget", params);
    return String(created?.targetId || "").trim();
  } finally {
    client.close();
  }
}

async function waitForTarget(ctx, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const selected = predicate(await listTargets(ctx));
    if (selected) return selected;
    await sleep(250);
  }
  return predicate(await listTargets(ctx));
}

async function findOrCreateTarget(ctx, loginUrl) {
  let target = select1688Target(await listTargets(ctx));
  if (target) return target;

  const createdTargetId = await createTargetViaCdp(ctx, loginUrl);
  if (createdTargetId) {
    const createdTarget = await waitForTarget(
      ctx,
      (targets) =>
        (Array.isArray(targets) ? targets : []).find(
          (item) => String(item?.id || "").trim() === createdTargetId,
        ) || null,
      7000,
    );
    if (createdTarget) return createdTarget;
  }

  target = select1688Target(await listTargets(ctx));
  if (target) return target;

  target = await waitForTarget(ctx, select1688Target, 4000);
  if (target) return target;
  throw new Error("NO_1688_TAB: no debuggable 1688 tab available in relay session.");
}

async function withTargetSession(ctx, target, fn) {
  let currentTarget = target;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = new CDPClient(ctx.wsUrl);
    await client.open();
    try {
      const targetId = String(currentTarget?.id || "").trim();
      if (!targetId) {
        throw new Error("target id missing");
      }
      const attached = await client.send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      const sessionId = String(attached?.sessionId || "").trim();
      if (!sessionId) {
        throw new Error(`attachToTarget returned empty sessionId for target ${targetId}`);
      }
      await client.send("Page.enable", {}, { sessionId });
      await client.send("Runtime.enable", {}, { sessionId });
      return await fn(client, sessionId);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      const staleTarget =
        message.includes("No tab with id") ||
        message.includes("No target with given id") ||
        message.includes("target closed");
      if (!staleTarget || attempt >= 2) {
        throw error;
      }
      debug(ctx?.verbose, `Stale relay target detected (${message}); refreshing target.`);
      const refreshed = await waitForTarget(ctx, select1688Target, 1500);
      if (!refreshed) {
        throw error;
      }
      currentTarget = refreshed;
      await sleep(150);
    } finally {
      client.close();
    }
  }

  throw lastError || new Error("failed to attach relay target");
}

async function navigate(client, sessionId, url) {
  await client.send("Page.navigate", { url }, { sessionId });
  await sleep(2000);
}

async function submitDesktopSearchOnSession(client, sessionId, keyword) {
  const submitted = await client.evaluate(
    `(() => {
      const selectors = [
        'input[name="keywords"]',
        'input[data-role="search-input"]',
        'input[placeholder*="搜索"]',
        'input[type="search"]',
        '.search-input input',
        '.search-text input',
        'input[type="text"]'
      ];
      const input = selectors
        .map((selector) => document.querySelector(selector))
        .find(Boolean);
      if (!input) return false;
      input.focus();
      const nativeSetter =
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(input, ${JSON.stringify(keyword)});
      } else {
        input.value = ${JSON.stringify(keyword)};
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      const form = input.form || document.querySelector('form');
      const submitBtnSelectors = [
        'button[type="submit"]',
        'button[data-spm-anchor-id*="search"]',
        'button[aria-label*="搜索"]',
        'button.search-btn',
        '.search-btn',
        '.search-button',
        '.fui-search-btn',
        'input[type="submit"]'
      ];
      let submitBtn = null;
      for (const selector of submitBtnSelectors) {
        submitBtn =
          form?.querySelector(selector) ||
          document.querySelector(selector);
        if (submitBtn) break;
      }

      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
        return true;
      }
      const enterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      });
      const enterUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      });
      input.dispatchEvent(enterDown);
      input.dispatchEvent(enterUp);
      if (document.activeElement && document.activeElement !== input) {
        return true;
      }
      return false;
    })()`,
    { sessionId },
  );
  if (!submitted) {
    return false;
  }
  await sleep(1800);
  return true;
}

async function waitForResultsTarget(ctx, timeoutMs, preferredTargetId = "") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await listTargets(ctx);
    const preferred = Array.isArray(targets)
      ? targets.find((item) => String(item?.id || "").trim() === String(preferredTargetId || "").trim())
      : null;
    const target = preferred && is1688OrLoginUrl(preferred?.url) ? preferred : select1688Target(targets);
    const url = String(target?.url || "");
    if (url.includes("offer_search")) {
      return target;
    }
    if (url.includes("login.taobao.com") || isBlockedOrRiskUrl(url)) {
      return target;
    }
    await sleep(500);
  }
  const targets = await listTargets(ctx);
  const preferred = Array.isArray(targets)
    ? targets.find((item) => String(item?.id || "").trim() === String(preferredTargetId || "").trim())
    : null;
  if (preferred && is1688OrLoginUrl(preferred?.url)) return preferred;
  return select1688Target(targets);
}

async function ensureDesktopResultsTarget(ctx, target, args) {
  const landingUrl = buildDesktopSearchLandingUrl(args.sort, args.page);
  let workingTarget = target;

  try {
    const freshTargetId = await createTargetViaCdp(ctx, landingUrl);
    const freshTarget = await waitForTarget(
      ctx,
      (targets) =>
        (Array.isArray(targets) ? targets : []).find(
          (item) => String(item?.id || "").trim() === String(freshTargetId || "").trim(),
        ) || null,
      7000,
    );
    if (freshTarget && is1688OrLoginUrl(freshTarget?.url)) {
      workingTarget = freshTarget;
    }
  } catch (error) {
    debug(args.verbose, `createTarget(landingUrl) failed, fallback to existing target: ${String(error?.message || error)}`);
  }

  await withTargetSession(ctx, workingTarget, async (client, sessionId) => {
    const href = String((await client.evaluate(`location.href`, { sessionId })) || "");
    if (!is1688OrLoginUrl(href)) {
      debug(args.verbose, `Attached target is not 1688/login (${href}); navigating to desktop search entry.`);
      await navigate(client, sessionId, landingUrl);
    } else if (!href.includes("offer_search")) {
      debug(args.verbose, `Navigating to desktop results page entry: ${landingUrl}`);
      await navigate(client, sessionId, landingUrl);
    }

    const submitted = await submitDesktopSearchOnSession(client, sessionId, args.keyword);
    if (!submitted) {
      debug(args.verbose, `Desktop search input not found on results page; retry from home ${DEFAULT_LOGIN_URL}`);
      await navigate(client, sessionId, DEFAULT_LOGIN_URL);
      const retrySubmitted = await submitDesktopSearchOnSession(client, sessionId, args.keyword);
      if (!retrySubmitted) {
        debug(args.verbose, "Search input still not found after home-page retry.");
      }
      return;
    }

    await sleep(1200);
    const afterHref = String((await client.evaluate(`location.href`, { sessionId })) || "");
    const keywordAppearsInBody = Boolean(
      await client.evaluate(
        `(() => (document.body?.innerText || '').includes(${JSON.stringify(args.keyword)}))()`,
        { sessionId },
      ),
    );
    if (!urlContainsKeyword(afterHref, args.keyword) && !keywordAppearsInBody) {
      debug(args.verbose, `Keyword may not have converged yet after submit: keyword="${args.keyword}" href=${afterHref}`);
    }
  });
  const waited =
    (await waitForResultsTarget(
      ctx,
      Math.max(3000, Number(args.timeout || 20) * 1000),
      String(workingTarget?.id || ""),
    )) || workingTarget;
  return waited;
}

function shouldRetryWithDefaultSort(payload, args) {
  if (String(args?.sort || "").trim() !== "sale") {
    return false;
  }
  const error = String(payload?.error || "").toLowerCase();
  if (!error) {
    const total = Number(payload?.result?.total_count || 0);
    return total <= 0;
  }
  if (
    error.includes("not_logged") ||
    error.includes("login.taobao.com") ||
    error.includes("risk_challenge") ||
    error.includes("no_relay")
  ) {
    return false;
  }
  return (
    error.includes("no_items_extracted") ||
    error.includes("no_results_page") ||
    error.includes("no_products_returned") ||
    error.includes("empty")
  );
}

function normalizeHref(href) {
  const value = String(href || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function safeDecode(value) {
  const text = String(value || "");
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function unwrapNestedUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const candidates = ["url", "target", "redirect", "redirectUrl", "jump_url", "to"];
    for (const key of candidates) {
      const next = parsed.searchParams.get(key);
      if (!next) continue;
      const decoded = safeDecode(next);
      if (/^https?:\/\//i.test(decoded)) {
        return decoded;
      }
    }
  } catch {}
  return value;
}

function extractProductId(url) {
  const rawValue = String(url || "");
  const decodedValue = safeDecode(rawValue);
  const candidates = [rawValue, decodedValue];
  for (const value of candidates) {
    const pathMatch = value.match(/\/offer\/([0-9]{6,})\.html/i);
    if (pathMatch) return pathMatch[1];
    const queryMatch = value.match(/[?&](?:offerId|offerIds|item_id|id)=([0-9]{6,})/i);
    if (queryMatch) return queryMatch[1];
    const encodedQueryMatch = value.match(/(?:offerId|offerIds|item_id|id)%3D([0-9]{6,})/i);
    if (encodedQueryMatch) return encodedQueryMatch[1];
    const encodedPathMatch = value.match(/%2Foffer%2F([0-9]{6,})%2Ehtml/i);
    if (encodedPathMatch) return encodedPathMatch[1];
  }
  return "";
}

function parseItemText(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0] || "";
  const repurchaseLine = lines.find((line) => line.includes("复购率") || line.includes("回头率"));
  const salesLine = lines.find(
    (line) =>
      line.includes("成交") ||
      line.includes("人付款") ||
      line.includes("已售") ||
      line.includes("销量"),
  );
  const location = lines.length > 0 ? lines[lines.length - 1] : "";

  const ratingMatch = repurchaseLine
    ? repurchaseLine.match(/(?:复购率|回头率)[:：]?\s*([0-9.]+%)/)
    : null;
  const priceMatch =
    (salesLine ? salesLine.match(/[￥¥]\s*([0-9.]+)/) : null) ||
    lines.map((line) => line.match(/[￥¥]\s*([0-9.]+)/)).find(Boolean) ||
    null;
  const salesMatch =
    (salesLine ? salesLine.match(/(?:成交|人付款|已售)\s*([0-9.+万亿kK]+)\s*(?:笔|件|人)?/) : null) ||
    null;

  return {
    title,
    rating: ratingMatch ? ratingMatch[1] : "",
    price: priceMatch ? priceMatch[1] : "",
    sales: salesMatch ? salesMatch[1] : "",
    location,
  };
}

async function scrapeResults(ctx, target, limit, keyword, page, timeoutSeconds = 20) {
  return await withTargetSession(ctx, target, async (client, sessionId) => {
    const readSnapshot = async () =>
      await client.evaluate(
        `(() => {
          const href = location.href;
          const title = document.title;
          const bodyText = document.body ? document.body.innerText.slice(0, 6000) : '';
          const items = Array.from(
            document.querySelectorAll(
              [
                'a.item-link',
                'a[href*="/offer/"][href*=".html"]',
                'a[href*="detail.1688.com/offer"]',
                'a[href*="detail.m.1688.com/page/index.html"]',
                'a[href*="offerId="]',
                'a[href*="offerIds="]',
                'a[href*="dj.1688.com"]',
                '[data-offerid] a[href]',
                '[offerid] a[href]',
                '.offer-item a[href]',
                '.common-offer-card a[href]',
                '[class*="offer-card"] a[href]'
              ].join(',')
            )
          )
            .map((anchor) => ({
              href: anchor.href || '',
              offerId:
                anchor.getAttribute('offerid') ||
                anchor.getAttribute('data-offerid') ||
                anchor.getAttribute('data-offer-id') ||
                anchor.dataset?.offerid ||
                anchor.dataset?.offerId ||
                anchor.closest('[offerid],[data-offerid],[data-offer-id]')?.getAttribute('offerid') ||
                anchor.closest('[offerid],[data-offerid],[data-offer-id]')?.getAttribute('data-offerid') ||
                anchor.closest('[offerid],[data-offerid],[data-offer-id]')?.getAttribute('data-offer-id') ||
                '',
              text: (
                anchor.getAttribute('title') ||
                anchor.innerText ||
                anchor.closest('[class*="offer"], [class*="item"], li, article, div')?.innerText ||
                ''
              ).trim(),
              image:
                anchor.querySelector('img.image_src')?.getAttribute('src') ||
                anchor.querySelector('img.image_src')?.getAttribute('data-src') ||
                anchor.querySelector('img')?.getAttribute('src') ||
                anchor.querySelector('img')?.getAttribute('data-src') ||
                '',
            }))
            .filter((item) => item.href)
            .filter((item) => !item.href.includes('similar_search'))
            .filter((item) => !item.href.includes('air.1688.com'))
            .filter((item) => {
              const text = String(item.text || '').trim();
              if (!text) return false;
              if (
                /找相似|去安装|点此可以直接和卖家交流|联系客服|立即咨询/.test(text)
              ) {
                return false;
              }
              return true;
            })
            .filter((item) => {
              const href = String(item.href || '');
              return (
                href.includes('/offer/') ||
                href.includes('detail.1688.com/offer') ||
                href.includes('detail.m.1688.com/page/index.html') ||
                href.includes('dj.1688.com')
              );
            })
            .filter((item, index, arr) => arr.findIndex((x) => x.href === item.href) === index)
            .slice(0, ${Number(limit) + 16});
          const hrefSamples = Array.from(document.querySelectorAll('a'))
            .slice(0, 40)
            .map((anchor) => ({
              href: anchor.href || '',
              text: (anchor.innerText || '').trim().slice(0, 24),
            }))
            .filter((item) => item.href);
          const domStats = {
            totalAnchors: document.querySelectorAll('a').length,
            offerAnchors: document.querySelectorAll('a[href*="/offer/"], a[href*="detail.1688.com/offer"], a[href*="detail.m.1688.com/page/index.html"], a[href*="offerId="], a[href*="offerIds="], a[href*="dj.1688.com"]').length,
            nodesWithOfferId: document.querySelectorAll('[offerid], [data-offerid], [data-offer-id]').length,
          };
          return { href, title, bodyText, items, hrefSamples, domStats };
        })()`,
        { sessionId },
      );

    const deadline = Date.now() + Math.max(3000, Number(timeoutSeconds || 20) * 1000);
    let snapshot = await readSnapshot();
    while (Date.now() < deadline) {
      const href = String(snapshot?.href || "");
      const bodyText = String(snapshot?.bodyText || "");
      const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
      if (href.includes("login.taobao.com")) {
        break;
      }
      if (href.includes("offer_search") || items.length > 0 || bodyText.includes("成交")) {
        break;
      }
      await sleep(600);
      snapshot = await readSnapshot();
    }

    if (String(snapshot?.href || "").includes("login.taobao.com")) {
      return {
        result: createEmptyResult(keyword, limit, page),
        error:
          "NOT_LOGGED_IN: relay tab is still on Taobao/1688 login. Complete login in the same browser profile and rerun search.",
      };
    }

    const hrefValue = String(snapshot?.href || "");
    const bodyValue = String(snapshot?.bodyText || "");
    if (
      hrefValue.includes("/punish?") ||
      hrefValue.includes("_____tmd_____") ||
      bodyValue.includes("x5secdata")
    ) {
      return {
        result: createEmptyResult(keyword, limit, page),
        error: `RISK_CHALLENGE: 1688 anti-bot page detected. Complete verification manually in the same relay-connected browser tab, then rerun search. href=${hrefValue || "unknown"}`,
      };
    }

    const isDesktopResults = hrefValue.includes("offer_search");
    const hasCards = Array.isArray(snapshot?.items) && snapshot.items.length > 0;
    if (!isDesktopResults && !hasCards) {
      const context = {
        href: String(snapshot?.href || ""),
        title: String(snapshot?.title || ""),
      };
      debug(
        ctx?.verbose,
        `No results page context: ${JSON.stringify(context)} body=${String(snapshot?.bodyText || "").slice(0, 220)}`,
      );
      return {
        result: createEmptyResult(keyword, limit, page),
        error: `NO_RESULTS_PAGE: relay tab has not reached the 1688 search results page yet. href=${context.href || "unknown"} title=${context.title || "unknown"}`,
      };
    }

    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    debug(
      ctx?.verbose,
      `Snapshot href=${String(snapshot?.href || "")} title=${String(snapshot?.title || "")} itemCount=${items.length}`,
    );
    if (ctx?.verbose && items.length === 0) {
      debug(
        true,
        `Anchor samples: ${JSON.stringify(Array.isArray(snapshot?.hrefSamples) ? snapshot.hrefSamples.slice(0, 12) : [])}`,
      );
      debug(true, `DOM stats: ${JSON.stringify(snapshot?.domStats || {})}`);
      debug(true, `Body snippet: ${String(snapshot?.bodyText || "").slice(0, 260)}`);
    }
    if (items.length === 0) {
      return {
        result: createEmptyResult(keyword, limit, page),
        error: `NO_ITEMS_EXTRACTED: reached search page but extracted 0 cards. href=${String(snapshot?.href || "unknown")}`,
      };
    }
    const products = items
      .map((item) => {
        const parsed = parseItemText(item.text);
        const rawUrl = normalizeHref(item.href);
        const unwrappedUrl = normalizeHref(unwrapNestedUrl(rawUrl));
        const offerId =
          String(item.offerId || "").trim() ||
          extractProductId(rawUrl) ||
          extractProductId(unwrappedUrl);
        const url =
          offerId &&
          (rawUrl.includes("dj.1688.com") ||
            rawUrl.includes("m.1688.com/offer/") ||
            rawUrl.includes("detail.m.1688.com/page/index.html") ||
            rawUrl.includes("offerId=") ||
            rawUrl.includes("offerIds="))
            ? `https://detail.1688.com/offer/${offerId}.html`
            : unwrappedUrl || rawUrl;
        return {
          product_id: offerId,
          title: parsed.title || "1688 商品",
          url,
          image_url: normalizeHref(item.image),
          price: {
            current: parsed.price || "",
            original: parsed.price || "",
            currency: "CNY",
            discount_percentage: "0",
          },
          rating: parsed.rating || "",
          sales_volume: parsed.sales || "",
          shipping: { from_country: parsed.location || "" },
          platform: "1688",
        };
      })
      .filter((item) =>
        Boolean(
          item.product_id ||
            /detail\.1688\.com\/offer\/\d+\.html/i.test(String(item.url || "")) ||
            (/1688\.com/i.test(String(item.url || "")) && String(item.title || "").trim()),
        ),
      )
      .slice(0, limit);

    if (products.length === 0) {
      const itemSamples = items
        .slice(0, 5)
        .map((item) => `${String(item.href || "").slice(0, 120)}`)
        .join(" | ");
      return {
        result: createEmptyResult(keyword, limit, page),
        error: `NO_ITEMS_EXTRACTED_AFTER_NORMALIZE: matched ${items.length} raw cards but none converted to normalized products. href=${String(snapshot?.href || "unknown")}`,
        diagnostics: {
          item_samples: itemSamples,
        },
      };
    }

    return {
      result: {
        success: true,
        source: "1688",
        request_id: `1688-${Date.now()}`,
        total_count: products.length,
        products,
        page_size: limit,
        page_index: page,
        keyword,
      },
      error: null,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const emptyResult = createEmptyResult(args.keyword, args.limit, args.page);

  let versionCtx = null;
  let versionPayload = null;
  let modeCtx = null;
  let ctx = null;
  try {
    modeCtx = resolveConnection(args);
    versionCtx = await getVersion(modeCtx);
    versionPayload = versionCtx.payload;
    ctx = {
      ...modeCtx,
      relayPort: versionCtx.relayPort,
      baseHttpUrl: versionCtx.baseUrl,
      headers: withRelayHeaders(modeCtx.relayToken),
      wsUrl: appendTokenToWsUrl(versionPayload.webSocketDebuggerUrl, modeCtx.relayToken),
      verbose: args.verbose,
    };
    if (args.verbose && Number(modeCtx.relayPort) !== Number(versionCtx.relayPort)) {
      debug(true, `Relay probe switched port ${modeCtx.relayPort} -> ${versionCtx.relayPort}`);
    }
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          result: emptyResult,
          error: `NO_RELAY_SESSION: ${String(error.message || error)}`,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!ctx.relayToken) {
    console.log(
      JSON.stringify(
        {
          result: emptyResult,
          error:
            "NO_RELAY_TOKEN: relay port configured but gateway token missing. Set --relay-token or SKILL_1688_RELAY_TOKEN.",
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    let target = await findOrCreateTarget(ctx, args.loginUrl || DEFAULT_LOGIN_URL);
    target = await ensureDesktopResultsTarget(ctx, target, args);

    let payload = await scrapeResults(
      ctx,
      target,
      args.limit,
      args.keyword,
      args.page,
      args.timeout,
    );

    if (shouldRetryWithDefaultSort(payload, args)) {
      debug(args.verbose, "Sale sort returned empty/invalid extraction. Retrying with default(comprehensive) sort.");
      const retryArgs = { ...args, sort: "default" };
      target = await ensureDesktopResultsTarget(ctx, target, retryArgs);
      const retryPayload = await scrapeResults(
        ctx,
        target,
        args.limit,
        args.keyword,
        args.page,
        args.timeout,
      );
      const retryCount = Number(retryPayload?.result?.total_count || 0);
      if (!retryPayload?.error && retryCount > 0) {
        retryPayload.result = {
          ...(retryPayload.result || {}),
          retry_strategy: "sale_to_default",
        };
        payload = retryPayload;
      } else if (Number(payload?.result?.total_count || 0) <= 0) {
        payload = retryPayload;
      }
    }

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          result: emptyResult,
          error: `CDP_RUNTIME_FAILED: ${String(error.message || error)}`,
        },
        null,
        2,
      ),
    );
  }
}

await main();
