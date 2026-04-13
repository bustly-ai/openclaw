import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";

export type BustlyIssueReportArchiveResult = {
  archivePath: string;
  stateDir: string;
  outputDir: string;
};

function formatIssueReportTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function addDirectoryToZip(params: {
  zip: JSZip;
  baseDir: string;
  currentDir: string;
  pathPrefix: string;
}): void {
  const entries = readdirSync(params.currentDir, { withFileTypes: true })
    .toSorted((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = join(params.currentDir, entry.name);
    const relativePath = entryPath.slice(params.baseDir.length + 1).replace(/\\/g, "/");
    const zipPath = `${params.pathPrefix}/${relativePath}`;

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      params.zip.folder(zipPath);
      addDirectoryToZip({
        zip: params.zip,
        baseDir: params.baseDir,
        currentDir: entryPath,
        pathPrefix: params.pathPrefix,
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stat = lstatSync(entryPath);
    params.zip.file(zipPath, readFileSync(entryPath), {
      unixPermissions: stat.mode,
      date: stat.mtime,
    });
  }
}

export async function createBustlyIssueReportArchive(params?: {
  stateDir?: string;
  outputDir?: string;
  now?: Date;
}): Promise<BustlyIssueReportArchiveResult> {
  const resolvedStateDir = resolve(params?.stateDir?.trim() || join(homedir(), ".bustly"));
  if (!existsSync(resolvedStateDir) || !lstatSync(resolvedStateDir).isDirectory()) {
    throw new Error(`Bustly state directory not found: ${resolvedStateDir}`);
  }

  const resolvedOutputDir = resolve(params?.outputDir?.trim() || join(resolvedStateDir, "reports"));
  mkdirSync(resolvedOutputDir, { recursive: true, mode: 0o700 });

  const zip = new JSZip();
  zip.folder(".bustly");
  addDirectoryToZip({
    zip,
    baseDir: resolvedStateDir,
    currentDir: resolvedStateDir,
    pathPrefix: ".bustly",
  });

  const archivePath = join(
    resolvedOutputDir,
    `bustly-issue-report-${formatIssueReportTimestamp(params?.now ?? new Date())}.zip`,
  );
  const archiveBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  writeFileSync(archivePath, archiveBuffer);

  return {
    archivePath,
    stateDir: resolvedStateDir,
    outputDir: resolvedOutputDir,
  };
}
