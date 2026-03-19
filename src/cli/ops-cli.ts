import type { Command } from "commander";
import { opsCommand } from "../commands/ops.js";
import { defaultRuntime } from "../runtime.js";

export function registerOpsCli(program: Command) {
  program
    .command("ops")
    .description("Run Bustly ops skills with lazy runtime installation")
    .argument("<skill>", "Ops skill alias, for example ads or commerce")
    .argument("[args...]", "Command and arguments forwarded to the installed skill runtime")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (skill: string, args: string[] = []) => {
      await opsCommand({ skill, args }, defaultRuntime);
    });
}
