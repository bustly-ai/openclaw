#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

function extractArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[body] = true;
      continue;
    }

    flags[body] = next;
    i += 1;
  }

  return { flags, positional };
}

function toInteger(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function nowIso() {
  return new Date().toISOString();
}

function slugTimestamp() {
  return nowIso().replace(/[:.]/g, "-");
}

function compilePattern(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(String(pattern), "i");
  } catch (error) {
    throw new Error(
      `Invalid regex pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function loadBenchmark(filePath) {
  if (!filePath) return {};
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    throw new Error(`Benchmark file not found: ${abs}`);
  }
  const parsed = JSON.parse(readFileSync(abs, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Benchmark file must be a JSON object");
  }
  return parsed;
}

function scanFilesRecursively(rootDir) {
  const result = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      result.push(fullPath);
    }
  }

  return result;
}

function runSecurityScan(skillDir) {
  const findings = [];
  const files = scanFilesRecursively(skillDir);

  const codeLike = files.filter((file) =>
    [".js", ".ts", ".mjs", ".cjs", ".sh", ".py"].some((ext) => file.endsWith(ext)),
  );

  const rules = [
    { severity: "high", code: "dangerous_eval", regex: /\beval\s*\(/i, detail: "uses eval()" },
    {
      severity: "high",
      code: "dangerous_exec",
      regex: /child_process\.(exec|execSync|spawn)\s*\(/i,
      detail: "uses child_process execution APIs",
    },
    { severity: "high", code: "sudo", regex: /\bsudo\b/i, detail: "contains sudo command" },
    {
      severity: "high",
      code: "sensitive_files",
      regex: /(~\/\.ssh|~\/\.aws|MEMORY\.md|USER\.md|SOUL\.md|IDENTITY\.md)/i,
      detail: "references sensitive files",
    },
    {
      severity: "medium",
      code: "network_fetch",
      regex: /\b(curl|wget)\b/i,
      detail: "contains network download command",
    },
    {
      severity: "medium",
      code: "base64_decode",
      regex: /base64\s+-d|atob\s*\(/i,
      detail: "contains base64 decode path",
    },
  ];

  for (const file of codeLike) {
    const raw = readFileSync(file, "utf-8");
    for (const rule of rules) {
      if (rule.regex.test(raw)) {
        findings.push({
          severity: rule.severity,
          code: rule.code,
          detail: rule.detail,
          file,
        });
      }
    }
  }

  const hasHigh = findings.some((item) => item.severity === "high");
  return {
    passed: !hasHigh,
    findings,
    scanned_files: codeLike.length,
  };
}

function runCommand(command, cwd, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const started = Date.now();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 3000);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const ended = Date.now();
      resolvePromise({
        stdout,
        stderr,
        code: code ?? -1,
        signal: signal ?? "",
        timedOut,
        durationMs: ended - started,
      });
    });
  });
}

function printHelp() {
  console.log(`Usage:
  node skills/skill_eval_ops/scripts/run.js <command> [flags]

Commands:
  evaluate    Run a full skill evaluation in OpenClaw context
  rubric      Print evaluation dimensions

Evaluate Flags:
  --user-case "<text>"           Required. User case to evaluate (plain language)
  --openclaw-root <path>         Required. OpenClaw project root
  --skill-path <path>            Required. Skill path (absolute or relative to openclaw root)
  --command "<cmd>"              Required. Command to execute
  --max-ms <number>              Optional. Runtime budget (default 30000)
  --run-timeout-ms <number>      Optional. Hard timeout for command process (default 180000)
  --expect-skill-pattern <regex> Optional. Regex expected in stdout/stderr for skill invocation correctness
  --success-pattern <regex>      Optional. Extra success signal in stdout/stderr
  --delivery-pattern <regex>     Optional. Expected delivery signal (result-focused)
  --process-pattern <regex>      Optional. Expected process signal (step/progress-focused)
  --required-log-keywords <a,b>  Optional. Comma-separated required keywords for benchmark/log checks
  --benchmark-file <path>        Optional. JSON benchmark config file
  --report-dir <path>            Optional. Output directory
  --min-output-lines <number>    Optional. Minimum non-empty output lines for process clarity (default 3)
`);
}

function printRubric() {
  const rubric = {
    dimensions: [
      "result_success",
      "skill_called_correctly",
      "process_clarity",
      "execution_time_acceptable",
      "has_execution_logs",
      "benchmark_and_security_passed",
    ],
  };
  console.log(JSON.stringify(rubric, null, 2));
}

function scoreTime(durationMs, thresholdMs) {
  if (durationMs <= thresholdMs) return 100;
  if (thresholdMs <= 0) return 0;
  const overRatio = (durationMs - thresholdMs) / thresholdMs;
  return clamp(Math.round(100 - overRatio * 100), 0, 99);
}

function scoreProcessClarity(outputLines, minOutputLines, processMatched) {
  if (outputLines <= 0) return 0;
  let score = 40;
  if (outputLines >= minOutputLines) score += 30;
  else score += Math.round((outputLines / minOutputLines) * 30);
  if (processMatched) score += 30;
  return clamp(score, 0, 100);
}

function buildJudgeNotes(report) {
  const notes = [];
  if (!report.checks.result_success.pass)
    notes.push("执行结果未成功，优先查看 execution.log 的 stderr 和退出码。");
  if (!report.checks.skill_called_correctly.pass)
    notes.push("未检测到预期 skill 调用信号，可能命令路径或路由不正确。");
  if (!report.checks.process_clarity.pass)
    notes.push("过程信号不足，建议增加更清晰的过程输出或步骤日志。");
  if (!report.checks.execution_time_acceptable.pass)
    notes.push("执行耗时超出预算，建议优化请求数量或降级查询范围。");
  if (!report.checks.benchmark_and_security_passed.pass)
    notes.push("benchmark 或安全基线未达标，需要先清理风险项。");
  if (notes.length === 0) notes.push("本次 user case 执行质量达标，可作为回归基线。");
  return notes;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Skill Evaluation Report");
  lines.push("");
  lines.push(`- User Case: ${report.metadata.user_case}`);
  lines.push(`- Timestamp: ${report.metadata.timestamp}`);
  lines.push(`- OpenClaw Root: ${report.metadata.openclaw_root}`);
  lines.push(`- Skill Path: ${report.metadata.skill_path}`);
  lines.push(`- Command: \`${report.metadata.command}\``);
  lines.push(`- Duration (ms): ${report.metadata.duration_ms}`);
  lines.push(`- Exit Code: ${report.metadata.exit_code}`);
  lines.push(`- Timed Out: ${report.metadata.timed_out}`);
  lines.push("");
  lines.push("## Dimension Results");
  lines.push("");
  lines.push(`- Result Success: ${report.checks.result_success.pass ? "PASS" : "FAIL"}`);
  lines.push(`  - Score: ${report.checks.result_success.score}`);
  lines.push(
    `- Skill Called Correctly: ${report.checks.skill_called_correctly.pass ? "PASS" : "FAIL"}`,
  );
  lines.push(`  - Score: ${report.checks.skill_called_correctly.score}`);
  lines.push(`- Process Clarity: ${report.checks.process_clarity.pass ? "PASS" : "FAIL"}`);
  lines.push(`  - Score: ${report.checks.process_clarity.score}`);
  lines.push(
    `- Execution Time Acceptable: ${report.checks.execution_time_acceptable.pass ? "PASS" : "FAIL"}`,
  );
  lines.push(`  - Score: ${report.checks.execution_time_acceptable.score}`);
  lines.push(
    `- Execution Logs Present: ${report.checks.has_execution_logs.pass ? "PASS" : "FAIL"}`,
  );
  lines.push(`  - Score: ${report.checks.has_execution_logs.score}`);
  lines.push(`- Benchmark Pass: ${report.checks.benchmark.pass ? "PASS" : "FAIL"}`);
  lines.push(`  - Score: ${report.checks.benchmark.score}`);
  lines.push(`- Security Pass: ${report.checks.security.pass ? "PASS" : "FAIL"}`);
  lines.push(`  - Score: ${report.checks.security.score}`);
  lines.push("");
  lines.push(
    `## Overall Verdict: ${report.overall_pass ? "PASS" : "FAIL"} (${report.overall_score}/100)`,
  );
  lines.push("");
  lines.push("## Judge Notes");
  lines.push("");
  for (const note of report.judge_notes) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  if (report.checks.security.findings.length > 0) {
    lines.push("## Security Findings");
    lines.push("");
    for (const finding of report.checks.security.findings) {
      lines.push(`- [${finding.severity}] ${finding.code} | ${finding.file}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function handleEvaluate(flags) {
  const userCase = String(flags["user-case"] || "").trim();
  if (!userCase) throw new Error("--user-case is required");

  const openclawRoot = String(flags["openclaw-root"] || "").trim();
  if (!openclawRoot) throw new Error("--openclaw-root is required");

  const skillPathInput = String(flags["skill-path"] || "").trim();
  if (!skillPathInput) throw new Error("--skill-path is required");

  const command = String(flags.command || "").trim();
  if (!command) throw new Error("--command is required");

  const rootAbs = resolve(openclawRoot);
  const skillAbs = isAbsolute(skillPathInput)
    ? resolve(skillPathInput)
    : resolve(rootAbs, skillPathInput);
  if (!existsSync(skillAbs)) throw new Error(`Skill path not found: ${skillAbs}`);

  const skillName = basename(skillAbs);
  const maxMs = Math.max(1, toInteger(flags["max-ms"], 30000));
  const runTimeoutMs = Math.max(maxMs, toInteger(flags["run-timeout-ms"], 180000));
  const minOutputLines = Math.max(1, toInteger(flags["min-output-lines"], 3));

  const benchmark = loadBenchmark(flags["benchmark-file"]);
  const benchmarkMaxMs = Math.max(1, toInteger(benchmark.max_ms, maxMs));
  const benchmarkKeywords = [
    ...asArray(benchmark.required_log_keywords)
      .map((value) => String(value).trim())
      .filter(Boolean),
    ...String(flags["required-log-keywords"] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  const successPattern = compilePattern(flags["success-pattern"]);
  const expectSkillPattern = compilePattern(flags["expect-skill-pattern"]);
  const deliveryPattern = compilePattern(flags["delivery-pattern"]);
  const processPattern = compilePattern(flags["process-pattern"]);

  const reportRoot = flags["report-dir"]
    ? resolve(String(flags["report-dir"]))
    : resolve(rootAbs, ".skill-evals", skillName, slugTimestamp());
  ensureDir(reportRoot);

  const runResult = await runCommand(command, rootAbs, runTimeoutMs);
  const combined = `${runResult.stdout}\n${runResult.stderr}`;
  const outputLines = combined
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  const resultSuccess =
    runResult.code === 0 &&
    !runResult.timedOut &&
    (successPattern ? successPattern.test(combined) : true) &&
    (deliveryPattern ? deliveryPattern.test(combined) : true);

  const skillCalledCorrectly = expectSkillPattern
    ? expectSkillPattern.test(combined)
    : command.includes(skillName) || command.includes(skillPathInput);

  const processMatched = processPattern ? processPattern.test(combined) : true;
  const processClarity = outputLines >= minOutputLines && processMatched;
  const executionTimeAcceptable = runResult.durationMs <= benchmarkMaxMs;

  const logPath = resolve(reportRoot, "execution.log");
  const executionLog = [
    `timestamp=${nowIso()}`,
    `cwd=${rootAbs}`,
    `skill_path=${skillAbs}`,
    `command=${command}`,
    `duration_ms=${runResult.durationMs}`,
    `exit_code=${runResult.code}`,
    `signal=${runResult.signal}`,
    `timed_out=${runResult.timedOut}`,
    "",
    "===== STDOUT =====",
    runResult.stdout,
    "",
    "===== STDERR =====",
    runResult.stderr,
    "",
  ].join("\n");
  writeFileSync(logPath, executionLog, "utf-8");
  const hasExecutionLogs = existsSync(logPath) && statSync(logPath).size > 0;

  const missingKeywords = benchmarkKeywords.filter((keyword) => !executionLog.includes(keyword));
  const benchmarkPass = executionTimeAcceptable && missingKeywords.length === 0;

  const security = runSecurityScan(skillAbs);
  const benchmarkAndSecurityPassed = benchmarkPass && security.passed;

  const scoreResultSuccess = resultSuccess ? 100 : 0;
  const scoreSkillCall = skillCalledCorrectly ? 100 : 0;
  const scoreProcess = scoreProcessClarity(outputLines, minOutputLines, processMatched);
  const scoreTimeValue = scoreTime(runResult.durationMs, benchmarkMaxMs);
  const scoreLogs = hasExecutionLogs ? 100 : 0;
  const scoreBenchmark = benchmarkPass ? 100 : executionTimeAcceptable ? 60 : 20;
  const scoreSecurity = security.passed
    ? 100
    : security.findings.some((item) => item.severity === "high")
      ? 0
      : 60;
  const scoreBenchmarkAndSecurity = Math.round((scoreBenchmark + scoreSecurity) / 2);
  const overallScore = Math.round(
    (scoreResultSuccess +
      scoreSkillCall +
      scoreProcess +
      scoreTimeValue +
      scoreLogs +
      scoreBenchmarkAndSecurity) /
      6,
  );

  const report = {
    metadata: {
      user_case: userCase,
      timestamp: nowIso(),
      openclaw_root: rootAbs,
      skill_path: skillAbs,
      command,
      duration_ms: runResult.durationMs,
      exit_code: runResult.code,
      timed_out: runResult.timedOut,
      report_dir: reportRoot,
      log_file: logPath,
    },
    checks: {
      result_success: {
        pass: resultSuccess,
        score: scoreResultSuccess,
        reason: resultSuccess
          ? "command exited successfully"
          : "exit code/pattern/timed out check failed",
      },
      skill_called_correctly: {
        pass: skillCalledCorrectly,
        score: scoreSkillCall,
        reason: skillCalledCorrectly
          ? "skill invocation signal matched"
          : "skill invocation signal missing",
      },
      process_clarity: {
        pass: processClarity,
        score: scoreProcess,
        reason: processClarity
          ? `output lines >= ${minOutputLines}`
          : `output lines < ${minOutputLines}`,
        output_lines: outputLines,
      },
      execution_time_acceptable: {
        pass: executionTimeAcceptable,
        score: scoreTimeValue,
        reason: executionTimeAcceptable
          ? "within max runtime budget"
          : "exceeded max runtime budget",
        threshold_ms: benchmarkMaxMs,
      },
      has_execution_logs: {
        pass: hasExecutionLogs,
        score: scoreLogs,
        reason: hasExecutionLogs ? "execution.log generated" : "execution.log missing",
      },
      benchmark: {
        pass: benchmarkPass,
        score: scoreBenchmark,
        missing_keywords: missingKeywords,
        required_keywords: benchmarkKeywords,
      },
      security: {
        pass: security.passed,
        score: scoreSecurity,
        findings: security.findings,
        scanned_files: security.scanned_files,
      },
      benchmark_and_security_passed: {
        pass: benchmarkAndSecurityPassed,
        score: scoreBenchmarkAndSecurity,
      },
    },
    overall_pass:
      resultSuccess &&
      skillCalledCorrectly &&
      processClarity &&
      executionTimeAcceptable &&
      hasExecutionLogs &&
      benchmarkAndSecurityPassed,
    overall_score: overallScore,
    judge_notes: [],
  };

  report.judge_notes = buildJudgeNotes(report);

  const jsonPath = resolve(reportRoot, "report.json");
  const mdPath = resolve(reportRoot, "report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  writeFileSync(mdPath, buildMarkdownReport(report), "utf-8");

  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const { flags, positional } = extractArgs(process.argv.slice(2));
  const command = String(positional[0] || "")
    .trim()
    .toLowerCase();

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "rubric") {
    printRubric();
    return;
  }

  if (command === "evaluate") {
    await handleEvaluate(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
