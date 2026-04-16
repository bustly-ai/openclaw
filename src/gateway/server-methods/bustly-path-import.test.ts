import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";

const mocks = vi.hoisted(() => ({
  importBustlyPathFile: vi.fn(),
}));

vi.mock("../../bustly/path-import.js", () => ({
  importBustlyPathFile: (...args: unknown[]) => mocks.importBustlyPathFile(...args),
}));

import { bustlyPathImportHandlers } from "./bustly-path-import.js";

async function invokeImport(params: Record<string, unknown>) {
  const respond = vi.fn();
  await bustlyPathImportHandlers["bustly.path.import"]({
    req: {} as never,
    params: params as never,
    respond: respond as never,
    context: {} as never,
    client: null,
    isWebchatConnect: () => false,
  });
  return respond;
}

describe("gateway bustly.path.import", () => {
  beforeEach(() => {
    mocks.importBustlyPathFile.mockReset();
  });

  it("rejects empty content", async () => {
    const respond = await invokeImport({});
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: "contentBase64 is required",
      }),
    );
  });

  it("imports file content and returns runtime path", async () => {
    mocks.importBustlyPathFile.mockResolvedValue({
      path: "/tmp/ws/.uploads/test-image.png",
      name: "test-image.png",
      kind: "file",
    });
    const respond = await invokeImport({
      name: "test-image.png",
      relativePath: "drop/test-image.png",
      contentBase64: "aGVsbG8=",
    });
    expect(mocks.importBustlyPathFile).toHaveBeenCalledWith({
      name: "test-image.png",
      relativePath: "drop/test-image.png",
      contentBase64: "aGVsbG8=",
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      {
        path: "/tmp/ws/.uploads/test-image.png",
        name: "test-image.png",
        kind: "file",
      },
    );
  });
});
