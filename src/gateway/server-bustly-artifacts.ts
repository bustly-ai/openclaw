import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import * as tar from "tar";
import { resolveBustlyPathAccess } from "../bustly/path-access.js";
import {
  parseBustlyArtifactTicketId,
  resolveBustlyArtifactTicket,
} from "./bustly-artifact-tickets.js";

function sanitizeDownloadName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "artifact";
  }
  return trimmed.replace(/[\\/\r\n"]/g, "_");
}

function encodeDispositionFilename(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function setDownloadDisposition(
  res: ServerResponse,
  disposition: "inline" | "attachment",
  fileName: string,
): void {
  const safeName = sanitizeDownloadName(fileName);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeDispositionFilename(safeName)}`,
  );
}

function parseSingleRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }
  const [, rawStart, rawEnd] = match;
  let start = rawStart ? Number(rawStart) : Number.NaN;
  let end = rawEnd ? Number(rawEnd) : Number.NaN;
  if (Number.isNaN(start) && Number.isNaN(end)) {
    return null;
  }
  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0 || start >= size) {
      return null;
    }
    if (Number.isNaN(end) || end >= size) {
      end = size - 1;
    }
    if (end < start) {
      return null;
    }
  }
  return { start, end };
}

async function serveFileTicket(
  req: IncomingMessage,
  res: ServerResponse,
  params: {
    realPath: string;
    fileName: string;
    mimeType: string | null | undefined;
    disposition: "inline" | "attachment";
  },
): Promise<void> {
  const stat = await fs.promises.stat(params.realPath);
  const mimeType = params.mimeType?.trim() || "application/octet-stream";
  const rangeHeader = typeof req.headers.range === "string" ? req.headers.range : "";
  const range = rangeHeader ? parseSingleRange(rangeHeader, stat.size) : null;

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Accept-Ranges", "bytes");
  setDownloadDisposition(res, params.disposition, params.fileName);

  if (rangeHeader && !range) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${stat.size}`);
    res.end();
    return;
  }

  if (range) {
    const chunkSize = range.end - range.start + 1;
    res.statusCode = 206;
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = fs.createReadStream(params.realPath, { start: range.start, end: range.end });
    stream.pipe(res);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      res.end();
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", stat.size);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(params.realPath);
  stream.pipe(res);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  });
}

async function serveDirectoryArchiveTicket(
  req: IncomingMessage,
  res: ServerResponse,
  params: {
    realPath: string;
    fileName: string;
  },
): Promise<void> {
  const archiveName = params.fileName.endsWith(".tar.gz") ? params.fileName : `${params.fileName}.tar.gz`;
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Cache-Control", "private, no-store");
  setDownloadDisposition(res, "attachment", archiveName);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const parentDir = path.dirname(params.realPath);
  const entryName = path.basename(params.realPath);
  const pack = tar.c(
    {
      cwd: parentDir,
      gzip: true,
      portable: true,
      noMtime: true,
    },
    [entryName],
  );
  pack.pipe(res);
  pack.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 500;
    }
    res.end();
  });
}

export function handleBustlyArtifactRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  const url = new URL(urlRaw, "http://localhost");
  const ticketId = parseBustlyArtifactTicketId(url.pathname);
  if (!ticketId) {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const ticket = resolveBustlyArtifactTicket(ticketId);
  if (!ticket) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  void (async () => {
    const resolved = await resolveBustlyPathAccess(ticket.path);
    if (resolved.kind === "missing") {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
    if (resolved.kind === "forbidden") {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Forbidden");
      return;
    }

    if (ticket.action === "archive") {
      if (resolved.kind !== "directory") {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Not Found");
        return;
      }
      await serveDirectoryArchiveTicket(req, res, {
        realPath: resolved.realPath,
        fileName: ticket.fileName,
      });
      return;
    }

    if (resolved.kind !== "file") {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }

    await serveFileTicket(req, res, {
      realPath: resolved.realPath,
      fileName: ticket.fileName,
      mimeType: ticket.mimeType ?? resolved.mimeType,
      disposition: ticket.action === "preview" ? "inline" : "attachment",
    });
  })().catch(() => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  });

  return true;
}
