import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const opsCommandMock = vi.fn();

vi.mock("../commands/ops.js", () => ({
  opsCommand: (...args: unknown[]) => opsCommandMock(...args),
}));

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../runtime.js", () => ({
  defaultRuntime: runtime,
}));

let registerOpsCli: typeof import("./ops-cli.js").registerOpsCli;

beforeAll(async () => {
  ({ registerOpsCli } = await import("./ops-cli.js"));
});

describe("registerOpsCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards skill and trailing args to opsCommand", async () => {
    const program = new Command();
    registerOpsCli(program);

    await program.parseAsync(["ops", "ads", "platforms", "--json"], { from: "user" });

    expect(opsCommandMock).toHaveBeenCalledWith(
      { skill: "ads", args: ["platforms", "--json"] },
      runtime,
    );
  });

  it("supports legacy top-level alias commands", async () => {
    const program = new Command();
    registerOpsCli(program);

    await program.parseAsync(["commerce", "providers", "--json"], { from: "user" });

    expect(opsCommandMock).toHaveBeenCalledWith(
      { skill: "commerce", args: ["providers", "--json"] },
      runtime,
    );
  });
});
