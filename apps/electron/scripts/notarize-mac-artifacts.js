#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dirArgIndex = args.indexOf("--dir");
const dirArg = dirArgIndex === -1 ? null : args[dirArgIndex + 1];
const artifactDir = resolve(dirArg || process.env.ARTIFACT_DIR || "dist/electron");
const keychainProfile = process.env.NOTARYTOOL_PROFILE?.trim() || "openclaw-notary";
const apiKeyPath = process.env.NOTARYTOOL_KEY?.trim() || "";
const apiKeyId = process.env.NOTARYTOOL_KEY_ID?.trim() || "";
const apiIssuer = process.env.NOTARYTOOL_ISSUER?.trim() || "";

const artifacts = [];
for (const entry of readdirSync(artifactDir)) {
  const fullPath = join(artifactDir, entry);
  let stat;
  try {
    stat = statSync(fullPath);
  } catch {
    continue;
  }
  if (!stat.isFile()) {
    continue;
  }
  if (entry.endsWith(".dmg") || entry.endsWith(".zip")) {
    artifacts.push(fullPath);
  }
}

if (artifacts.length === 0) {
  console.error(`[notarize-mac] No .dmg/.zip artifacts found in ${artifactDir}`);
  process.exit(1);
}

console.log("[notarize-mac] Artifacts:");
for (const artifact of artifacts) {
  console.log(`  ${artifact}`);
}

const authArgs = (() => {
  if (process.env.NOTARYTOOL_PROFILE?.trim()) {
    console.log(`[notarize-mac] Using keychain profile: ${keychainProfile}`);
    return ["--keychain-profile", keychainProfile];
  }
  if (apiKeyPath && apiKeyId && apiIssuer) {
    console.log(`[notarize-mac] Using App Store Connect API key: ${apiKeyId}`);
    return ["--key", apiKeyPath, "--key-id", apiKeyId, "--issuer", apiIssuer];
  }
  console.log(`[notarize-mac] Using default keychain profile: ${keychainProfile}`);
  console.log(
    "[notarize-mac] Override with NOTARYTOOL_PROFILE or NOTARYTOOL_KEY/NOTARYTOOL_KEY_ID/NOTARYTOOL_ISSUER if needed.",
  );
  return ["--keychain-profile", keychainProfile];
})();

const run = (cmd, cmdArgs) => {
  const result = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[notarize-mac] Command failed: ${cmd} ${cmdArgs.join(" ")}`);
    if (result.error) {
      console.error(`[notarize-mac] Spawn error: ${result.error.message}`);
    }
    if (result.signal) {
      console.error(`[notarize-mac] Terminated by signal: ${result.signal}`);
    }
    process.exit(result.status ?? 1);
  }
};

for (const artifact of artifacts) {
  run("/usr/bin/xcrun", [
    "notarytool",
    "submit",
    artifact,
    ...authArgs,
    "--wait",
  ]);

  if (artifact.endsWith(".dmg")) {
    run("/usr/bin/xcrun", ["stapler", "staple", artifact]);
    run("/usr/bin/xcrun", ["stapler", "validate", artifact]);
  } else {
    console.log(`[notarize-mac] Skipping stapler for ${artifact}`);
  }
}
