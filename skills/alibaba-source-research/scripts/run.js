#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");
const browserSearchScriptPath = path.join(__dirname, "browser-search.js");

function usage() {
  console.error(`Usage:
  node scripts/run.js relay-check [options]
  node scripts/run.js prepare-login [keyword] [options]
  node scripts/run.js open "<keyword>" [options]
  node scripts/run.js search "<keyword>" [options]

Options:
  --intent-type <product|supplier|both>
  --site <host>            default: www.alibaba.com
  --limit <n>
  --page <n>
  --timeout <seconds>
  --output <path>
  --relay-host <host>
  --relay-port <port>
  --relay-token <token>
  --verbose
`);
}

function logInfo(message) {
  console.error(`[product-supplier-sourcing] ${message}`);
}

function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });

  if (child.error) {
    throw child.error;
  }

  if (typeof child.status === "number" && child.status !== 0) {
    throw new Error(
      String(child.stderr || child.stdout || `${command} exited with code ${child.status}`).trim(),
    );
  }

  return {
    stdout: String(child.stdout || ""),
    stderr: String(child.stderr || ""),
  };
}

function pickString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    usage();
    process.exit(0);
  }

  const command = argv[0];
  if (!["relay-check", "prepare-login", "open", "search"].includes(command)) {
    usage();
    throw new Error(`Unsupported command: ${command}`);
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  const result = {
    command,
    keyword: "",
    intentType: "product",
    site: "www.alibaba.com",
    limit: "20",
    page: "1",
    timeout: "25",
    output: "",
    relayHost: "",
    relayPort: "",
    relayToken: "",
    verbose: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (!arg.startsWith("--") && !result.keyword) {
      result.keyword = arg;
      continue;
    }
    if (arg === "--intent-type") {
      const value = String(next || "").trim().toLowerCase();
      if (value === "product" || value === "supplier" || value === "both") {
        result.intentType = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--site") {
      result.site = String(next || "").trim() || result.site;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      result.limit = String(next || "").trim() || result.limit;
      index += 1;
      continue;
    }
    if (arg === "--page") {
      result.page = String(next || "").trim() || result.page;
      index += 1;
      continue;
    }
    if (arg === "--timeout") {
      result.timeout = String(next || "").trim() || result.timeout;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      result.output = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-host") {
      result.relayHost = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-port") {
      result.relayPort = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-token") {
      result.relayToken = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--verbose") {
      result.verbose = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if ((command === "open" || command === "search") && !result.keyword) {
    usage();
    throw new Error("Missing keyword argument.");
  }

  return result;
}

function readJsonIfExists(filePath) {
  if (!filePath) return null;
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveRelayConnection(args = {}) {
  const explicitPort = pickString(args.relayPort, process.env.BUSTLY_BROWSER_RELAY_PORT);
  const hasExplicitPort = Boolean(explicitPort);
  const explicitHost = pickString(args.relayHost, process.env.BUSTLY_BROWSER_RELAY_HOST);
  const explicitToken = pickString(
    args.relayToken,
    process.env.BUSTLY_BROWSER_RELAY_TOKEN,
    process.env.OPENCLAW_GATEWAY_TOKEN,
  );

  const configCandidates = [
    process.env.OPENCLAW_CONFIG_PATH,
    path.join(homedir(), ".bustly", "openclaw.json"),
    path.join(homedir(), ".moltbot", "openclaw.json"),
  ].filter(Boolean);

  let configPath = "";
  let config = null;
  for (const candidate of configCandidates) {
    const parsed = readJsonIfExists(candidate);
    if (parsed) {
      configPath = candidate;
      config = parsed;
      break;
    }
  }

  const configRelayPortRaw =
    config?.browser?.relay?.port ??
    config?.browser?.relayPort ??
    config?.browser_relay?.port ??
    config?.browser_relay?.relayPort ??
    config?.gateway?.port ??
    "";
  const relayPort = Number(
    pickString(explicitPort, process.env.OPENCLAW_BROWSER_RELAY_PORT, String(configRelayPortRaw || "")),
  );

  const relayHost =
    pickString(
      explicitHost,
      config?.browser?.relay?.host,
      config?.browser?.relayHost,
      config?.browser_relay?.host,
      "127.0.0.1",
    ) || "127.0.0.1";

  const relayToken = pickString(
    explicitToken,
    config?.gateway?.auth?.token,
    config?.gatewayToken,
    config?.token,
    config?.browser?.relay?.token,
    config?.browser_relay?.token,
  );

  if (!Number.isFinite(relayPort) || relayPort <= 0) {
    throw new Error("NO_RELAY_CONFIG: relay port missing.");
  }
  if (!relayToken) {
    throw new Error("NO_RELAY_TOKEN: relay token missing.");
  }

  const gatewayPort = Number(config?.gateway?.port ?? "");
  const fallbackRelayPort =
    Number.isFinite(gatewayPort) && gatewayPort > 0 ? gatewayPort + 3 : 0;
  const relayPortCandidatesRaw = hasExplicitPort ? [relayPort] : [relayPort, fallbackRelayPort];
  const relayPortCandidates = Array.from(
    new Set(
      relayPortCandidatesRaw.filter(
        (value) => Number.isFinite(value) && Number(value) > 0,
      ),
    ),
  ).map((value) => Number(value));

  return {
    relayHost,
    relayPort,
    relayPortCandidates,
    relayToken,
    relayEndpoint: `http://${relayHost}:${relayPort}`,
    configPath: configPath || null,
  };
}

function relayHeaders(token) {
  return { "x-openclaw-relay-token": String(token || "").trim() };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
  }
  return response.json();
}

function appendTokenToWsUrl(wsUrl, token) {
  const value = String(wsUrl || "").trim();
  const normalizedToken = String(token || "").trim();
  if (!value || !normalizedToken) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}token=${encodeURIComponent(normalizedToken)}`;
}

async function getRelayState(conn) {
  const headers = relayHeaders(conn.relayToken);
  const candidatePorts = Array.isArray(conn.relayPortCandidates) && conn.relayPortCandidates.length
    ? conn.relayPortCandidates
    : [conn.relayPort];
  let lastError = null;

  for (const relayPort of candidatePorts) {
    const relayEndpoint = `http://${conn.relayHost}:${relayPort}`;
    try {
      const version = await fetchJson(`${relayEndpoint}/json/version`, { headers });
      const targets = await fetchJson(`${relayEndpoint}/json/list`, { headers });
      const pages = Array.isArray(targets) ? targets.filter((item) => item?.type === "page") : [];
      const alibabaTabs = pages
        .filter((tab) => String(tab?.url || "").includes("alibaba.com"))
        .map((tab) => ({
          id: String(tab?.id || tab?.targetId || ""),
          title: String(tab?.title || ""),
          url: String(tab?.url || ""),
          type: String(tab?.type || ""),
        }));
      return {
        relay_endpoint: relayEndpoint,
        relay_port: relayPort,
        relay_port_candidates: candidatePorts,
        relay_config_source: conn.configPath,
        websocket_url: String(version?.webSocketDebuggerUrl || ""),
        browser: String(version?.Browser || ""),
        page_tabs: pages.length,
        alibaba_tabs: alibabaTabs.length,
        alibaba_targets: alibabaTabs.slice(0, 20),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("NO_RELAY_SESSION: relay probe failed on all ports.");
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

function getPrepareLoginPayload(args = {}, relayState = null) {
  const conn = resolveRelayConnection(args);
  const keyword = String(args.keyword || "").trim() || "wireless earbuds";
  const searchUrl = buildAlibabaSearchUrl(keyword, args.intentType, args.site, args.page);
  const activeRelayPort = Number(relayState?.relay_port || 0);
  const activeRelayEndpoint =
    String(relayState?.relay_endpoint || "").trim() ||
    (activeRelayPort > 0 ? `http://${conn.relayHost}:${activeRelayPort}` : conn.relayEndpoint);

  return {
    mode: "relay-only",
    login_url: "https://www.alibaba.com/",
    search_url: searchUrl,
    intent_type: args.intentType,
    relay_http_url: activeRelayEndpoint,
    relay_port_candidates: conn.relayPortCandidates,
    relay_config_source: conn.configPath,
    relay_probe_port: activeRelayPort || null,
    instructions: [
      "Use your normal browser profile with Bustly Browser Relay connected.",
      "Open https://www.alibaba.com/ and complete login/challenge if prompted.",
      "Then run open command to create dedicated relay tab before search.",
      `Next: node ${path.join(skillRoot, "scripts", "run.js")} open ${JSON.stringify(keyword)} --intent-type ${args.intentType}`,
    ],
  };
}

function sanitizeKeyword(input) {
  return String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "alibaba-search";
}

function timestampLabel() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function resolveOutputPath(keyword, explicitOutput) {
  if (explicitOutput) {
    return path.resolve(process.cwd(), explicitOutput);
  }
  return path.resolve(
    process.cwd(),
    "data",
    "alibaba",
    `${sanitizeKeyword(keyword)}_${timestampLabel()}.json`,
  );
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function buildLoginRequiredMessage(args) {
  const payload = getPrepareLoginPayload(args);
  return [
    "Alibaba relay browser session is missing or blocked.",
    `Run 'node ${path.join(skillRoot, "scripts", "run.js")} prepare-login${args.keyword ? ` ${JSON.stringify(args.keyword)}` : ""}' and show the user this page:`,
    payload.login_url,
    "Have the user complete login/captcha in the same relay-connected browser profile and keep Alibaba tab open.",
    `Then run 'node ${path.join(skillRoot, "scripts", "run.js")} open ${JSON.stringify(
      args.keyword || "wireless earbuds",
    )} --intent-type ${args.intentType}' and retry search.`,
  ].join("\n");
}

function shouldShowLoginGuidance(error) {
  const haystack = String(error || "").toLowerCase();
  return (
    haystack.includes("no relay") ||
    haystack.includes("no_relay") ||
    haystack.includes("no alibaba tab") ||
    haystack.includes("not_logged_in") ||
    haystack.includes("not logged in") ||
    haystack.includes("risk_challenge") ||
    haystack.includes("captcha") ||
    haystack.includes("no_results_page")
  );
}

function isRetryableExtractionError(error) {
  const haystack = String(error || "").toLowerCase();
  return (
    haystack.includes("no_items_extracted") ||
    haystack.includes("no_items_returned") ||
    haystack.includes("no_items_extracted_after_normalize")
  );
}

function searchViaRelay(args) {
  const conn = resolveRelayConnection(args);
  const response = run(
    process.execPath,
    [
      "--experimental-websocket",
      browserSearchScriptPath,
      "--keyword",
      args.keyword,
      "--intent-type",
      args.intentType,
      "--site",
      args.site,
      "--limit",
      args.limit,
      "--page",
      args.page,
      "--timeout",
      args.timeout,
      "--relay-host",
      String(conn.relayHost),
      "--relay-port",
      String(conn.relayPort),
      "--relay-port-candidates",
      conn.relayPortCandidates.join(","),
      "--relay-token",
      String(conn.relayToken),
      ...(args.verbose ? ["--verbose"] : []),
    ],
    { cwd: skillRoot },
  );

  const raw = String(response.stdout || "").trim();
  if (!raw) {
    throw new Error("Alibaba relay runtime returned empty output");
  }
  return JSON.parse(raw);
}

function toOutputRows(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map((item, index) => ({
    rank: index + 1,
    type: item?.item_type || "",
    title: item?.title || "",
    price: item?.price || "",
    moq: item?.moq || "",
    supplier: item?.supplier_name || "",
    location: item?.location || "",
    rating: item?.rating || "",
    url: item?.url || "",
  }));
}

async function createRelayTarget(conn, relayState, url) {
  const headers = relayHeaders(conn.relayToken);
  const endpoint = `${conn.relayEndpoint}/json/new?${encodeURIComponent(url)}`;
  const methods = ["PUT", "GET"];
  let lastError = null;
  for (const method of methods) {
    try {
      const response = await fetch(endpoint, { method, headers });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = new Error(
          `${method} ${endpoint} failed with ${response.status}${body ? `: ${body}` : ""}`,
        );
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  const wsBaseUrl = String(relayState?.websocket_url || "").trim();
  if (!wsBaseUrl) {
    throw lastError || new Error("Failed to create relay tab target.");
  }
  const wsUrl = appendTokenToWsUrl(wsBaseUrl, conn.relayToken);

  const inlineScript = `
const wsUrl = process.argv[1];
const targetUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
const requestId = 1;
const timeout = setTimeout(() => {
  console.error("CDP createTarget timeout");
  process.exit(1);
}, 12000);
ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    id: requestId,
    method: "Target.createTarget",
    params: { url: targetUrl, asAgent: true, retain: false }
  }));
});
ws.addEventListener("message", (event) => {
  let payload = {};
  try {
    payload = JSON.parse(String(event.data || "{}"));
  } catch {
    return;
  }
  if (payload.id !== requestId) return;
  clearTimeout(timeout);
  if (payload.error) {
    console.error(payload.error.message || JSON.stringify(payload.error));
    process.exit(1);
  }
  console.log(JSON.stringify(payload.result || {}));
  ws.close();
});
ws.addEventListener("error", (event) => {
  clearTimeout(timeout);
  console.error(event?.message || event?.error?.message || "websocket error");
  process.exit(1);
});
`;

  const child = spawnSync(
    process.execPath,
    ["--experimental-websocket", "-e", inlineScript, wsUrl, url],
    {
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  if (child.error) {
    throw child.error;
  }
  if (typeof child.status === "number" && child.status !== 0) {
    const stderr = String(child.stderr || "").trim();
    const baseError = lastError ? String(lastError.message || lastError) : "";
    throw new Error(
      `createTarget via relay failed. ${baseError}${stderr ? ` cdp=${stderr}` : ""}`.trim(),
    );
  }
  const out = String(child.stdout || "").trim();
  if (!out) throw new Error("createTarget via CDP returned empty output.");
  return JSON.parse(out);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "prepare-login") {
    let relayState = null;
    try {
      relayState = await getRelayState(resolveRelayConnection(args));
    } catch {
      relayState = null;
    }
    console.log(JSON.stringify(getPrepareLoginPayload(args, relayState), null, 2));
    return;
  }

  const conn = resolveRelayConnection(args);
  const relayState = await getRelayState(conn);
  const activeConn = {
    ...conn,
    relayEndpoint: String(relayState.relay_endpoint || conn.relayEndpoint),
    relayPort: Number(relayState.relay_port || conn.relayPort),
  };

  if (args.command === "relay-check") {
    console.log(JSON.stringify({ ok: true, mode: "relay-only", ...relayState }, null, 2));
    return;
  }

  if (args.command === "open") {
    const searchUrl = buildAlibabaSearchUrl(args.keyword, args.intentType, args.site, args.page);
    let created = null;
    let openWarning = "";
    try {
      created = await createRelayTarget(activeConn, relayState, searchUrl);
    } catch (error) {
      openWarning = String(error?.message || error);
    }
    const stateAfterOpen = await getRelayState(activeConn);
    const fallbackTarget = Array.isArray(stateAfterOpen?.alibaba_targets)
      ? stateAfterOpen.alibaba_targets[0] || null
      : null;
    if (!created && !fallbackTarget) {
      const details = openWarning ? `\nopen_error=${openWarning}` : "";
      throw new Error(
        `NO_ALIBABA_TAB: relay is reachable but no Alibaba tab is attachable. Open https://www.alibaba.com/ in relay-connected browser, finish login/challenge, then retry.${details}`,
      );
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "relay-only",
          open_strategy: created ? "created-target" : "reuse-existing-target",
          open_warning: openWarning || null,
          keyword: args.keyword,
          intent_type: args.intentType,
          search_url: searchUrl,
          created_target: {
            id: String(created?.targetId || created?.id || fallbackTarget?.id || ""),
            title: String(created?.title || fallbackTarget?.title || ""),
            url: String(created?.url || fallbackTarget?.url || ""),
            type: String(created?.type || fallbackTarget?.type || "page"),
          },
          ...stateAfterOpen,
        },
        null,
        2,
      ),
    );
    return;
  }

  const outputPath = resolveOutputPath(args.keyword, args.output);
  ensureDir(path.dirname(outputPath));

  let payload;
  try {
    payload = searchViaRelay(args);
  } catch (error) {
    if (shouldShowLoginGuidance(error)) {
      throw new Error(`${String(error)}\n${buildLoginRequiredMessage(args)}`);
    }
    throw error;
  }

  if (payload?.error && isRetryableExtractionError(payload.error)) {
    const retryUrl = buildAlibabaSearchUrl(args.keyword, args.intentType, args.site, args.page);
    if (args.verbose) {
      logInfo(
        `Received retryable extraction error (${payload.error}). Creating a fresh relay tab and retrying once.`,
      );
    }
    try {
      await createRelayTarget(activeConn, relayState, retryUrl);
    } catch (openError) {
      if (args.verbose) {
        logInfo(`Retry open step failed: ${String(openError?.message || openError)}`);
      }
    }
    payload = searchViaRelay(args);
  }

  if (payload?.error) {
    const diagnostics = payload?.diagnostics
      ? `\nDiagnostics: ${JSON.stringify(payload.diagnostics)}`
      : "";
    if (shouldShowLoginGuidance(payload.error)) {
      throw new Error(`${payload.error}${diagnostics}\n${buildLoginRequiredMessage(args)}`);
    }
    throw new Error(`Alibaba relay search failed: ${payload.error}${diagnostics}`);
  }

  const items = Array.isArray(payload?.result?.items) ? payload.result.items : [];
  if (items.length === 0) {
    throw new Error(
      `NO_ITEMS_RETURNED: relay search finished with 0 normalized items for keyword=${String(
        args.keyword || "",
      )}`,
    );
  }

  writeFileSync(outputPath, JSON.stringify(payload.result || {}, null, 2), "utf8");
  const rows = toOutputRows(payload.result || {});
  console.table(rows);
  logInfo(`Saved raw JSON to ${outputPath}`);
}

main();
