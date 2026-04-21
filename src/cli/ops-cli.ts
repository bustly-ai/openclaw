import type { Command } from "commander";
import { opsCommand } from "../commands/ops.js";
import { defaultRuntime } from "../runtime.js";

const LEGACY_OPS_ALIASES = ["commerce", "ads"] as const;

function registerLegacyOpsAlias(program: Command, alias: string): void {
  program
    .command(alias)
    .description(`Legacy alias for "openclaw ops ${alias}"`)
    .argument("[args...]", "Command and arguments forwarded to the installed skill runtime")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(async (args: string[] = []) => {
      await opsCommand({ skill: alias, args }, defaultRuntime);
    });
}

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

  for (const alias of LEGACY_OPS_ALIASES) {
    registerLegacyOpsAlias(program, alias);
  }
}
