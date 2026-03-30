import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function resolveConfigPath() {
  const configured = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (configured) {
    return configured;
  }
  return path.join(os.homedir(), ".bustly", "openclaw.json");
}

export function loadConfig() {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export async function writeConfigFile(cfg, options = {}) {
  const expectedPath = typeof options.expectedConfigPath === "string"
    ? options.expectedConfigPath
    : undefined;
  const configPath = expectedPath || resolveConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}
