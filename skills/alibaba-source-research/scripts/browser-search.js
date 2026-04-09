#!/usr/bin/env node

function usage() {
  console.error(`Usage:
  node scripts/browser-search.js --keyword "<keyword>" [options]

Options:
  --intent-type <product|supplier|both>
  --site <host>
  --limit <n>
  --page <n>
  --timeout <seconds>
  --relay-host <host>
  --relay-port <port>
  --relay-port-candidates <csv>
  --relay-token <token>
  --verbose
`);
}

function parseArgs(argv) {
  const args = {
    keyword: "",
    intentType: "product",
    site: "www.alibaba.com",
    limit: 20,
    page: 1,
    timeout: 25,
    relayHost: "127.0.0.1",
    relayPort: 0,
    relayPortCandidates: "",
    relayToken: "",
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
    if (arg === "--intent-type") {
      const value = String(next || "").trim().toLowerCase();
      if (value === "product" || value === "supplier" || value === "both") {
        args.intentType = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--site") {
      args.site = String(next || "").trim() || args.site;
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
    console.error(`[alibaba-relay] ${message}`);
  }
}

function createEmptyResult(keyword, intentType, pageSize, pageIndex) {
  return {
    success: true,
    source: "alibaba",
    request_id: `alibaba-${Date.now()}`,
    intent_type: intentType,
    total_count: 0,
    items: [],
    page_size: pageSize,
    page_index: pageIndex,
    keyword,
  };
}

function buildAlibabaSearchUrl(keyword, intentType, site, page) {
  const host = String(site || "www.alibaba.com").trim() || "www.alibaba.com";
  const url = new URL(`https://${host}/trade/search`);
  url.searchParams.set("fsb", "y");
  url.searchParams.set("SearchText", String(keyword || "").trim());
  url.searchParams.set("IndexArea", intentType === "supplier" ? "company_en" : "product_en");
  const pageIndex = Math.max(1, Number(page || 1) || 1);
  if (pageIndex > 1) {
    url.searchParams.set("page", String(pageIndex));
  }
  return url.toString();
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
    relayHost,
    relayPort,
    relayPortCandidates,
    relayToken,
  };
}

async function getVersion(connection) {
  const relayHost = String(connection.relayHost || "127.0.0.1").trim() || "127.0.0.1";
  const relayToken = String(connection.relayToken || "").trim();
  const relayPortCandidates = Array.isArray(connection.relayPortCandidates)
    ? connection.relayPortCandidates
    : [connection.relayPort];
  const headers = withRelayHeaders(relayToken);
  let lastError = null;
  for (const relayPort of relayPortCandidates) {
    const baseUrl = `http://${relayHost}:${relayPort}`;
    try {
      const payload = await fetchJson(`${baseUrl}/json/version`, { headers });
      if (!payload?.webSocketDebuggerUrl) {
        throw new Error("No CDP websocket URL from relay /json/version.");
      }
      return { payload, baseUrl, headers, relayPort };
    } catch (error) {
      lastError = error;
    }
  }
  const details = lastError ? String(lastError.message || lastError) : "unknown relay error";
  throw new Error(`NO_RELAY_SESSION: ${details} (tried ports: ${relayPortCandidates.join(",")})`);
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
    if (options.sessionId) payload.sessionId = options.sessionId;
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

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

async function listTargets(ctx) {
  return fetchJson(`${ctx.baseHttpUrl}/json/list`, { headers: ctx.headers });
}

function isAlibabaRelevantUrl(url) {
  const value = String(url || "");
  return value.includes("alibaba.com");
}

function selectAlibabaTarget(targets) {
  const pages = Array.isArray(targets)
    ? targets.filter((target) => target?.type === "page" && isAlibabaRelevantUrl(target?.url))
    : [];
  const scored = pages
    .map((target) => {
      const url = String(target?.url || "");
      let score = 0;
      if (url.includes("/trade/search")) score += 120;
      if (url.includes("SearchText=")) score += 110;
      if (url.includes("/product-detail/")) score += 80;
      if (url.includes("company_profile")) score += 70;
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
    const variants = [
      {
        url,
        asAgent: true,
        retain: false,
      },
      {
        url,
      },
    ];
    let lastError = null;
    for (const params of variants) {
      try {
        const created = await client.send("Target.createTarget", params);
        const targetId = String(created?.targetId || "").trim();
        if (targetId) return targetId;
      } catch (error) {
        lastError = error;
        debug(
          ctx.verbose,
          `Target.createTarget failed with params=${JSON.stringify(params)}: ${String(
            error?.message || error,
          )}`,
        );
      }
    }
    if (lastError) {
      debug(ctx.verbose, `All createTarget variants failed: ${String(lastError.message || lastError)}`);
    }
    return "";
  } finally {
    client.close();
  }
}

async function waitForTarget(ctx, predicate, timeoutMs = 7000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const selected = predicate(await listTargets(ctx));
    if (selected) return selected;
    await sleep(250);
  }
  return predicate(await listTargets(ctx));
}

async function findOrCreateTarget(ctx, searchUrl) {
  let target = selectAlibabaTarget(await listTargets(ctx));
  if (target) return target;

  let createdTargetId = "";
  try {
    createdTargetId = await createTargetViaCdp(ctx, searchUrl);
  } catch (error) {
    debug(ctx.verbose, `createTargetViaCdp threw error: ${String(error?.message || error)}`);
  }
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

  target = await waitForTarget(ctx, selectAlibabaTarget, 5000);
  if (target) return target;
  throw new Error("NO_ALIBABA_TAB: no debuggable Alibaba tab available in relay session.");
}

async function withTargetSession(ctx, target, fn) {
  let currentTarget = target;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = new CDPClient(ctx.wsUrl);
    await client.open();
    try {
      const targetId = String(currentTarget?.id || "").trim();
      if (!targetId) throw new Error("target id missing");
      const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
      const sessionId = String(attached?.sessionId || "").trim();
      if (!sessionId) throw new Error(`attachToTarget returned empty sessionId for ${targetId}`);
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
      if (!staleTarget || attempt >= 2) throw error;
      debug(ctx.verbose, `Stale relay target detected (${message}); refreshing target.`);
      const refreshed = await waitForTarget(ctx, selectAlibabaTarget, 1500);
      if (!refreshed) throw error;
      currentTarget = refreshed;
      await sleep(120);
    } finally {
      client.close();
    }
  }
  throw lastError || new Error("failed to attach relay target");
}

async function navigate(client, sessionId, url) {
  await client.send("Page.navigate", { url }, { sessionId });
  await sleep(1800);
}

function classifyAlibabaHref(rawHref) {
  const href = String(rawHref || "").toLowerCase();
  if (!href) return "other";
  if (href.includes("/trade/search")) return "other";
  if (href.includes("/product-detail/") || href.includes("/product/")) return "product";
  if (
    href.includes("company_profile") ||
    href.includes("/showroom/") ||
    href.includes("/supplier/") ||
    href.includes("/store/") ||
    href.includes("supplier-profile")
  ) {
    return "supplier";
  }
  return "other";
}

function parseItemText(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] || "";
  const fullText = lines.join(" ");
  const priceMatch = fullText.match(
    /(?:US\$|\$)\s*[0-9][0-9.,]*(?:\s*-\s*(?:US\$|\$)?\s*[0-9][0-9.,]*)?/i,
  );
  const moqMatch = fullText.match(
    /(?:MOQ|Min\.?\s*Order|Minimum\s*order)\s*[:\-]?\s*([0-9][0-9,.\s]*)/i,
  );
  const supplierLine =
    lines.find((line) => /supplier|manufacturer|trading company|factory/i.test(line)) || "";
  const locationLine =
    lines.find((line) =>
      /china|guangdong|zhejiang|shandong|jiangsu|fujian|henan|anhui|hebei|hubei|hunan|shanghai|shenzhen|dongguan|ningbo|yiwu/i.test(
        line,
      ),
    ) || "";
  const ratingMatch = fullText.match(/([0-5](?:\.[0-9])?)\s*(?:\/\s*5|stars?)/i);
  return {
    title,
    price: priceMatch ? priceMatch[0] : "",
    moq: moqMatch ? moqMatch[1].trim() : "",
    supplier: supplierLine,
    location: locationLine,
    rating: ratingMatch ? ratingMatch[1] : "",
    snippet: lines.slice(0, 4).join(" | "),
  };
}

function normalizeHref(href) {
  const value = String(href || "").trim();
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function isNoiseActionTitle(title) {
  const text = String(title || "").trim().toLowerCase();
  if (!text) return true;
  return [
    "contact supplier",
    "chat now",
    "send inquiry",
    "inquire now",
    "get latest price",
    "view more",
    "learn more",
    "add to cart",
    "start order",
  ].includes(text);
}

function isNoiseActionUrl(url) {
  const text = String(url || "").trim().toLowerCase();
  if (!text) return true;
  return (
    text.includes("message.alibaba.com/msgsend/contact") ||
    text.includes("/contactinfo.html") ||
    text.includes("action=contact_action")
  );
}

function isNoiseItem(item) {
  const title = String(item?.title || "").trim();
  const url = String(item?.url || "").trim();
  if (!title || !url) return true;
  if (isNoiseActionTitle(title)) return true;
  if (isNoiseActionUrl(url)) return true;
  return false;
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
    const candidates = ["url", "target", "redirect", "redirectUrl", "to"];
    for (const key of candidates) {
      const next = parsed.searchParams.get(key);
      if (!next) continue;
      const decoded = safeDecode(next);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  } catch {}
  return value;
}

async function scrapeResults(ctx, target, args) {
  return await withTargetSession(ctx, target, async (client, sessionId) => {
    const searchUrl = buildAlibabaSearchUrl(args.keyword, args.intentType, args.site, args.page);
    await navigate(client, sessionId, searchUrl);

    const readSnapshot = async () =>
      await client.evaluate(
        `(() => {
          const href = location.href;
          const title = document.title;
          const bodyText = document.body ? document.body.innerText.slice(0, 8000) : '';
          const anchors = Array.from(document.querySelectorAll('a[href]'))
            .map((anchor) => {
              const href = anchor.href || '';
              const text =
                (anchor.getAttribute('title') || anchor.innerText || '').trim() ||
                (anchor.closest('article,li,div')?.innerText || '').trim();
              const image =
                anchor.querySelector('img')?.getAttribute('src') ||
                anchor.querySelector('img')?.getAttribute('data-src') ||
                '';
              return { href, text, image };
            })
            .filter((item) => item.href)
            .filter((item) => item.href.includes('alibaba.com'))
            .filter((item) => !item.href.includes('/trade/search'))
            .filter((item) => !item.href.includes('javascript:void'))
            .filter((item, index, arr) => arr.findIndex((x) => x.href === item.href) === index)
            .slice(0, ${Number(args.limit) * 12});
          const stats = {
            totalAnchors: document.querySelectorAll('a[href]').length,
            alibabaAnchors: anchors.length,
          };
          return { href, title, bodyText, anchors, stats };
        })()`,
        { sessionId },
      );

    const deadline = Date.now() + Math.max(3000, Number(args.timeout || 25) * 1000);
    let snapshot = await readSnapshot();
    while (Date.now() < deadline) {
      const href = String(snapshot?.href || "");
      const bodyText = String(snapshot?.bodyText || "").toLowerCase();
      const anchors = Array.isArray(snapshot?.anchors) ? snapshot.anchors : [];
      if (href.includes("/account-login") || href.includes("login.alibaba.com")) break;
      if (
        href.includes("/trade/search") &&
        (anchors.length > 0 ||
          bodyText.includes("products") ||
          bodyText.includes("suppliers") ||
          bodyText.includes("related searches"))
      ) {
        break;
      }
      await sleep(600);
      snapshot = await readSnapshot();
    }

    const href = String(snapshot?.href || "");
    const bodyText = String(snapshot?.bodyText || "");
    if (href.includes("/account-login") || href.includes("login.alibaba.com")) {
      return {
        result: createEmptyResult(args.keyword, args.intentType, args.limit, args.page),
        error:
          "NOT_LOGGED_IN: Alibaba login page detected in relay tab. Complete login in the same browser profile, then rerun search.",
      };
    }

    const lowerBody = bodyText.toLowerCase();
    const riskSignals = [
      href.toLowerCase().includes("captcha") ? "href:captcha" : "",
      lowerBody.includes("verify you are human") ? "body:verify-human" : "",
      lowerBody.includes("please slide to verify") ? "body:slide-verify" : "",
      lowerBody.includes("security check") ? "body:security-check" : "",
      lowerBody.includes("access denied") ? "body:access-denied" : "",
      lowerBody.includes("bot detection") ? "body:bot-detection" : "",
    ].filter(Boolean);
    if (riskSignals.length > 0) {
      return {
        result: createEmptyResult(args.keyword, args.intentType, args.limit, args.page),
        error: `RISK_CHALLENGE: Alibaba anti-bot or captcha page detected. Complete challenge in the same relay tab, then rerun search. href=${href || "unknown"}`,
        diagnostics: {
          risk_signals: riskSignals,
          body_preview: bodyText.slice(0, 220),
        },
      };
    }

    if (!href.includes("alibaba.com") || !href.includes("/trade/search")) {
      return {
        result: createEmptyResult(args.keyword, args.intentType, args.limit, args.page),
        error: `NO_RESULTS_PAGE: tab is not on Alibaba search results page. href=${href || "unknown"}`,
      };
    }

    const anchors = Array.isArray(snapshot?.anchors) ? snapshot.anchors : [];
    if (ctx.verbose) {
      debug(
        true,
        `Snapshot href=${href} title=${String(snapshot?.title || "")} anchors=${anchors.length} stats=${JSON.stringify(snapshot?.stats || {})}`,
      );
    }
    if (anchors.length === 0) {
      return {
        result: createEmptyResult(args.keyword, args.intentType, args.limit, args.page),
        error: `NO_ITEMS_EXTRACTED: reached Alibaba search page but extracted 0 links. href=${href}`,
      };
    }

    const normalizedItems = anchors
      .map((item) => {
        const rawUrl = normalizeHref(item.href);
        const url = normalizeHref(unwrapNestedUrl(rawUrl)) || rawUrl;
        const type = classifyAlibabaHref(url);
        const parsed = parseItemText(item.text);
        return {
          item_type: type,
          title: parsed.title || "Alibaba item",
          url,
          image_url: normalizeHref(item.image),
          price: parsed.price,
          moq: parsed.moq,
          supplier_name: parsed.supplier,
          location: parsed.location,
          rating: parsed.rating,
          snippet: parsed.snippet,
          platform: "alibaba",
        };
      })
      .filter((item) => item.url.includes("alibaba.com"))
      .filter((item) => !isNoiseItem(item))
      .filter((item) => item.item_type !== "other" || item.title.trim())
      .slice(0, Number(args.limit) * 4);

    let selected = normalizedItems;
    if (args.intentType === "product") {
      const products = normalizedItems.filter((item) => item.item_type === "product");
      selected = products.length > 0 ? products : normalizedItems;
    } else if (args.intentType === "supplier") {
      const suppliers = normalizedItems.filter((item) => item.item_type === "supplier");
      selected = suppliers.length > 0 ? suppliers : normalizedItems;
    }
    selected = selected.slice(0, Number(args.limit));

    if (selected.length === 0) {
      return {
        result: createEmptyResult(args.keyword, args.intentType, args.limit, args.page),
        error:
          `NO_ITEMS_EXTRACTED_AFTER_NORMALIZE: extracted ${anchors.length} raw links but 0 normalized items. href=${href}`,
      };
    }

    return {
      result: {
        success: true,
        source: "alibaba",
        request_id: `alibaba-${Date.now()}`,
        intent_type: args.intentType,
        keyword: args.keyword,
        search_url: searchUrl,
        total_count: selected.length,
        items: selected,
        page_size: Number(args.limit),
        page_index: Number(args.page),
      },
      error: null,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const emptyResult = createEmptyResult(args.keyword, args.intentType, args.limit, args.page);

  let modeCtx = null;
  let versionCtx = null;
  let ctx = null;
  try {
    modeCtx = resolveConnection(args);
    versionCtx = await getVersion(modeCtx);
    ctx = {
      ...modeCtx,
      relayPort: versionCtx.relayPort,
      baseHttpUrl: versionCtx.baseUrl,
      headers: versionCtx.headers,
      wsUrl: appendTokenToWsUrl(
        String(versionCtx.payload?.webSocketDebuggerUrl || ""),
        modeCtx.relayToken,
      ),
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

  try {
    const searchUrl = buildAlibabaSearchUrl(args.keyword, args.intentType, args.site, args.page);
    const target = await findOrCreateTarget(ctx, searchUrl);
    const payload = await scrapeResults(ctx, target, args);
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
