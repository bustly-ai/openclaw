#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, "..");
const browserSearchScriptPath = path.join(__dirname, "browser-search.js");

function usage() {
  console.error(`Usage:
  node scripts/run.js prepare-login [keyword] [options]
  node scripts/run.js launch-browser [keyword] [options]
  node scripts/run.js search "<keyword>" [options]

Options:
  --sort <sale|price_asc|price_desc>
  --limit <n>
  --page <n>
  --timeout <seconds>
  --output <path>
  --relay-host <host>    Bustly relay host (default: 127.0.0.1)
  --relay-port <port>    Bustly relay port (required if auto-detect fails)
  --relay-token <token>  Bustly gateway token (required if auto-detect fails)
  --verbose
`);
}

function logInfo(message) {
  console.error(`[1688-skill] ${message}`);
}

function logDebug(enabled, message) {
  if (enabled) {
    console.error(`[1688-skill:debug] ${message}`);
  }
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

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    usage();
    process.exit(0);
  }

  const command = argv[0];
  if (command !== "prepare-login" && command !== "launch-browser" && command !== "search") {
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
    sort: "sale",
    limit: "20",
    page: "1",
    timeout: "20",
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
    if (arg === "--sort") {
      result.sort = String(next || "").trim() || result.sort;
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

  if (command === "search" && !result.keyword) {
    usage();
    throw new Error("Missing search keyword.");
  }

  return result;
}

function buildDesktopSearchUrl(keyword, sort = "sale", options = {}) {
  const includeKeyword = options.includeKeyword !== false;
  const url = new URL("https://s.1688.com/selloffer/offer_search.htm");
  if (includeKeyword && String(keyword || "").trim()) {
    url.searchParams.set("keywords", String(keyword).trim());
  }
  if (sort === "price_asc") {
    url.searchParams.set("sortType", "price_asc");
  } else if (sort === "price_desc") {
    url.searchParams.set("sortType", "price_desc");
  } else if (sort === "sale") {
    url.searchParams.set("sortType", "sale_quantity_desc");
  }
  return url.toString();
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
  const explicitPort = pickString(
    args.relayPort,
    process.env.SKILL_1688_RELAY_PORT,
    process.env.OPENCLI_1688_RELAY_PORT,
  );
  const hasExplicitPort = Boolean(explicitPort);
  const explicitHost = pickString(
    args.relayHost,
    process.env.SKILL_1688_RELAY_HOST,
    process.env.OPENCLI_1688_RELAY_HOST,
  );
  const explicitToken = pickString(
    args.relayToken,
    process.env.SKILL_1688_RELAY_TOKEN,
    process.env.OPENCLI_1688_RELAY_TOKEN,
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
    config?.gateway?.relay?.port ??
    "";
  const configRelayPort = Number(configRelayPortRaw);
  const gatewayPort = Number(config?.gateway?.port ?? "");
  const derivedRelayPort =
    Number.isFinite(configRelayPort) && configRelayPort > 0
      ? configRelayPort
      : Number.isFinite(gatewayPort) && gatewayPort > 0
        ? gatewayPort
        : 0;

  const relayPortValue = Number(
    pickString(
      explicitPort,
      process.env.OPENCLAW_BROWSER_RELAY_PORT,
      process.env.BUSTLY_BROWSER_RELAY_PORT,
      String(derivedRelayPort || ""),
    ),
  );

  const relayHost =
    pickString(
      explicitHost,
      process.env.OPENCLAW_BROWSER_RELAY_HOST,
      process.env.BUSTLY_BROWSER_RELAY_HOST,
      config?.browser?.relay?.host,
      config?.browser?.relayHost,
      config?.browser_relay?.host,
      "127.0.0.1",
    ) || "127.0.0.1";

  const configToken = pickString(
    config?.gateway?.auth?.token,
    config?.gatewayToken,
    config?.token,
    config?.browser?.relay?.token,
    config?.browser_relay?.token,
  );

  const fallbackRelayPort =
    Number.isFinite(gatewayPort) && gatewayPort > 0 ? gatewayPort + 3 : 0;
  const relayPortCandidatesRaw = hasExplicitPort
    ? [relayPortValue]
    : [relayPortValue, fallbackRelayPort];
  const relayPortCandidates = Array.from(
    new Set(
      relayPortCandidatesRaw.filter(
        (value) => Number.isFinite(value) && Number(value) > 0,
      ),
    ),
  ).map((value) => Number(value));

  return {
    relayPort: relayPortCandidates[0] || 0,
    relayPortCandidates,
    relayHost,
    relayToken: pickString(explicitToken, configToken),
    configPath: configPath || null,
  };
}

function getLoginTargets(args = {}) {
  const keyword = String(args.keyword || "").trim();
  const sort = String(args.sort || "sale").trim() || "sale";
  const desktopHomeUrl =
    process.env.SKILL_1688_DESKTOP_LOGIN_URL ||
    process.env.OPENCLI_1688_DESKTOP_LOGIN_URL ||
    "https://www.1688.com/";
  const preferredLoginUrl =
    process.env.SKILL_1688_LOGIN_URL ||
    process.env.OPENCLI_1688_LOGIN_URL ||
    desktopHomeUrl;
  const desktopSearchUrl = buildDesktopSearchUrl("", sort, { includeKeyword: false });
  return {
    login_url: preferredLoginUrl,
    desktop_search_url: desktopSearchUrl,
    desktop_home_url: desktopHomeUrl,
    keyword,
    sort,
  };
}

function getPrepareLoginPayload(args = {}) {
  const targets = getLoginTargets(args);
  const demoKeyword = targets.keyword || "手机壳";
  const relay = resolveRelayConnection(args);
  const searchCommand = `node ${path.join(skillRoot, "scripts", "run.js")} search ${JSON.stringify(demoKeyword)}`;
  const launchCommand = `node ${path.join(skillRoot, "scripts", "run.js")} launch-browser${targets.keyword ? ` ${JSON.stringify(targets.keyword)}` : ""}`;
  return {
    mode: "relay-only",
    login_url: targets.login_url,
    desktop_search_url: targets.desktop_search_url,
    desktop_home_url: targets.desktop_home_url,
    search_url_example: buildDesktopSearchUrl("", targets.sort, { includeKeyword: false }),
    relay_http_url: null,
    relay_port_candidates: relay.relayPortCandidates || [],
    relay_config_source: relay.configPath,
    instructions: [
      "Use your normal browser profile with Bustly Browser Relay connected.",
      `Open ${targets.login_url} (desktop preferred) and complete login / slider manually in the same browser profile.`,
      "Keep at least one logged-in 1688 tab open before running search.",
      Array.isArray(relay.relayPortCandidates) && relay.relayPortCandidates.length > 0
        ? `Relay endpoint will auto-probe candidate ports: ${relay.relayPortCandidates.join(", ")}`
        : "Relay endpoint was not auto-detected; pass --relay-port/--relay-token explicitly.",
      Array.isArray(relay.relayPortCandidates) && relay.relayPortCandidates.length > 1
        ? `Auto-probe fallback ports: ${relay.relayPortCandidates.join(", ")}`
        : "",
      `After user confirmation run: ${searchCommand}`,
    ].filter(Boolean),
    launch_browser_command: launchCommand,
    next_command_after_user_confirmation: searchCommand,
  };
}

function sanitizeKeyword(input) {
  return String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "1688-search";
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
    "1688",
    `${sanitizeKeyword(keyword)}_${timestampLabel()}.json`,
  );
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function buildLoginRequiredMessage(args) {
  const payload = getPrepareLoginPayload(args);
  const relay = resolveRelayConnection(args);
  return [
    "1688 relay browser session is missing or not logged in.",
    `Run 'node ${path.join(skillRoot, "scripts", "run.js")} prepare-login${args.keyword ? ` ${JSON.stringify(args.keyword)}` : ""}' and show the user this login page:`,
    payload.login_url,
    "Have the user finish login in their normal browser profile (with Bustly Browser Relay enabled) and keep the 1688 desktop tab open.",
    "If 1688 shows a risk/challenge page (x5secdata / punish), the user must complete that verification in the same tab before rerunning search.",
    Array.isArray(relay.relayPortCandidates) && relay.relayPortCandidates.length > 0
      ? `Relay auto-probe ports: ${relay.relayPortCandidates.join(", ")}`
      : "Relay endpoint was not auto-detected. Pass --relay-port/--relay-token explicitly.",
    `Then run '${payload.next_command_after_user_confirmation}'.`,
  ].join("\n");
}

function shouldShowLoginGuidance(error) {
  const haystack = String(error || "").toLowerCase();
  return (
    haystack.includes("no cdp") ||
    haystack.includes("no relay") ||
    haystack.includes("no 1688 tab") ||
    haystack.includes("no_1688_tab") ||
    haystack.includes("no_relay_token") ||
    haystack.includes("no_relay_session") ||
    haystack.includes("not logged in") ||
    haystack.includes("not_logged_in") ||
    haystack.includes("no_results_page") ||
    haystack.includes("risk_challenge") ||
    haystack.includes("x5secdata") ||
    haystack.includes("/punish?") ||
    haystack.includes("login.taobao.com")
  );
}

function toOutputRows(result) {
  const products = Array.isArray(result?.products) ? result.products : [];
  return products.map((product, index) => ({
    rank: index + 1,
    title: product?.title || "",
    price: product?.price?.current || "",
    currency: product?.price?.currency || "CNY",
    sales: product?.sales_volume || "",
    location: product?.shipping?.from_country || "",
    rating: product?.rating || "",
    product_id: product?.product_id || "",
    url: product?.url || "",
  }));
}

function searchViaRelay(args, verbose) {
  const relay = resolveRelayConnection(args);
  if (!relay.relayPort || relay.relayPortCandidates.length === 0) {
    throw new Error("NO_RELAY_CONFIG: relay port is missing.");
  }
  if (!relay.relayToken) {
    throw new Error("NO_RELAY_TOKEN: gateway token is missing.");
  }

  const response = run(
    process.execPath,
    [
      "--experimental-websocket",
      browserSearchScriptPath,
      "--keyword",
      args.keyword,
      "--sort",
      args.sort,
      "--limit",
      args.limit,
      "--page",
      args.page,
      "--timeout",
      args.timeout,
      "--relay-host",
      String(relay.relayHost),
      "--relay-port",
      String(relay.relayPort),
      "--relay-port-candidates",
      relay.relayPortCandidates.join(","),
      "--relay-token",
      String(relay.relayToken),
      ...(verbose ? ["--verbose"] : []),
    ],
    { cwd: skillRoot },
  );

  const raw = String(response.stdout || "").trim();
  if (!raw) {
    throw new Error("1688 relay runtime returned empty output");
  }
  return JSON.parse(raw);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const verbose = Boolean(args.verbose);
  const outputPath = args.command === "search" ? resolveOutputPath(args.keyword, args.output) : "";

  if (args.command === "prepare-login") {
    console.log(JSON.stringify(getPrepareLoginPayload(args), null, 2));
    return;
  }

  if (args.command === "launch-browser") {
    const relay = resolveRelayConnection(args);
    const targets = getLoginTargets(args);
    const payload = {
      mode: "relay-only",
      login_url: targets.login_url,
      desktop_search_url: targets.desktop_search_url,
      relay_http_url: null,
      relay_port_candidates: relay.relayPortCandidates || [],
      relay_config_source: relay.configPath,
      note: "Relay-only mode does not launch dedicated browser sessions. Use your normal browser profile with Bustly Browser Relay.",
      next_command_after_user_confirmation:
        getPrepareLoginPayload(args).next_command_after_user_confirmation,
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  ensureDir(path.dirname(outputPath));
  let payload;
  try {
    payload = searchViaRelay(args, verbose);
  } catch (error) {
    if (shouldShowLoginGuidance(error)) {
      throw new Error(`${String(error)}\n${buildLoginRequiredMessage(args)}`);
    }
    throw error;
  }

  if (payload?.error) {
    const diagnostics = payload?.diagnostics
      ? `\nDiagnostics: ${JSON.stringify(payload.diagnostics)}`
      : "";
    if (shouldShowLoginGuidance(payload.error)) {
      throw new Error(`${payload.error}${diagnostics}\n${buildLoginRequiredMessage(args)}`);
    }
    throw new Error(`1688 relay search failed: ${payload.error}${diagnostics}`);
  }

  const products = Array.isArray(payload?.result?.products) ? payload.result.products : [];
  if (products.length === 0) {
    const keyword = String(args.keyword || "").trim();
    throw new Error(
      `NO_PRODUCTS_RETURNED: relay search finished with 0 normalized products for keyword=${keyword || "unknown"}. Reopen desktop search page in relay tab and rerun.`,
    );
  }

  writeFileSync(outputPath, JSON.stringify(payload.result || {}, null, 2), "utf8");
  const rows = toOutputRows(payload.result || {});
  if (rows.length > 0) {
    console.table(rows);
  } else {
    logInfo("Search succeeded but returned no products");
  }
  logDebug(verbose, `Relay result payload keys: ${Object.keys(payload.result || {}).join(",")}`);
  logInfo(`Saved raw JSON to ${outputPath}`);
}

main();
