import { rmSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { stateDir, addBreadcrumb, captureException, captureMessage, withScope, setLevel, setTag, setExtra } =
  vi.hoisted(() => {
    const scope = {
      setLevel: vi.fn(),
      setTag: vi.fn(),
      setExtra: vi.fn(),
    };

    return {
      stateDir: `${process.env.TMPDIR || "/tmp"}/bustly-main-logger-test-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      addBreadcrumb: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      withScope: vi.fn((callback: (scope: typeof scope) => void) => callback(scope)),
      setLevel: scope.setLevel,
      setTag: scope.setTag,
      setExtra: scope.setExtra,
    };
  });

vi.mock("@sentry/electron/main", () => ({
  addBreadcrumb,
  captureException,
  captureMessage,
  withScope,
}));

vi.mock("./defaults.js", () => ({
  resolveElectronIsolatedStateDir: () => stateDir,
}));

import { writeMainError, writeMainInfo, writeMainWarn } from "./logger.js";

describe("main logger sentry reporting", () => {
  beforeEach(() => {
    addBreadcrumb.mockReset();
    captureException.mockReset();
    captureMessage.mockReset();
    withScope.mockClear();
    setLevel.mockReset();
    setTag.mockReset();
    setExtra.mockReset();
  });

  afterAll(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("sends info logs to breadcrumb and sentry message", () => {
    writeMainInfo("main info log");

    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "writeMainLog",
        level: "info",
        message: "main info log",
      }),
    );
    expect(captureMessage).toHaveBeenCalledWith("main info log");
    expect(setLevel).toHaveBeenCalledWith("info");
    expect(setTag).toHaveBeenCalledWith("logger", "writeMainLog");
    expect(setExtra).toHaveBeenCalledWith("log_message", "main info log");
  });

  it("sends warning logs to breadcrumb and sentry message", () => {
    writeMainWarn("main warning log");

    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "writeMainLog",
        level: "warning",
        message: "main warning log",
      }),
    );
    expect(captureMessage).toHaveBeenCalledWith("main warning log");
    expect(setLevel).toHaveBeenCalledWith("warning");
    expect(setTag).toHaveBeenCalledWith("logger", "writeMainLog");
    expect(setExtra).toHaveBeenCalledWith("log_message", "main warning log");
  });

  it("keeps error logs on captureException path", () => {
    const error = new Error("boom");
    writeMainError("main error log", error);

    expect(captureException).toHaveBeenCalledWith(error);
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
