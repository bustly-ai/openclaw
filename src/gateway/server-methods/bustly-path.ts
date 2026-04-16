import { resolveBustlyPathAccess } from "../../bustly/path-access.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { issueBustlyArtifactTicket } from "../bustly-artifact-tickets.js";
import type { GatewayRequestHandlers } from "./types.js";

export const bustlyPathHandlers: GatewayRequestHandlers = {
  "bustly.path.resolve": async ({ params, respond }) => {
    const targetPath = typeof params.path === "string" ? params.path.trim() : "";
    if (!targetPath) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "path is required"));
      return;
    }

    const resolved = await resolveBustlyPathAccess(targetPath);
    if (resolved.kind === "missing" || resolved.kind === "forbidden") {
      respond(true, {
        kind: resolved.kind,
        name: resolved.name,
        mimeType: null,
        mediaKind: null,
        previewPath: null,
        downloadPath: null,
        openPath: null,
        archivePath: null,
      });
      return;
    }

    if (resolved.kind === "directory") {
      const archivePath = issueBustlyArtifactTicket({
        action: "archive",
        path: resolved.path,
        fileName: resolved.name,
      });
      respond(true, {
        kind: "directory",
        name: resolved.name,
        mimeType: null,
        mediaKind: null,
        previewPath: null,
        downloadPath: null,
        openPath: archivePath,
        archivePath,
      });
      return;
    }

    const previewable =
      resolved.mediaKind === "image"
      || resolved.mediaKind === "video"
      || resolved.mediaKind === "audio"
      || resolved.mediaKind === "document";
    const previewPath = previewable
      ? issueBustlyArtifactTicket({
          action: "preview",
          path: resolved.path,
          fileName: resolved.name,
          mimeType: resolved.mimeType,
        })
      : null;
    const downloadPath = issueBustlyArtifactTicket({
      action: "download",
      path: resolved.path,
      fileName: resolved.name,
      mimeType: resolved.mimeType,
    });
    respond(true, {
      kind: "file",
      name: resolved.name,
      mimeType: resolved.mimeType,
      mediaKind: resolved.mediaKind,
      previewPath,
      downloadPath,
      openPath: previewPath ?? downloadPath,
      archivePath: null,
    });
  },
};
