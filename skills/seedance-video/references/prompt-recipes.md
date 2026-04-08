# Seedance Prompt Recipes

## 1) Single Segment (4-15s)

Use this when only one clip is required.

```text
Mode: First-frame reference
Assets Mapping:
- @image1: character identity + color palette anchor

Final Prompt:
[style], [camera], [motion pacing].
0-3s: [setup action + camera movement]
3-7s: [main action + transition]
7-10s: [climax + clean end frame]
Preserve identity consistency and physically plausible motion.

Negative Constraints:
no logo, no subtitle, no on-screen text, no distorted limbs
```

## 2) Continuation Segment (for long video)

Use this for segment 2+.

```text
Mode: Video continuation
Assets Mapping:
- @video1: previous segment continuation anchor
- @image1: optional identity stabilization

Final Prompt:
Continue @video1 for [X] seconds.
Keep identity, outfit, scene lighting, camera direction, and motion rhythm consistent.
Add one major action only in this segment.
End on a stable handoff frame for the next segment.

Negative Constraints:
no hard scene reset, no abrupt character change, no random style shift
```

## 3) E-commerce product ad

```text
Mode: Multi-reference
Assets Mapping:
- @image1: product identity anchor
- @video1: desired camera language (optional)

Final Prompt:
Clean studio background, hero lighting, premium texture detail.
0-2s: product reveal
2-6s: smooth 360-degree showcase
6-10s: key feature close-up and CTA-ready final frame

Negative Constraints:
no extra brand logos, no cluttered background, no subtitle overlay
```

## 4) IP-safe rewrite rule

When user requests franchise/character style:

- Replace all franchise names with original descriptors.
- Keep only high-level traits (tempo, framing, vibe).
- Add explicit negatives to avoid inferred trademark elements.

Example rewrite:

- Instead of: "蜡笔小新风格"
- Use: "手绘蜡笔质感、夸张表情、轻喜剧节奏的原创卡通小男孩"
