import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

export type {
  SkillInfoOptions,
  SkillsCheckOptions,
  SkillsListOptions,
} from "./skills-cli.format.js";
export { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

type SkillStatusReport = Awaited<
  ReturnType<(typeof import("../agents/skills-status.js"))["buildWorkspaceSkillStatus"]>
>;

async function loadSkillsStatusReport(): Promise<SkillStatusReport> {
  const config = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
  return buildWorkspaceSkillStatus(workspaceDir, { config });
}

async function runSkillsAction(render: (report: SkillStatusReport) => string): Promise<void> {
  try {
    const report = await loadSkillsStatusReport();
    defaultRuntime.log(render(report));
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

async function runSkillsInstall(params: { skillName: string; installId: string }): Promise<void> {
  try {
    const config = loadConfig();
    const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
    const { installSkill } = await import("../agents/skills-install.js");
    const result = await installSkill({
      workspaceDir,
      skillName: params.skillName,
      installId: params.installId,
      config,
    });

    const lines: string[] = [];
    lines.push(
      result.ok
        ? `${theme.success("✓")} Installed ${theme.command(params.skillName)} (${params.installId})`
        : `${theme.error("✗")} Failed to install ${theme.command(params.skillName)} (${params.installId})`,
    );
    if (result.message) {
      lines.push(result.message);
    }
    if (result.stdout) {
      lines.push("");
      lines.push(result.stdout);
    }
    if (result.stderr) {
      lines.push("");
      lines.push(result.stderr);
    }
    if (result.warnings && result.warnings.length > 0) {
      lines.push("");
      lines.push(theme.heading("Warnings:"));
      for (const warning of result.warnings) {
        lines.push(`  ${theme.warn("→")} ${warning}`);
      }
    }
    if (!result.ok) {
      lines.push("");
      lines.push(
        `${theme.muted("Tip:")} inspect ${formatCliCommand(`openclaw skills info ${params.skillName}`)} for runtime/install details.`,
      );
    }
    defaultRuntime.log(lines.join("\n"));
    if (!result.ok) {
      defaultRuntime.exit(1);
    }
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

/**
 * Register the skills CLI commands
 */
export function registerSkillsCli(program: Command) {
  const skills = program
    .command("skills")
    .description("List and inspect available skills")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/skills", "docs.openclaw.ai/cli/skills")}\n`,
    );

  skills
    .command("list")
    .description("List all available skills")
    .option("--json", "Output as JSON", false)
    .option("--eligible", "Show only eligible (ready to use) skills", false)
    .option("-v, --verbose", "Show more details including missing requirements", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsList(report, opts));
    });

  skills
    .command("info")
    .description("Show detailed information about a skill")
    .argument("<name>", "Skill name")
    .option("--json", "Output as JSON", false)
    .action(async (name, opts) => {
      await runSkillsAction((report) => formatSkillInfo(report, name, opts));
    });

  skills
    .command("check")
    .description("Check which skills are ready vs missing requirements")
    .option("--json", "Output as JSON", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsCheck(report, opts));
    });

  skills
    .command("install")
    .description("Install a skill runtime/dependency using the skill's declared install option")
    .argument("<name>", "Skill name")
    .argument("<install-id>", "Installer id (for example: runtime-node)")
    .action(async (name, installId) => {
      await runSkillsInstall({ skillName: name, installId });
    });

  // Default action (no subcommand) - show list
  skills.action(async () => {
    await runSkillsAction((report) => formatSkillsList(report, {}));
  });
}
