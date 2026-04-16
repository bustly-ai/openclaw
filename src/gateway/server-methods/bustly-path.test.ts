import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  resolveBustlyPathAccess: vi.fn(),
  issueBustlyArtifactTicket: vi.fn(),
}));

vi.mock("../../bustly/path-access.js", () => ({
  resolveBustlyPathAccess: (...args: unknown[]) => mocks.resolveBustlyPathAccess(...args),
}));

vi.mock("../bustly-artifact-tickets.js", () => ({
  issueBustlyArtifactTicket: (...args: unknown[]) => mocks.issueBustlyArtifactTicket(...args),
}));

import { bustlyPathHandlers } from "./bustly-path.js";

async function invokeResolve(params: Record<string, unknown>) {
  const respond = vi.fn();
  await bustlyPathHandlers["bustly.path.resolve"]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway bustly.path.resolve", () => {
  beforeEach(() => {
    mocks.resolveBustlyPathAccess.mockReset();
    mocks.issueBustlyArtifactTicket.mockReset();
  });

  it("rejects empty paths", async () => {
    const respond = await invokeResolve({});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "path is required",
      }),
    );
  });

  it("returns missing descriptor without issuing tickets", async () => {
    mocks.resolveBustlyPathAccess.mockResolvedValue({
      kind: "missing",
      path: "/tmp/missing.png",
      name: "missing.png",
    });
    const respond = await invokeResolve({ path: "/tmp/missing.png" });
    expect(mocks.issueBustlyArtifactTicket).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "missing",
        name: "missing.png",
        mimeType: null,
        mediaKind: null,
        previewPath: null,
        downloadPath: null,
        openPath: null,
        archivePath: null,
      },
    );
  });

  it("returns preview and download routes for previewable files", async () => {
    mocks.resolveBustlyPathAccess.mockResolvedValue({
      kind: "file",
      path: "/tmp/output.png",
      realPath: "/tmp/output.png",
      name: "output.png",
      mimeType: "image/png",
      mediaKind: "image",
    });
    mocks.issueBustlyArtifactTicket
      .mockReturnValueOnce("/api/bustly-artifacts/preview")
      .mockReturnValueOnce("/api/bustly-artifacts/download");

    const respond = await invokeResolve({ path: "/tmp/output.png" });

    expect(mocks.issueBustlyArtifactTicket).toHaveBeenNthCalledWith(1, {
      action: "preview",
      path: "/tmp/output.png",
      fileName: "output.png",
      mimeType: "image/png",
    });
    expect(mocks.issueBustlyArtifactTicket).toHaveBeenNthCalledWith(2, {
      action: "download",
      path: "/tmp/output.png",
      fileName: "output.png",
      mimeType: "image/png",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "file",
        name: "output.png",
        mimeType: "image/png",
        mediaKind: "image",
        previewPath: "/api/bustly-artifacts/preview",
        downloadPath: "/api/bustly-artifacts/download",
        openPath: "/api/bustly-artifacts/preview",
        archivePath: null,
      },
    );
  });

  it("returns archive route for directories", async () => {
    mocks.resolveBustlyPathAccess.mockResolvedValue({
      kind: "directory",
      path: "/tmp/output-dir",
      realPath: "/tmp/output-dir",
      name: "output-dir",
    });
    mocks.issueBustlyArtifactTicket.mockReturnValue("/api/bustly-artifacts/archive");

    const respond = await invokeResolve({ path: "/tmp/output-dir" });

    expect(mocks.issueBustlyArtifactTicket).toHaveBeenCalledWith({
      action: "archive",
      path: "/tmp/output-dir",
      fileName: "output-dir",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        kind: "directory",
        name: "output-dir",
        mimeType: null,
        mediaKind: null,
        previewPath: null,
        downloadPath: null,
        openPath: "/api/bustly-artifacts/archive",
        archivePath: "/api/bustly-artifacts/archive",
      },
    );
  });
});
