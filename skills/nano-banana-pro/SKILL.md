---
name: nano-banana-pro
description: Generate and edit images via Bustly gateway image route. Use this skill whenever users ask for nano banana, image generation, image editing, style transfer, or multi-image composition.
metadata: {"openclaw":{"skillKey":"nano-banana-pro","aliases":["nano-banana","nano_banana_pro"],"commandNamespace":"bustly","discoveryCommand":"bustly-nano-banana-pro --help","defaultCommand":"bustly-nano-banana-pro --prompt \"A cozy coffee shop interior\" --filename cozy-shop.png","commandExamples":["bustly-nano-banana-pro --prompt \"A cinematic portrait of a robot chef\" --filename robot-chef.png","bustly-nano-banana-pro --prompt \"Turn this into anime style\" --filename anime.png --input-image input.png","bustly-nano-banana-pro --prompt \"Combine these references\" --filename composite.png --input-image img1.png --input-image img2.png"],"runtimePackage":"@bustly/skill-runtime-nano-banana-pro","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-nano-banana-pro@^0.1.0","runtimeExecutable":"bustly-nano-banana-pro","runtimeNotes":["Preferred execution: bustly-nano-banana-pro ...","No repo-local script fallback."]},"requires":{"bins":["uv"]},"install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}
---

## Command Contract

Always use runtime command:

```bash
bustly-nano-banana-pro --prompt "<text>" --filename <output.png> [options]
```

Do not call `{baseDir}/scripts/*.py` directly from this skill contract.

## Core Options

- `--input-image` (repeatable)
- `--resolution` (`1K`, `2K`, `4K`)
- `--model`
- `--jwt`
- `--workspace-id`

## Examples

```bash
bustly-nano-banana-pro --prompt "A futuristic city at dusk" --filename city.png
bustly-nano-banana-pro --prompt "Turn this into anime style" --filename out.png --input-image input.png
bustly-nano-banana-pro --prompt "Combine these references" --filename composite.png --input-image img1.png --input-image img2.png
```
