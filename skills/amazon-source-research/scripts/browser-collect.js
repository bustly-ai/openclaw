#!/usr/bin/env node

function usage() {
  console.error(`Usage:
  node scripts/browser-collect.js --keyword "<keyword>" [options]

Options:
  --site <amazon-host>              default: www.amazon.com
  --limit <n>                       default: 20
  --timeout <seconds>               default: 25
  --relay-host <host>               default: 127.0.0.1
  --relay-port <port>
  --relay-port-candidates <csv>
  --relay-token <token>
  --verbose
`);
}

function parseArgs(argv) {
  const args = {
    keyword: "",
    site: "www.amazon.com",
    limit: 20,
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
    console.error(`[amazon-relay] ${message}`);
  }
}

function createEmptyResult(keyword, site, pageSize, searchUrl = "") {
  return {
    success: true,
    source: "amazon",
    request_id: `amazon-${Date.now()}`,
    keyword,
    site,
    search_url: searchUrl,
    total_count: 0,
    items: [],
    page_size: pageSize,
    page_index: 1,
  };
}

function buildAmazonSearchUrl(keyword, site) {
  const host = String(site || "www.amazon.com").trim() || "www.amazon.com";
  const url = new URL(`https://${host}/s`);
  url.searchParams.set("k", String(keyword || "").trim());
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

function urlContainsKeyword(url, keyword) {
  const text = decodeURIComponent(String(url || "").toLowerCase());
  const key = String(keyword || "").trim().toLowerCase();
  if (!key) return true;
  return text.includes(key);
}

function isAmazonUrl(url) {
  return String(url || "").includes("amazon.");
}

function selectAmazonTarget(targets, keyword) {
  const pages = Array.isArray(targets)
    ? targets.filter((target) => target?.type === "page" && isAmazonUrl(target?.url))
    : [];
  const scored = pages
    .map((target) => {
      const url = String(target?.url || "");
      const lower = url.toLowerCase();
      let score = 0;
      if (lower.includes("/s?")) score += 100;
      if (lower.includes("k=")) score += 100;
      if (lower.includes("/dp/")) score += 50;
      if (urlContainsKeyword(url, keyword)) score += 90;
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
    for (const params of variants) {
      try {
        const created = await client.send("Target.createTarget", params);
        const targetId = String(created?.targetId || "").trim();
        if (targetId) return targetId;
      } catch (error) {
        debug(
          ctx.verbose,
          `Target.createTarget failed with params=${JSON.stringify(params)}: ${String(
            error?.message || error,
          )}`,
        );
      }
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

async function findOrCreateTarget(ctx, searchUrl, keyword) {
  let target = selectAmazonTarget(await listTargets(ctx), keyword);
  if (target) return target;

  const createdTargetId = await createTargetViaCdp(ctx, searchUrl);
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

  target = await waitForTarget(ctx, (targets) => selectAmazonTarget(targets, keyword), 5000);
  if (target) return target;
  throw new Error("NO_AMAZON_TAB: no debuggable Amazon tab available in relay session.");
}

async function withTargetSession(ctx, target, keyword, fn) {
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
      const refreshed = await waitForTarget(
        ctx,
        (targets) => selectAmazonTarget(targets, keyword),
        1500,
      );
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
  await sleep(2200);
}

function parseReviewCount(text) {
  const value = String(text || "");
  const matched = value.match(/([0-9][0-9,]+)/);
  return matched ? matched[1].replace(/,/g, "") : "";
}

function parseRating(text) {
  const value = String(text || "");
  const matched = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  return matched ? matched[1] : "";
}

async function scrapeResults(ctx, target, args) {
  return await withTargetSession(ctx, target, args.keyword, async (client, sessionId) => {
    const searchUrl = buildAmazonSearchUrl(args.keyword, args.site);
    await navigate(client, sessionId, searchUrl);

    const readSnapshot = async () =>
      await client.evaluate(
        `(() => {
          const href = location.href;
          const title = document.title || "";
          const bodyText = document.body ? document.body.innerText.slice(0, 14000) : "";
          const cards = Array.from(
            document.querySelectorAll('[data-component-type="s-search-result"][data-asin], div.s-result-item[data-asin]')
          )
            .filter((card) => (card.getAttribute("data-asin") || "").trim())
            .slice(0, ${Number(args.limit) * 4});

          const items = cards.map((card) => {
            const asin = (card.getAttribute("data-asin") || "").trim();
            const titleNode =
              card.querySelector("h2 a span") ||
              card.querySelector("h2 span") ||
              card.querySelector("a.a-link-normal span");
            const linkNode =
              card.querySelector("h2 a.a-link-normal[href]") ||
              card.querySelector("h2 a[href]") ||
              card.querySelector("a.a-link-normal[href]");
            let url = "";
            if (linkNode) {
              url = linkNode.getAttribute("href") || linkNode.href || "";
              if (url && url.startsWith("/")) {
                url = location.origin + url;
              }
            }
            const priceNode = card.querySelector(".a-price .a-offscreen");
            const ratingNode = card.querySelector(".a-icon-alt");
            const reviewsNode =
              card.querySelector("span[aria-label$='ratings']") ||
              card.querySelector("span.a-size-base.s-underline-text") ||
              card.querySelector("a.a-link-normal span.a-size-base");
            const imageNode = card.querySelector("img.s-image");

            const rawText = (card.innerText || "").split("\\n").map((line) => line.trim()).filter(Boolean);

            return {
              asin,
              title: (titleNode?.textContent || "").trim(),
              url,
              price: (priceNode?.textContent || "").trim(),
              rating_text: (ratingNode?.textContent || "").trim(),
              reviews_text: (reviewsNode?.textContent || "").trim(),
              image_url: imageNode?.getAttribute("src") || imageNode?.getAttribute("data-src") || "",
              sponsored: /sponsored/i.test(card.innerText || ""),
              snippet: rawText.slice(0, 4).join(" | "),
            };
          });

          return {
            href,
            title,
            bodyText,
            items,
            stats: {
              result_cards: cards.length,
              anchors: document.querySelectorAll("a[href]").length,
            },
          };
        })()`,
        { sessionId },
      );

    const deadline = Date.now() + Math.max(3000, Number(args.timeout || 25) * 1000);
    let snapshot = await readSnapshot();
    while (Date.now() < deadline) {
      const href = String(snapshot?.href || "").toLowerCase();
      const bodyText = String(snapshot?.bodyText || "").toLowerCase();
      const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
      const hasSearchPage = href.includes("amazon.") && href.includes("/s?");
      if (items.length > 0 && hasSearchPage) {
        break;
      }
      if (href.includes("/errors/validatecaptcha")) break;
      if (href.includes("/ap/signin")) break;
      if (bodyText.includes("type the characters you see in this image")) break;
      if (bodyText.includes("sorry, we just need to make sure you're not a robot")) break;
      await sleep(700);
      snapshot = await readSnapshot();
    }

    const href = String(snapshot?.href || "");
    const bodyText = String(snapshot?.bodyText || "");
    const lowerBody = bodyText.toLowerCase();

    if (href.toLowerCase().includes("/ap/signin")) {
      return {
        result: createEmptyResult(args.keyword, args.site, args.limit, searchUrl),
        error:
          "NOT_LOGGED_IN: Amazon signin page detected in relay tab. Complete signin in the same browser profile, then rerun collect.",
      };
    }

    const riskSignals = [
      href.toLowerCase().includes("/errors/validatecaptcha") ? "href:validate-captcha" : "",
      lowerBody.includes("type the characters you see in this image") ? "body:captcha" : "",
      lowerBody.includes("sorry, we just need to make sure you're not a robot")
        ? "body:not-a-robot"
        : "",
      lowerBody.includes("to discuss automated access to amazon data")
        ? "body:automated-access-detected"
        : "",
    ].filter(Boolean);

    if (riskSignals.length > 0) {
      return {
        result: createEmptyResult(args.keyword, args.site, args.limit, searchUrl),
        error: `RISK_CHALLENGE: Amazon captcha/challenge detected. Complete challenge in the same relay tab, then rerun collect. href=${href || "unknown"}`,
        diagnostics: {
          risk_signals: riskSignals,
          body_preview: bodyText.slice(0, 220),
        },
      };
    }

    if (!href.includes("amazon.") || !href.includes("/s?")) {
      return {
        result: createEmptyResult(args.keyword, args.site, args.limit, searchUrl),
        error: `NO_RESULTS_PAGE: tab is not on Amazon search results page. href=${href || "unknown"}`,
      };
    }

    const rawItems = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const normalized = rawItems
      .map((item) => ({
        asin: String(item?.asin || "").trim(),
        title: String(item?.title || "").trim(),
        url: String(item?.url || "").trim(),
        price: String(item?.price || "").trim(),
        rating: parseRating(item?.rating_text),
        reviews: parseReviewCount(item?.reviews_text),
        image_url: String(item?.image_url || "").trim(),
        sponsored: Boolean(item?.sponsored),
        snippet: String(item?.snippet || "").trim(),
        platform: "amazon",
      }))
      .filter((item) => item.asin && item.url && item.title)
      .slice(0, Number(args.limit));

    if (!normalized.length) {
      return {
        result: createEmptyResult(args.keyword, args.site, args.limit, searchUrl),
        error: `NO_ITEMS_EXTRACTED: reached Amazon search page but extracted 0 normalized items. href=${href}`,
        diagnostics: {
          stats: snapshot?.stats || {},
        },
      };
    }

    return {
      result: {
        success: true,
        source: "amazon",
        request_id: `amazon-${Date.now()}`,
        keyword: args.keyword,
        site: args.site,
        search_url: searchUrl,
        total_count: normalized.length,
        items: normalized,
        page_size: Number(args.limit),
        page_index: 1,
      },
      error: null,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const emptyResult = createEmptyResult(args.keyword, args.site, args.limit);

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
    const searchUrl = buildAmazonSearchUrl(args.keyword, args.site);
    const target = await findOrCreateTarget(ctx, searchUrl, args.keyword);
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
