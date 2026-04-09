#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");
const browserCollectScriptPath = path.join(__dirname, "browser-collect.js");

function usage() {
  console.error(`Usage:
  node scripts/run.js relay-check [options]
  node scripts/run.js prepare "<keyword>" [options]
  node scripts/run.js open "<keyword>" [options]
  node scripts/run.js collect "<keyword>" [options]

Options:
  --site <amazon-host>   default: www.amazon.com
  --limit <n>            default: 20
  --timeout <seconds>    default: 25
  --output <path>        output dir or file prefix
  --relay-host <host>    default: 127.0.0.1
  --relay-port <port>    from ~/.bustly/openclaw.json when omitted
  --relay-token <token>  from ~/.bustly/openclaw.json when omitted
  --verbose
`);
}

function logDebug(enabled, message) {
  if (enabled) {
    console.error(`[cross-border-selection] ${message}`);
  }
}

function parseArgs(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }
  const command = argv[0];
  if (!["relay-check", "prepare", "open", "collect"].includes(command)) {
    usage();
    throw new Error(`Unsupported command: ${command}`);
  }

  const args = {
    command,
    keyword: "",
    site: "www.amazon.com",
    limit: "20",
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
    if (!arg.startsWith("--") && !args.keyword) {
      args.keyword = String(arg || "").trim();
      continue;
    }
    if (arg === "--site") {
      args.site = String(next || "").trim() || args.site;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = String(next || "").trim() || args.limit;
      index += 1;
      continue;
    }
    if (arg === "--timeout") {
      args.timeout = String(next || "").trim() || args.timeout;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-host") {
      args.relayHost = String(next || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--relay-port") {
      args.relayPort = String(next || "").trim();
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if ((command === "prepare" || command === "open" || command === "collect") && !args.keyword) {
    throw new Error("Missing keyword argument.");
  }

  return args;
}

function pickString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
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

function buildAmazonSearchUrl(keyword, site) {
  const host = String(site || "www.amazon.com").trim() || "www.amazon.com";
  const url = new URL(`https://${host}/s`);
  url.searchParams.set("k", String(keyword || "").trim());
  return url.toString();
}

function normalizeTarget(target) {
  return {
    id: String(target?.id || target?.targetId || ""),
    title: String(target?.title || ""),
    url: String(target?.url || ""),
    type: String(target?.type || ""),
  };
}

function appendTokenToWsUrl(wsUrl, token) {
  const value = String(wsUrl || "").trim();
  const normalizedToken = String(token || "").trim();
  if (!value || !normalizedToken) return value;
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}token=${encodeURIComponent(normalizedToken)}`;
}

function sanitizeKeyword(input) {
  return String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "amazon-search";
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

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function resolveOutputPaths(keyword, explicitOutput = "") {
  const explicit = String(explicitOutput || "").trim();
  if (!explicit) {
    const outputDir = path.resolve(
      process.cwd(),
      "data",
      "amazon",
      `${sanitizeKeyword(keyword)}_${timestampLabel()}`,
    );
    return {
      outputDir,
      jsonPath: path.join(outputDir, "products.json"),
      csvPath: path.join(outputDir, "products.csv"),
    };
  }

  const resolved = path.resolve(process.cwd(), explicit);
  if (resolved.endsWith(".json")) {
    return {
      outputDir: path.dirname(resolved),
      jsonPath: resolved,
      csvPath: resolved.replace(/\.json$/i, ".csv"),
    };
  }
  if (resolved.endsWith(".csv")) {
    return {
      outputDir: path.dirname(resolved),
      jsonPath: resolved.replace(/\.csv$/i, ".json"),
      csvPath: resolved,
    };
  }
  return {
    outputDir: resolved,
    jsonPath: path.join(resolved, "products.json"),
    csvPath: path.join(resolved, "products.csv"),
  };
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function rowsToCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvCell(column)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","));
  return [header, ...body].join("\n");
}

function toSummaryRows(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.map((item, index) => ({
    rank: index + 1,
    asin: item?.asin || "",
    title: item?.title || "",
    price: item?.price || "",
    rating: item?.rating || "",
    reviews: item?.reviews || "",
    url: item?.url || "",
  }));
}

function shouldShowRelayGuidance(error) {
  const haystack = String(error || "").toLowerCase();
  return (
    haystack.includes("no_relay") ||
    haystack.includes("no relay") ||
    haystack.includes("no amazon tab") ||
    haystack.includes("not_logged_in") ||
    haystack.includes("risk_challenge") ||
    haystack.includes("captcha") ||
    haystack.includes("no_results_page") ||
    haystack.includes("no_items_extracted")
  );
}

function buildRelayGuidance(args) {
  const searchUrl = buildAmazonSearchUrl(args.keyword, args.site);
  return [
    "Amazon relay session is blocked or not ready.",
    `1) Run: node ${path.join(skillRoot, "scripts", "run.js")} relay-check`,
    `2) Run: node ${path.join(skillRoot, "scripts", "run.js")} open ${JSON.stringify(args.keyword)} --site ${JSON.stringify(args.site)}`,
    `3) In the same relay-connected tab, complete any Amazon login/captcha challenge and keep the tab open.`,
    `4) Retry: node ${path.join(skillRoot, "scripts", "run.js")} collect ${JSON.stringify(args.keyword)} --site ${JSON.stringify(args.site)}`,
    `Search URL: ${searchUrl}`,
  ].join("\n");
}

function collectViaRelay(args, conn) {
  const response = spawnSync(
    process.execPath,
    [
      "--experimental-websocket",
      browserCollectScriptPath,
      "--keyword",
      args.keyword,
      "--site",
      args.site,
      "--limit",
      args.limit,
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
    {
      cwd: skillRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  if (response.error) {
    throw response.error;
  }
  if (typeof response.status === "number" && response.status !== 0) {
    throw new Error(String(response.stderr || response.stdout || "amazon collect command failed").trim());
  }

  const raw = String(response.stdout || "").trim();
  if (!raw) {
    throw new Error("Amazon relay collector returned empty output.");
  }
  return JSON.parse(raw);
}

async function getRelayState(conn, verbose = false) {
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
      const amazonTabs = pages
        .filter((tab) => String(tab?.url || "").includes("amazon."))
        .map((tab) => normalizeTarget(tab));
      logDebug(verbose, `relay tabs=${pages.length}, amazon tabs=${amazonTabs.length}, port=${relayPort}`);
      return {
        relay_endpoint: relayEndpoint,
        relay_port: relayPort,
        relay_port_candidates: candidatePorts,
        relay_config_source: conn.configPath,
        websocket_url: String(version?.webSocketDebuggerUrl || ""),
        browser: String(version?.Browser || ""),
        page_tabs: pages.length,
        amazon_tabs: amazonTabs.length,
        amazon_targets: amazonTabs.slice(0, 20),
      };
    } catch (error) {
      lastError = error;
      logDebug(verbose, `relay probe failed on port ${relayPort}: ${String(error?.message || error)}`);
    }
  }

  throw lastError || new Error("NO_RELAY_SESSION: relay probe failed on all ports.");
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
  } catch (error) {
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
  if (!out) {
    throw new Error("createTarget via CDP returned empty output.");
  }
  return JSON.parse(out);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const conn = resolveRelayConnection(args);
  const relayState = await getRelayState(conn, args.verbose);
  const activeConn = {
    ...conn,
    relayEndpoint: String(relayState.relay_endpoint || conn.relayEndpoint),
    relayPort: Number(relayState.relay_port || conn.relayPort),
  };

  if (args.command === "relay-check") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "relay-only",
          ...relayState,
        },
        null,
        2,
      ),
    );
    return;
  }

  const searchUrl = buildAmazonSearchUrl(args.keyword, args.site);
  if (args.command === "prepare") {
    const payload = {
      ok: true,
      mode: "relay-only",
      keyword: args.keyword,
      site: args.site,
      amazon_search_url: searchUrl,
      ...relayState,
      instructions: [
        "Relay is the only execution path.",
        `Open or create this search page in relay-attached browser: ${searchUrl}`,
        `Next command: node ${path.join(skillRoot, "scripts", "run.js")} open ${JSON.stringify(args.keyword)} --site ${JSON.stringify(args.site)}`,
        `Then run: node ${path.join(skillRoot, "scripts", "run.js")} collect ${JSON.stringify(args.keyword)} --site ${JSON.stringify(args.site)} --limit ${args.limit}`,
      ],
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (args.command === "open") {
    let created = null;
    let openWarning = "";
    try {
      created = await createRelayTarget(activeConn, relayState, searchUrl);
    } catch (error) {
      openWarning = String(error?.message || error);
    }
    const stateAfterOpen = await getRelayState(activeConn, args.verbose);
    const fallbackTarget = Array.isArray(stateAfterOpen.amazon_targets)
      ? stateAfterOpen.amazon_targets[0] || null
      : null;
    if (!created && !fallbackTarget) {
      const details = openWarning ? `\nopen_error=${openWarning}` : "";
      throw new Error(
        `NO_AMAZON_TAB: relay reachable but no Amazon tab attachable. Open ${searchUrl} in relay-connected browser and retry.${details}`,
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
          site: args.site,
          amazon_search_url: searchUrl,
          created_target: normalizeTarget(created || fallbackTarget || {}),
          ...stateAfterOpen,
        },
        null,
        2,
      ),
    );
    return;
  }

  const payload = collectViaRelay(args, activeConn);
  if (payload?.error) {
    const diagnostics = payload?.diagnostics
      ? `\nDiagnostics: ${JSON.stringify(payload.diagnostics)}`
      : "";
    if (shouldShowRelayGuidance(payload.error)) {
      throw new Error(`${payload.error}${diagnostics}\n${buildRelayGuidance(args)}`);
    }
    throw new Error(`Amazon relay collect failed: ${payload.error}${diagnostics}`);
  }

  const result = payload?.result || {};
  const rows = toSummaryRows(result);
  if (!rows.length) {
    throw new Error(`NO_ITEMS_EXTRACTED: keyword=${args.keyword}. ${buildRelayGuidance(args)}`);
  }

  const output = resolveOutputPaths(args.keyword, args.output);
  ensureDir(output.outputDir);
  const csvColumns = ["rank", "asin", "title", "price", "rating", "reviews", "url"];
  writeFileSync(output.jsonPath, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(output.csvPath, rowsToCsv(rows, csvColumns), "utf8");

  console.table(rows.slice(0, Math.min(rows.length, 20)));
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "relay-only",
        keyword: args.keyword,
        site: args.site,
        total_items: rows.length,
        output_dir: output.outputDir,
        json_path: output.jsonPath,
        csv_path: output.csvPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "relay-only",
        error: String(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
