---
name: skill_eval_ops
category: quality
api_type: local-cli
auth_type: none
description: |
  Evaluate whether a target skill works correctly inside OpenClaw projects. Use this skill when you need repeatable pass/fail checks for execution success, correct skill invocation, process clarity, runtime budget, execution logs, benchmark thresholds, and security baseline.
---

This skill provides a standardized evaluation harness for skills used in OpenClaw workspaces.

Use:
`node skills/skill_eval_ops/scripts/run.js evaluate ...`

## Evaluation Dimensions

1. Result success
2. Skill invocation correctness
3. Process clarity
4. Execution time acceptability
5. Execution log availability
6. Benchmark and security compliance

Each dimension returns pass/fail + score, and the evaluator outputs an overall score (`0-100`) plus judge notes.

## Quick Start

```bash
node skills/skill_eval_ops/scripts/run.js evaluate \
  --user-case "用户希望查看当前店铺连接状态并确认平台已接通" \
  --openclaw-root /Users/qiuweijun/Desktop/project/bustly/openclaw \
  --skill-path skills/commerce_core_ops \
  --command "node skills/commerce_core_ops/scripts/run.js providers" \
  --max-ms 20000 \
  --expect-skill-pattern "platforms|connected_platforms"
```

## Outputs

By default, reports are written under:
`<openclaw-root>/.skill-evals/<skill-name>/<timestamp>/`

- `execution.log` full stdout/stderr and timing
- `report.json` machine-readable result
- `report.md` human-readable summary

## Optional Benchmark File

Use `--benchmark-file <path>` with JSON fields:

```json
{
  "max_ms": 20000,
  "required_log_keywords": ["connected_platforms"]
}
```

## Notes

- This harness is deterministic-first: it measures command behavior and artifacts.
- Security check is static pattern scanning (baseline), not a full audit.
- For high-risk skills, run this together with `skill-vetter`.
- In OpenClaw usage, this evaluator is user-case driven (`--user-case`) and should avoid hardcoding workspace-specific keywords unless needed.
