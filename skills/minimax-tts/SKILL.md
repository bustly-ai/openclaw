---
name: minimax-tts
description: Convert text to speech via Bustly gateway (MiniMax T2A backend). Use this skill whenever user asks to read text aloud, generate narration, synthesize voice, or create TTS audio.
user-invocable: true
disable-model-invocation: false
metadata: {"openclaw":{"skillKey":"minimax-tts","aliases":["tts","minimax_tts"],"commandNamespace":"bustly","discoveryCommand":"bustly-minimax-tts --help","defaultCommand":"bustly-minimax-tts \"Hello from Bustly\"","commandExamples":["bustly-minimax-tts \"Hello from Bustly\"","bustly-minimax-tts \"你好，欢迎使用语音合成\" --voice female-shaonv --emotion happy","bustly-minimax-tts \"Breaking news\" --voice presenter_male --output news.mp3"],"runtimePackage":"@bustly/skill-runtime-minimax-tts","runtimeVersion":"^0.1.0","runtimeInstallSpec":"npm:@bustly/skill-runtime-minimax-tts@^0.1.0","runtimeExecutable":"bustly-minimax-tts","runtimeNotes":["Preferred execution: bustly-minimax-tts ...","No repo-local script fallback."]},"requires":{"bins":["python3"]},"install":[{"id":"python-brew","kind":"brew","formula":"python@3.12","bins":["python3"],"label":"Install Python 3"}]}
---

## Command Contract

Always use runtime command:

```bash
bustly-minimax-tts "<text>" [options]
```

Do not call `{baseDir}/scripts/*.py` directly from this skill contract.

## Core Options

- `--voice`
- `--emotion`
- `--speed`
- `--output`
- `--model`
- `--jwt`
- `--workspace-id`

## Examples

```bash
bustly-minimax-tts "Hello, welcome to Bustly"
bustly-minimax-tts "我今天很开心" --voice female-shaonv --emotion happy
bustly-minimax-tts "Daily briefing starts now" --voice presenter_male --output briefing.mp3
```
