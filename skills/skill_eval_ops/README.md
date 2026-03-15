# skill_eval_ops

Standardized skill evaluation harness for OpenClaw-integrated skills.

## Purpose

Evaluate a target skill across six dimensions:

1. Execution success
2. Skill invocation correctness
3. Process clarity
4. Runtime budget compliance
5. Execution log availability
6. Benchmark and security baseline

## Command

```bash
node skills/skill_eval_ops/scripts/run.js evaluate \
  --user-case "用户要求查看电商技能是否能正常读取连接状态" \
  --openclaw-root /Users/qiuweijun/Desktop/project/bustly/openclaw \
  --skill-path skills/commerce_core_ops \
  --command "node skills/commerce_core_ops/scripts/run.js providers" \
  --max-ms 20000
```

## Optional Flags

- `--expect-skill-pattern <regex>`
- `--delivery-pattern <regex>`
- `--process-pattern <regex>`
- `--required-log-keywords <comma-separated>`
- `--benchmark-file <path>`
- `--report-dir <path>`
- `--run-timeout-ms <ms>`
- `--min-output-lines <n>`

## Scoring

The evaluator returns:

- pass/fail for each of the 6 dimensions
- score for each dimension
- `overall_score` (0-100)
- `judge_notes` for agent-facing interpretation

## Benchmark Template

See:
`skills/skill_eval_ops/templates/benchmark.sample.json`

## Output Files

- `execution.log`
- `report.json`
- `report.md`
