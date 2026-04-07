const os = require("os");

function detectScriptsInText(text) {
  const scripts = new Set();
  for (const ch of text || "") {
    const cp = ch.codePointAt(0);
    if (
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0x20000 && cp <= 0x2ebef)
    ) {
      scripts.add("han");
      continue;
    }
    if (
      (cp >= 0x3040 && cp <= 0x309f) ||
      (cp >= 0x30a0 && cp <= 0x30ff) ||
      (cp >= 0x31f0 && cp <= 0x31ff) ||
      (cp >= 0xff66 && cp <= 0xff9d)
    ) {
      scripts.add("kana");
      continue;
    }
    if (
      (cp >= 0x1100 && cp <= 0x11ff) ||
      (cp >= 0x3130 && cp <= 0x318f) ||
      (cp >= 0xa960 && cp <= 0xa97f) ||
      (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0xd7b0 && cp <= 0xd7ff)
    ) {
      scripts.add("hangul");
    }
  }
  return scripts;
}

function collectScripts(value, scripts = new Set()) {
  if (typeof value === "string") {
    for (const script of detectScriptsInText(value)) {
      scripts.add(script);
    }
    return scripts;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectScripts(item, scripts);
    }
    return scripts;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectScripts(item, scripts);
    }
  }
  return scripts;
}

function inferDeckLanguage(slideModules) {
  const forced = process.env.PPTX_LANG || process.env.OPENCLAW_PPTX_LANG;
  if (forced) {
    return normalizeLang(forced);
  }

  const scripts = new Set();
  for (const slideModule of slideModules) {
    if (slideModule && slideModule.slideConfig) {
      collectScripts(slideModule.slideConfig, scripts);
    }
  }

  if (scripts.has("hangul")) return "ko-KR";
  if (scripts.has("kana")) return "ja-JP";
  if (scripts.has("han")) return "zh-CN";
  return "en-US";
}

function normalizeLang(lang) {
  const value = String(lang || "").trim().toLowerCase();
  if (!value) return "en-US";
  if (value === "zh" || value.startsWith("zh-")) return "zh-CN";
  if (value === "ja" || value.startsWith("ja-")) return "ja-JP";
  if (value === "ko" || value.startsWith("ko-")) return "ko-KR";
  return lang;
}

function chooseFonts(lang) {
  const platform = os.platform();
  const normalizedLang = normalizeLang(lang);
  const forcedDisplay = process.env.PPTX_FONT_DISPLAY || process.env.OPENCLAW_PPTX_FONT_DISPLAY;
  const forcedBody = process.env.PPTX_FONT_BODY || process.env.OPENCLAW_PPTX_FONT_BODY;

  if (forcedDisplay || forcedBody) {
    return {
      display: forcedDisplay || forcedBody || "Arial",
      body: forcedBody || forcedDisplay || "Arial",
    };
  }

  const byLang = {
    "zh-CN": {
      darwin: { display: "PingFang SC", body: "PingFang SC" },
      win32: { display: "Microsoft YaHei", body: "Microsoft YaHei" },
      linux: { display: "Noto Sans CJK SC", body: "Noto Sans CJK SC" },
      fallback: { display: "Arial Unicode MS", body: "Arial Unicode MS" },
    },
    "ja-JP": {
      darwin: { display: "Hiragino Sans", body: "Hiragino Sans" },
      win32: { display: "Yu Gothic", body: "Yu Gothic" },
      linux: { display: "Noto Sans CJK JP", body: "Noto Sans CJK JP" },
      fallback: { display: "Arial Unicode MS", body: "Arial Unicode MS" },
    },
    "ko-KR": {
      darwin: { display: "Apple SD Gothic Neo", body: "Apple SD Gothic Neo" },
      win32: { display: "Malgun Gothic", body: "Malgun Gothic" },
      linux: { display: "Noto Sans CJK KR", body: "Noto Sans CJK KR" },
      fallback: { display: "Arial Unicode MS", body: "Arial Unicode MS" },
    },
    "en-US": {
      darwin: { display: "Avenir Next", body: "Helvetica Neue" },
      win32: { display: "Aptos Display", body: "Aptos" },
      linux: { display: "DejaVu Sans", body: "DejaVu Sans" },
      fallback: { display: "Arial", body: "Arial" },
    },
  };

  const langConfig = byLang[normalizedLang] || byLang["en-US"];
  return langConfig[platform] || langConfig.fallback;
}

function createDeckTheme(baseTheme, slideModules) {
  const lang = inferDeckLanguage(slideModules);
  const fonts = chooseFonts(lang);
  return {
    ...baseTheme,
    lang,
    fonts,
  };
}

module.exports = {
  createDeckTheme,
  inferDeckLanguage,
  detectScriptsInText,
  collectScripts,
};
