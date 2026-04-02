import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractArchive } from "../infra/archive.js";
import { movePathToTrash } from "../browser/trash.js";
import {
  DEFAULT_RELAY_EXTENSION_DOWNLOAD_URL,
  resolveRelayExtensionDownloadUrl,
} from "../browser/relay-guidance.js";
import { resolveStateDir } from "../config/paths.js";
import { danger, info } from "../globals.js";
import { copyToClipboard } from "../infra/clipboard.js";
import { withTempDir } from "../infra/install-source-utils.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { shortenHomePath } from "../utils.js";
import { formatCliCommand } from "./command-format.js";

export function resolveBundledExtensionRootDir(
  here = path.dirname(fileURLToPath(import.meta.url)),
) {
  let current = here;
  while (true) {
    const candidate = path.join(current, "assets", "chrome-extension");
    if (hasManifest(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(here, "../../assets/chrome-extension");
}

function installedExtensionRootDir() {
  return path.join(resolveStateDir(), "browser", "chrome-extension");
}

function hasManifest(dir: string) {
  return fs.existsSync(path.join(dir, "manifest.json"));
}

export async function installChromeExtension(opts?: {
  stateDir?: string;
  sourceDir?: string;
  downloadUrl?: string;
  disableRemoteDownload?: boolean;
}): Promise<{ path: string }> {
  const sourceDir = opts?.sourceDir;
  const remoteUrl = opts?.downloadUrl?.trim() || resolveRelayExtensionDownloadUrl();
  const remoteEnabled = !opts?.disableRemoteDownload;

  const stateDir = opts?.stateDir ?? resolveStateDir();
  const dest = path.join(stateDir, "browser", "chrome-extension");
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest)) {
    await movePathToTrash(dest).catch(() => {
      const backup = `${dest}.old-${Date.now()}`;
      fs.renameSync(dest, backup);
    });
  }

  if (sourceDir) {
    if (!hasManifest(sourceDir)) {
      throw new Error("Bundled Chrome extension is missing. Reinstall OpenClaw and try again.");
    }
    await fs.promises.cp(sourceDir, dest, { recursive: true });
  } else if (remoteEnabled && remoteUrl) {
    const parsed = (() => {
      try {
        return new URL(remoteUrl);
      } catch {
        return null;
      }
    })();
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      throw new Error(`Invalid Bustly Browser Relay URL: ${remoteUrl}`);
    }

    await withTempDir("openclaw-relay-ext-", async (tmpDir) => {
      const archivePath = path.join(tmpDir, "relay-extension.zip");
      const extractDir = path.join(tmpDir, "extract");
      await fs.promises.mkdir(extractDir, { recursive: true });

      const res = await fetch(parsed.toString(), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        throw new Error(
          `Failed to download Bustly Browser Relay package (${res.status} ${res.statusText}) from ${parsed.toString()}`,
        );
      }
      const body = await res.arrayBuffer();
      if (body.byteLength === 0) {
        throw new Error(`Downloaded Bustly Browser Relay package is empty: ${parsed.toString()}`);
      }
      await fs.promises.writeFile(archivePath, Buffer.from(body));

      await extractArchive({
        archivePath,
        destDir: extractDir,
        kind: "zip",
        stripComponents: 1,
        timeoutMs: 60_000,
      });

      if (!hasManifest(extractDir)) {
        throw new Error(
          `Downloaded Bustly Browser Relay package does not contain manifest.json at root: ${parsed.toString()}`,
        );
      }
      await fs.promises.cp(extractDir, dest, { recursive: true });
    });
  } else {
    const bundled = resolveBundledExtensionRootDir();
    if (!hasManifest(bundled)) {
      throw new Error("Bundled Chrome extension is missing. Reinstall OpenClaw and try again.");
    }
    await fs.promises.cp(bundled, dest, { recursive: true });
  }

  if (!hasManifest(dest)) {
    throw new Error("Chrome extension install failed (manifest.json missing). Try again.");
  }

  return { path: dest };
}

export function registerBrowserExtensionCommands(
  browser: Command,
  parentOpts: (cmd: Command) => { json?: boolean },
) {
  const ext = browser.command("extension").description("Chrome extension helpers");

  ext
    .command("install")
    .description("Install the Chrome extension to a stable local path")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      let installed: { path: string };
      try {
        installed = await installChromeExtension();
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
        return;
      }

      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ ok: true, path: installed.path }, null, 2));
        return;
      }
      const displayPath = shortenHomePath(installed.path);
      const downloadUrl = resolveRelayExtensionDownloadUrl() ?? DEFAULT_RELAY_EXTENSION_DOWNLOAD_URL;
      defaultRuntime.log(displayPath);
      const copied = await copyToClipboard(installed.path).catch(() => false);
      defaultRuntime.error(
        info(
          [
            copied ? "Copied to clipboard." : "Copy to clipboard unavailable.",
            "Next:",
            `- Download Bustly Browser Relay package: ${downloadUrl}`,
            `- Chrome → chrome://extensions → enable “Developer mode”`,
            `- “Load unpacked” → select: ${displayPath}`,
            `- Pin “Bustly Browser Relay”, then click it on the tab (badge shows ON)`,
            "",
            `${theme.muted("Docs:")} ${formatDocsLink("/tools/chrome-extension", "docs.openclaw.ai/tools/chrome-extension")}`,
          ].join("\n"),
        ),
      );
    });

  ext
    .command("path")
    .description("Print the path to the installed Chrome extension (load unpacked)")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const dir = installedExtensionRootDir();
      if (!hasManifest(dir)) {
        const downloadUrl = resolveRelayExtensionDownloadUrl() ?? DEFAULT_RELAY_EXTENSION_DOWNLOAD_URL;
        defaultRuntime.error(
          danger(
            [
              `Bustly Browser Relay is not installed. Run: "${formatCliCommand("openclaw browser extension install")}"`,
              `Download: ${downloadUrl}`,
              `Docs: ${formatDocsLink("/tools/chrome-extension", "docs.openclaw.ai/tools/chrome-extension")}`,
            ].join("\n"),
          ),
        );
        defaultRuntime.exit(1);
      }
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ path: dir }, null, 2));
        return;
      }
      const displayPath = shortenHomePath(dir);
      defaultRuntime.log(displayPath);
      const copied = await copyToClipboard(dir).catch(() => false);
      if (copied) {
        defaultRuntime.error(info("Copied to clipboard."));
      }
    });
}
