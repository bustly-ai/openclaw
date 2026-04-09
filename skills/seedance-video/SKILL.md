---
name: seedance-video
description: Generate Seedance videos through Bustly Model Gateway (`vidio.advanced`) with structured prompt planning (Mode / Assets Mapping / Final Prompt / Negative Constraints / Settings), task polling, and optional long-video stitching.
homepage: https://test-gw.bustly.ai
user-invocable: true
disable-model-invocation: false
metadata: {"openclaw":{"emoji":"🎬","requires":{"bins":["python3"]}}}
---

# Seedance Video (via Bustly Gateway)

Use this skill when users request 豆包/Seedance 视频生成、图生视频、文生视频、视频延展、或超过单段时长限制的视频任务。

Gateway route

- Create task: `POST /api/v1/video/generations/tasks`
- Query task: `GET /api/v1/video/generations/tasks/{task_id}`
- Model route key: `vidio.advanced`

## What this v2 skill adds

This version is aligned to the Seedance prompt-engineering structure you referenced:

- Structured planning format:
  - `Mode`
  - `Assets Mapping`
  - `Final Prompt`
  - `Negative Constraints`
  - `Generation Settings`
- Auto mode selection (`auto`, `text-only`, `first-last-frame`, `all-reference`)
- Timeline beats auto-fill when prompt has no explicit timecodes
- Multi-segment orchestration for long videos (`target-duration` + `segment-duration`)
- Auto split fallback for unsupported single duration (e.g., `--duration 15` -> `10+5` by default)
- Optional local stitching via `ffmpeg`
- IP-sensitive prompt auto rewrite (default enabled)
- watermark default disabled (`--no-watermark` by default)
- Readable-text guard on by default (avoid garbled on-screen text/numbers in generated video)
- Plan-only mode for prompt inspection (`--plan-only`)

## Core rules

1. Always run the bundled script first, then report `TASK` / `VIDEO_URL` / `MEDIA`.
2. Keep orchestration and prompt engineering in this skill; gateway remains thin.
3. Keep prompt language consistent with user input by default.
4. For IP-sensitive requests, default to original-character phrasing.
5. For long videos, enforce continuity per segment and stable handoff frames.
6. If prompt asks for labels/prices/captions, default to icon/composition-based expression (no readable text) unless user explicitly passes `--allow-readable-text`.

## References

- [`references/modes-and-recipes.md`]({baseDir}/references/modes-and-recipes.md)
- [`references/recipes.md`]({baseDir}/references/recipes.md)
- [`references/camera-and-styles.md`]({baseDir}/references/camera-and-styles.md)

## Commands

Single segment generation

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "无人机高速穿越峡谷，电影级运动镜头" \
  --image-url "https://ark-project.tos-cn-beijing.volces.com/doc_image/seepro_i2v.png" \
  --duration 10 \
  --aspect-ratio 16:9
```

Plan-only (no gateway call)

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "生成一段原创动漫追逐镜头" \
  --duration 10 \
  --mode auto \
  --plan-only
```

Long video orchestration (segment + stitch)

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "原创手绘卡通冒险，镜头连贯，节奏轻快" \
  --image-url "https://ark-project.tos-cn-beijing.volces.com/doc_image/seepro_i2v.png" \
  --target-duration 60 \
  --segment-duration 10 \
  --stitch \
  --output-dir ./seedance_60s
```

Silent video + remove watermark

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "产品展示动画，干净背景，细节清晰" \
  --duration 10 \
  --no-generate-audio
```

Enable watermark explicitly

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "产品展示动画，干净背景，细节清晰" \
  --duration 10 \
  --watermark
```

Custom negatives

```bash
python3 {baseDir}/scripts/seedance_video.py \
  --prompt "原创科幻短片" \
  --duration 10 \
  --negative "no camera shake" \
  --negative "no overexposure"
```

## Key options

- `--mode auto|text-only|first-last-frame|all-reference`
- `--duration <seconds>` single clip duration
- `--target-duration <seconds>` long mode total duration
- `--segment-duration <seconds>` per segment duration (recommended <= 15)
- `--single-max-duration <seconds>` max single request before auto-split (default `10`)
- `--image-url/--video-url/--audio-url` repeatable refs
- `--watermark|--no-watermark`
- `--generate-audio|--no-generate-audio`
- `--allow-readable-text` allow readable on-screen text (default off)
- `--negative` repeatable negative constraints
- `--no-default-negatives`
- `--ip-safe-rewrite|--no-ip-safe-rewrite`
- `--plan-only`
- `--stitch|--no-stitch`

## Auth and routing

Auto-loads from local OpenClaw state:

- `~/.bustly/bustlyOauth.json`
  - `user.userAccessToken` as JWT
  - `user.workspaceId`
- `~/.bustly/openclaw.json`
  - `models.providers.bustly.baseUrl`
  - fallback `https://gw.bustly.ai`

Optional env overrides:

- `BUSTLY_MODEL_GATEWAY_VIDEO_ROUTE` (default `vidio.advanced`)
- `BUSTLY_MODEL_GATEWAY_USER_AGENT`

## Output

Script prints:

- `TASK:` task id per segment
- `VIDEO_URL:` upstream video URL
- `VIDEO_FILE:` local file path if downloaded
- `MEDIA:` final media path for OpenClaw auto-attach
- `SUMMARY_FILE:` JSON summary (contains prompt plan and task metadata)
