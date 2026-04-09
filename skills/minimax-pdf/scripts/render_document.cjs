#!/usr/bin/env node
/**
 * render_document.cjs — Node-first PDF renderer for CREATE/REFORMAT routes.
 *
 * Usage:
 *   node render_document.cjs --title "Ops Review" --type report --content ./content.json --out ./report.pdf
 *   node render_document.cjs --title "Restyled Report" --type report --input ./source.md --out ./restyled.pdf
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const DISPLAY_SERIF_STACK = [
  '"Iowan Old Style"',
  '"Palatino Linotype"',
  '"Times New Roman"',
  '"Songti SC"',
  '"STSong"',
  "serif",
].join(", ");
const DISPLAY_SANS_STACK = [
  '"Avenir Next"',
  '"Helvetica Neue"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  "Arial",
  "sans-serif",
].join(", ");
const BODY_STACK = [
  '"Avenir Next"',
  '"Helvetica Neue"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  "Arial",
  "sans-serif",
].join(", ");
const MONO_STACK = [
  '"SFMono-Regular"',
  '"SF Mono"',
  "Menlo",
  "Consolas",
  '"Liberation Mono"',
  '"PingFang SC"',
  "monospace",
].join(", ");
const CJK_DISPLAY_SERIF_STACK = [
  '"Songti SC"',
  '"STSong"',
  '"Noto Serif CJK SC"',
  '"Iowan Old Style"',
  '"Palatino Linotype"',
  '"Times New Roman"',
  "serif",
].join(", ");
const CJK_DISPLAY_SANS_STACK = [
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Noto Sans CJK SC"',
  '"Microsoft YaHei"',
  '"Avenir Next"',
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");
const CJK_BODY_STACK = [
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Noto Sans CJK SC"',
  '"Microsoft YaHei"',
  '"Avenir Next"',
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");
const CJK_MONO_STACK = [
  '"SFMono-Regular"',
  '"SF Mono"',
  "Menlo",
  "Consolas",
  '"Liberation Mono"',
  '"PingFang SC"',
  '"Noto Sans Mono CJK SC"',
  "monospace",
].join(", ");
const SVG_FONT_STACK = CJK_BODY_STACK.replace(/"/g, "'");

const PALETTES = {
  report: {
    cover_bg: "#1B2A38",
    accent: "#3B6D8A",
    accent_lt: "#E6EFF5",
    text_light: "#EDE9E2",
    page_bg: "#FAFAF8",
    dark: "#1A1E24",
    body_text: "#2C2C30",
    muted: "#7A7A84",
    cover_pattern: "fullbleed",
    mood: "authoritative",
  },
  proposal: {
    cover_bg: "#22272E",
    accent: "#4E6070",
    accent_lt: "#EAECEE",
    text_light: "#EDE9E2",
    page_bg: "#FAFAF7",
    dark: "#18191E",
    body_text: "#28282E",
    muted: "#7A7870",
    cover_pattern: "split",
    mood: "confident",
  },
  resume: {
    cover_bg: "#FFFFFF",
    accent: "#1C3557",
    accent_lt: "#E8EEF5",
    text_light: "#FFFFFF",
    page_bg: "#FFFFFF",
    dark: "#111111",
    body_text: "#222222",
    muted: "#888888",
    cover_pattern: "typographic",
    mood: "clean",
  },
  portfolio: {
    cover_bg: "#191C20",
    accent: "#6A7A88",
    accent_lt: "#EAECEE",
    text_light: "#EDE9E4",
    page_bg: "#F8F8F8",
    dark: "#18191E",
    body_text: "#28282E",
    muted: "#8A8A96",
    cover_pattern: "atmospheric",
    mood: "expressive",
  },
  academic: {
    cover_bg: "#F5F4F0",
    accent: "#2A436A",
    accent_lt: "#E6EBF4",
    text_light: "#FFFFFF",
    page_bg: "#F5F4F0",
    dark: "#1A1A28",
    body_text: "#1E1E2A",
    muted: "#686877",
    cover_pattern: "typographic",
    mood: "scholarly",
  },
  general: {
    cover_bg: "#1F2329",
    accent: "#4A6070",
    accent_lt: "#E6EAEC",
    text_light: "#EEEBE5",
    page_bg: "#F8F6F2",
    dark: "#1A1A1A",
    body_text: "#2C2C2C",
    muted: "#888888",
    cover_pattern: "fullbleed",
    mood: "neutral",
  },
  minimal: {
    cover_bg: "#F7F6F4",
    accent: "#4A4A4A",
    accent_lt: "#EBEBEA",
    text_light: "#F7F6F4",
    page_bg: "#F7F6F4",
    dark: "#111111",
    body_text: "#222222",
    muted: "#999999",
    cover_pattern: "minimal",
    mood: "restrained",
  },
  stripe: {
    cover_bg: "#1E222A",
    accent: "#4A5568",
    accent_lt: "#EAECEE",
    text_light: "#FFFFFF",
    page_bg: "#F8F8F7",
    dark: "#0E1117",
    body_text: "#262630",
    muted: "#888898",
    cover_pattern: "stripe",
    mood: "bold",
  },
  diagonal: {
    cover_bg: "#1A2535",
    accent: "#3D5A72",
    accent_lt: "#E4EBF0",
    text_light: "#EEF0F5",
    page_bg: "#F8FAFC",
    dark: "#0F1A2A",
    body_text: "#1E2C3A",
    muted: "#7A8A96",
    cover_pattern: "diagonal",
    mood: "dynamic",
  },
  frame: {
    cover_bg: "#F5F2EC",
    accent: "#5C4A38",
    accent_lt: "#EAE5DE",
    text_light: "#F5F2EC",
    page_bg: "#F5F2EC",
    dark: "#2A1E14",
    body_text: "#2C2018",
    muted: "#9A8A78",
    cover_pattern: "frame",
    mood: "classical",
  },
  editorial: {
    cover_bg: "#FFFFFF",
    accent: "#7A2B36",
    accent_lt: "#EEE4E5",
    text_light: "#FFFFFF",
    page_bg: "#FFFFFF",
    dark: "#0A0A0A",
    body_text: "#1A1A1A",
    muted: "#777777",
    cover_pattern: "editorial",
    mood: "editorial",
  },
  magazine: {
    cover_bg: "#F0EEE9",
    accent: "#1C3557",
    accent_lt: "#E4EBF3",
    text_light: "#FFFFFF",
    page_bg: "#F0EEE9",
    dark: "#0D1A2B",
    body_text: "#2A2A2A",
    muted: "#888888",
    cover_pattern: "magazine",
    mood: "magazine",
  },
  darkroom: {
    cover_bg: "#151C27",
    accent: "#3D5A7A",
    accent_lt: "#E2EBF2",
    text_light: "#EDE9E2",
    page_bg: "#F7F7F5",
    dark: "#0A1018",
    body_text: "#2C2C2C",
    muted: "#8A9AB0",
    cover_pattern: "darkroom",
    mood: "darkroom",
  },
  terminal: {
    cover_bg: "#0D1117",
    accent: "#3D7A5C",
    accent_lt: "#E2EEE8",
    text_light: "#E6EDF3",
    page_bg: "#F8F8F6",
    dark: "#010409",
    body_text: "#2C2C2C",
    muted: "#5A7A6A",
    cover_pattern: "terminal",
    mood: "terminal",
  },
  poster: {
    cover_bg: "#FFFFFF",
    accent: "#0A0A0A",
    accent_lt: "#EBEBEA",
    text_light: "#FFFFFF",
    page_bg: "#FFFFFF",
    dark: "#0A0A0A",
    body_text: "#1A1A1A",
    muted: "#888888",
    cover_pattern: "poster",
    mood: "poster",
  },
};

const FONT_PAIRS = {
  authoritative: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  confident: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
  clean: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  expressive: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  scholarly: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  neutral: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
  restrained: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  bold: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
  dynamic: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
  classical: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  editorial: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
  magazine: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  darkroom: { display: DISPLAY_SERIF_STACK, body: BODY_STACK, mono: MONO_STACK },
  terminal: { display: MONO_STACK, body: MONO_STACK, mono: MONO_STACK },
  poster: { display: DISPLAY_SANS_STACK, body: BODY_STACK, mono: MONO_STACK },
};
const SANS_DISPLAY_MOODS = new Set(["confident", "neutral", "bold", "dynamic", "editorial", "poster"]);

const SUPPORTED_TYPES = new Set([
  "h1", "h2", "h3",
  "body", "bullet", "numbered", "callout", "table",
  "image", "figure", "code", "math", "chart", "flowchart",
  "bibliography", "divider", "caption", "pagebreak", "spacer",
]);

const TYPE_ALIASES = {
  paragraph: "body",
  text: "body",
  list_item: "bullet",
  ordered_item: "numbered",
};

function usage() {
  console.error(
    "Usage: node render_document.cjs --title <title> --type <type> (--content <content.json> | --input <source>) --out <file.pdf>"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    title: "Untitled Document",
    type: "general",
    author: "",
    date: "",
    subtitle: "",
    abstract: "",
    coverImage: "",
    accent: "",
    coverBg: "",
    out: "",
    content: "",
    input: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--title":
        opts.title = next || opts.title;
        i += 1;
        break;
      case "--type":
        opts.type = next || opts.type;
        i += 1;
        break;
      case "--author":
        opts.author = next || "";
        i += 1;
        break;
      case "--date":
        opts.date = next || "";
        i += 1;
        break;
      case "--subtitle":
        opts.subtitle = next || "";
        i += 1;
        break;
      case "--abstract":
        opts.abstract = next || "";
        i += 1;
        break;
      case "--cover-image":
        opts.coverImage = next || "";
        i += 1;
        break;
      case "--accent":
        opts.accent = next || "";
        i += 1;
        break;
      case "--cover-bg":
        opts.coverBg = next || "";
        i += 1;
        break;
      case "--out":
        opts.out = next || "";
        i += 1;
        break;
      case "--content":
        opts.content = next || "";
        i += 1;
        break;
      case "--input":
        opts.input = next || "";
        i += 1;
        break;
      default:
        usage();
    }
  }

  if (!opts.content && !opts.input) {
    usage();
  }

  return opts;
}

function timestampYmdHms() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function sanitizeTopic(topic) {
  const raw = String(topic || "report");
  const compact = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() || "report";
  const cleaned = compact
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "report";
}

function buildCanonicalPdfName(title) {
  return `${sanitizeTopic(title)}_${timestampYmdHms()}.pdf`;
}

function isCanonicalPdfBasename(name) {
  return /.+_\d{8}_\d{6}\.pdf$/i.test(String(name || ""));
}

function resolveCanonicalOutPath(requestedOut, title) {
  const canonicalName = buildCanonicalPdfName(title);
  if (!requestedOut) {
    return {
      finalOut: path.resolve(`./${canonicalName}`),
      rewrittenFrom: null,
    };
  }

  const requested = path.resolve(requestedOut);
  const trailingSlash = /[\\/]$/.test(requestedOut);
  let targetDir;
  if (trailingSlash) {
    targetDir = requested;
  } else {
    try {
      targetDir = fs.statSync(requested).isDirectory() ? requested : path.dirname(requested);
    } catch (_) {
      targetDir = path.dirname(requested);
    }
  }

  const requestedBase = path.basename(requested);
  const finalBase = isCanonicalPdfBasename(requestedBase) ? requestedBase : canonicalName;
  const finalOut = path.resolve(targetDir, finalBase);
  return {
    finalOut,
    rewrittenFrom: finalOut === requested ? null : requested,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function lighten(hex, factor = 0.09) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: Math.round(r * factor + 255 * (1 - factor)),
    g: Math.round(g * factor + 255 * (1 - factor)),
    b: Math.round(b * factor + 255 * (1 - factor)),
  });
}

function mix(hexA, hexB, ratio = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: Math.round(a.r * (1 - ratio) + b.r * ratio),
    g: Math.round(a.g * (1 - ratio) + b.g * ratio),
    b: Math.round(a.b * (1 - ratio) + b.b * ratio),
  });
}

function containsCjk(value) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(String(value ?? ""));
}

function buildTokens(opts) {
  const palette = { ...(PALETTES[opts.type] || PALETTES.general) };
  if (opts.accent) {
    palette.accent = opts.accent;
    palette.accent_lt = lighten(opts.accent, 0.09);
  }
  if (opts.coverBg) {
    palette.cover_bg = opts.coverBg;
  }
  const cjkLayout = [opts.title, opts.subtitle, opts.abstract].some(containsCjk);
  const defaultFonts = FONT_PAIRS[palette.mood] || FONT_PAIRS.neutral;
  const fonts = cjkLayout
    ? {
        display: palette.mood === "terminal"
          ? CJK_MONO_STACK
          : (SANS_DISPLAY_MOODS.has(palette.mood) ? CJK_DISPLAY_SANS_STACK : CJK_DISPLAY_SERIF_STACK),
        body: CJK_BODY_STACK,
        mono: CJK_MONO_STACK,
      }
    : defaultFonts;

  return {
    ...palette,
    title: opts.title,
    author: opts.author,
    date: opts.date,
    subtitle: opts.subtitle,
    abstract: opts.abstract,
    cover_image: opts.coverImage,
    doc_type: opts.type,
    font_display: fonts.display,
    font_body: fonts.body,
    font_mono: fonts.mono,
    cjk_layout: cjkLayout,
    margin_left: 76,
    margin_right: 76,
    margin_top: 82,
    margin_bottom: 74,
  };
}

function normalizeBlock(item) {
  if (typeof item === "string") {
    return { type: "body", text: item };
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const block = { ...item };
  let rawType = String(block.type || "body").trim().toLowerCase();
  rawType = TYPE_ALIASES[rawType] || rawType;

  if (rawType === "heading") {
    const level = Math.max(1, Math.min(3, Number.parseInt(block.level || 1, 10) || 1));
    rawType = `h${level}`;
  }

  if (!SUPPORTED_TYPES.has(rawType)) {
    rawType = "body";
  }
  block.type = rawType;

  if (rawType === "table") {
    const headers = block.headers ?? block.header ?? block.columns;
    const rows = block.rows ?? block.data;
    if (headers != null) {
      block.headers = headers;
    }
    if (rows != null) {
      block.rows = rows;
    }
    return block;
  }

  if (rawType === "bibliography") {
    if (!block.items && Array.isArray(block.rows)) {
      block.items = block.rows;
    }
    return block;
  }

  if (block.text == null) {
    for (const key of ["content", "value", "summary", "abstract", "title"]) {
      if (typeof block[key] === "string") {
        block.text = block[key];
        break;
      }
    }
  }

  return block;
}

function normalizeSequence(items) {
  const blocks = [];
  if (!Array.isArray(items)) {
    return blocks;
  }
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item) && !item.type && (item.sections || item.blocks)) {
      blocks.push(...normalizeDocument(item));
      continue;
    }
    const block = normalizeBlock(item);
    if (block) {
      blocks.push(block);
    }
  }
  return blocks;
}

function normalizeSection(section) {
  if (typeof section === "string") {
    return [{ type: "h1", text: section }];
  }
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return [];
  }
  const blocks = [];
  const title = section.title ?? section.heading;
  if (typeof title === "string" && title.trim()) {
    blocks.push({ type: "h1", text: title.trim() });
  }

  if (Array.isArray(section.sections)) {
    for (const child of section.sections) {
      blocks.push(...normalizeSection(child));
    }
  }

  if (Array.isArray(section.blocks)) {
    blocks.push(...normalizeSequence(section.blocks));
  } else if (section.type) {
    const block = normalizeBlock(section);
    if (block) {
      blocks.push(block);
    }
  }
  return blocks;
}

function normalizeDocument(doc) {
  if (Array.isArray(doc)) {
    return normalizeSequence(doc);
  }
  if (typeof doc === "string") {
    return [{ type: "body", text: doc }];
  }
  if (!doc || typeof doc !== "object") {
    return [];
  }

  const blocks = [];
  const abstract = doc.abstract ?? doc.summary;
  if (typeof abstract === "string" && abstract.trim()) {
    blocks.push({ type: "body", text: abstract.trim() });
  }

  if (Array.isArray(doc.sections)) {
    for (const section of doc.sections) {
      blocks.push(...normalizeSection(section));
    }
    return blocks;
  }

  if (Array.isArray(doc.blocks)) {
    blocks.push(...normalizeSequence(doc.blocks));
    return blocks;
  }

  const block = normalizeBlock(doc);
  return block ? [block] : [];
}

function parseMarkdownTable(lines, startIndex) {
  if (!lines[startIndex]?.trim().startsWith("|")) {
    return null;
  }
  if (!/^\s*\|?[\s:|\-]+\|?\s*$/.test(lines[startIndex + 1] || "")) {
    return null;
  }

  const rows = [];
  let index = startIndex;
  while (index < lines.length && lines[index].trim().startsWith("|")) {
    rows.push(lines[index]);
    index += 1;
  }
  const cleanCells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  const headers = cleanCells(rows[0]);
  const bodyRows = rows.slice(2).map(cleanCells).filter((row) => row.length);
  return {
    nextIndex: index,
    block: {
      type: "table",
      headers,
      rows: bodyRows,
    },
  };
}

function markdownToBlocks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      blocks.push({ type: "body", text: joined });
    }
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const tableResult = parseMarkdownTable(lines, index);
    if (tableResult) {
      flushParagraph();
      blocks.push(tableResult.block);
      index = tableResult.nextIndex;
      continue;
    }

    const codeFence = /^```([^`]*)$/.exec(trimmed);
    if (codeFence) {
      flushParagraph();
      const language = (codeFence[1] || "").trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language,
        text: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: `h${headingMatch[1].length}`,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^___+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const calloutLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        calloutLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "callout", text: calloutLines.join("\n").trim() });
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({ type: "bullet", text: bulletMatch[1].trim() });
      index += 1;
      continue;
    }

    const numberedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (numberedMatch) {
      flushParagraph();
      blocks.push({ type: "numbered", text: numberedMatch[1].trim() });
      index += 1;
      continue;
    }

    const imageMatch = /^!\[(.*?)\]\((.+?)\)$/.exec(trimmed);
    if (imageMatch) {
      flushParagraph();
      blocks.push({
        type: "figure",
        path: imageMatch[2].trim(),
        caption: imageMatch[1].trim(),
      });
      index += 1;
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function loadInputDocument(inputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`File not found: ${inputFile}`);
  }
  const ext = path.extname(inputFile).toLowerCase();
  const raw = fs.readFileSync(inputFile, "utf8");
  if (ext === ".json") {
    return JSON.parse(raw);
  }
  if (ext === ".md") {
    return markdownToBlocks(raw);
  }
  if (ext === ".txt") {
    return raw
      .split(/\n\s*\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => ({ type: "body", text: chunk.replace(/\s*\n\s*/g, " ") }));
  }
  throw new Error(`Unsupported input format for Node renderer: ${ext || "unknown"}`);
}

function looksLikeMarkdownBodyText(value) {
  const text = String(value || "");
  return /(^|\n)\s*(#{1,3}\s+|[-*+]\s+|\d+\.\s+|>\s+|```|(?:\|.+\|[\t ]*\n[\t ]*\|[\s:|\-]+\|)|---+\s*$)/m.test(text);
}

function expandEmbeddedMarkdownBlocks(blocks) {
  const expanded = [];
  for (const block of blocks) {
    const kind = String(block?.type || "").toLowerCase();
    const text = typeof block?.text === "string" ? block.text : "";
    if (kind === "body" && text && looksLikeMarkdownBodyText(text)) {
      const parsed = markdownToBlocks(text);
      if (parsed.length) {
        expanded.push(...parsed);
        continue;
      }
    }
    expanded.push(block);
  }

  while (expanded.length) {
    const tail = expanded[expanded.length - 1];
    const kind = String(tail?.type || "").toLowerCase();
    const text = String(tail?.text || "").trim();
    if (kind === "pagebreak" || (kind === "body" && !text)) {
      expanded.pop();
      continue;
    }
    break;
  }

  return expanded;
}

function resolveAssetSource(value, baseDir) {
  if (!value) {
    return "";
  }
  if (isHttpUrl(value) || /^data:/i.test(value) || /^file:/i.test(value)) {
    return value;
  }
  const resolved = path.isAbsolute(value) ? value : path.resolve(baseDir || process.cwd(), value);
  if (fs.existsSync(resolved)) {
    return pathToFileURL(resolved).href;
  }
  return value;
}

function numberValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function wrapSvgLabel(label, maxChars) {
  const text = String(label ?? "").trim();
  if (!text) {
    return [""];
  }
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
    if (chunks.length === 2) {
      break;
    }
  }
  return chunks;
}

function renderLegend(labels, colors, x, y) {
  return labels
    .map((label, index) => {
      const yy = y + index * 20;
      return `
        <rect x="${x}" y="${yy - 10}" width="10" height="10" rx="2" fill="${colors[index]}" />
        <text x="${x + 16}" y="${yy - 1}" font-size="11" fill="#4B5563" font-family="${SVG_FONT_STACK}">${escapeHtml(label)}</text>
      `;
    })
    .join("");
}

function buildSeriesPalette(accent, count) {
  const out = [];
  for (let i = 0; i < Math.max(count, 1); i += 1) {
    out.push(mix(accent, i % 2 === 0 ? "#FFFFFF" : "#0F172A", i % 2 === 0 ? 0.12 + i * 0.08 : 0.18 + i * 0.05));
  }
  return out;
}

function renderBarChart(item, tokens) {
  const labels = Array.isArray(item.labels) ? item.labels : [];
  const datasets = Array.isArray(item.datasets) && item.datasets.length ? item.datasets : [];
  const values = datasets.flatMap((dataset) => (Array.isArray(dataset.values) ? dataset.values.map(numberValue) : [])).filter((value) => value != null);
  if (!labels.length || !datasets.length || !values.length) {
    return '<div class="chart-fallback">Chart data is incomplete.</div>';
  }

  const width = 680;
  const height = 320;
  const left = 60;
  const right = 24;
  const top = item.title ? 40 : 16;
  const bottom = 74;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...values, 0);
  const scaleMax = maxValue === 0 ? 1 : maxValue * 1.12;
  const gridLines = 5;
  const seriesColors = buildSeriesPalette(tokens.accent, datasets.length);
  const groupWidth = plotWidth / labels.length;
  const barWidth = Math.min(34, (groupWidth * 0.74) / Math.max(datasets.length, 1));
  const totalWidth = barWidth * datasets.length;

  const grid = Array.from({ length: gridLines }, (_, index) => {
    const value = (scaleMax / (gridLines - 1)) * index;
    const y = top + plotHeight - (value / scaleMax) * plotHeight;
    return `
      <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#E5E7EB" stroke-width="1" />
      <text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6B7280" font-family="${SVG_FONT_STACK}">${Math.round(value * 10) / 10}</text>
    `;
  }).join("");

  const bars = datasets.map((dataset, datasetIndex) => {
    const valuesList = Array.isArray(dataset.values) ? dataset.values : [];
    return valuesList.map((rawValue, labelIndex) => {
      const value = numberValue(rawValue) ?? 0;
      const x = left + labelIndex * groupWidth + (groupWidth - totalWidth) / 2 + datasetIndex * barWidth;
      const barHeight = (value / scaleMax) * plotHeight;
      const y = top + plotHeight - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWidth - 4}" height="${barHeight}" rx="4" fill="${seriesColors[datasetIndex]}" />
      `;
    }).join("");
  }).join("");

  const xLabels = labels.map((label, labelIndex) => {
    const x = left + labelIndex * groupWidth + groupWidth / 2;
    const wrapped = wrapSvgLabel(label, /[\u4e00-\u9fff]/.test(label) ? 6 : 12);
    return `
      <text x="${x}" y="${height - 42}" text-anchor="middle" font-size="11" fill="#334155" font-family="${SVG_FONT_STACK}">
        ${wrapped.map((line, lineIndex) => `<tspan x="${x}" dy="${lineIndex === 0 ? 0 : 14}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }).join("");

  const legendLabels = datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`);
  const legend = legendLabels.length > 1 ? renderLegend(legendLabels, seriesColors, width - 170, top + 16) : "";

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(item.title || "chart")}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#FFFFFF" />
      ${item.title ? `<text x="${left}" y="24" font-size="15" font-weight="700" fill="#0F172A" font-family="${SVG_FONT_STACK}">${escapeHtml(item.title)}</text>` : ""}
      ${grid}
      <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#CBD5E1" stroke-width="1.2" />
      ${bars}
      ${xLabels}
      ${legend}
      ${item.y_label ? `<text x="16" y="${top + plotHeight / 2}" transform="rotate(-90 16 ${top + plotHeight / 2})" font-size="11" fill="#64748B" font-family="${SVG_FONT_STACK}">${escapeHtml(item.y_label)}</text>` : ""}
    </svg>
  `;
}

function renderLineChart(item, tokens) {
  const labels = Array.isArray(item.labels) ? item.labels : [];
  const datasets = Array.isArray(item.datasets) && item.datasets.length ? item.datasets : [];
  const values = datasets.flatMap((dataset) => (Array.isArray(dataset.values) ? dataset.values.map(numberValue) : [])).filter((value) => value != null);
  if (!labels.length || !datasets.length || !values.length) {
    return '<div class="chart-fallback">Chart data is incomplete.</div>';
  }

  const width = 680;
  const height = 320;
  const left = 60;
  const right = 24;
  const top = item.title ? 40 : 16;
  const bottom = 74;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const scaleMin = Math.min(0, minValue);
  const scaleMax = maxValue === scaleMin ? scaleMin + 1 : maxValue + (maxValue - scaleMin) * 0.12;
  const seriesColors = buildSeriesPalette(tokens.accent, datasets.length);
  const gridLines = 5;

  const grid = Array.from({ length: gridLines }, (_, index) => {
    const value = scaleMin + ((scaleMax - scaleMin) / (gridLines - 1)) * index;
    const y = top + plotHeight - ((value - scaleMin) / (scaleMax - scaleMin)) * plotHeight;
    return `
      <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#E5E7EB" stroke-width="1" />
      <text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#6B7280" font-family="${SVG_FONT_STACK}">${Math.round(value * 10) / 10}</text>
    `;
  }).join("");

  const labelGap = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;

  const lines = datasets.map((dataset, datasetIndex) => {
    const points = (Array.isArray(dataset.values) ? dataset.values : []).map((rawValue, labelIndex) => {
      const value = numberValue(rawValue) ?? 0;
      const x = left + labelGap * labelIndex;
      const y = top + plotHeight - ((value - scaleMin) / (scaleMax - scaleMin)) * plotHeight;
      return { x, y, value };
    });
    const pathData = points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    return `
      <path d="${pathData}" fill="none" stroke="${seriesColors[datasetIndex]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${seriesColors[datasetIndex]}" />`).join("")}
    `;
  }).join("");

  const xLabels = labels.map((label, labelIndex) => {
    const x = left + labelGap * labelIndex;
    const wrapped = wrapSvgLabel(label, /[\u4e00-\u9fff]/.test(label) ? 6 : 12);
    return `
      <text x="${x}" y="${height - 42}" text-anchor="middle" font-size="11" fill="#334155" font-family="${SVG_FONT_STACK}">
        ${wrapped.map((line, lineIndex) => `<tspan x="${x}" dy="${lineIndex === 0 ? 0 : 14}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    `;
  }).join("");

  const legendLabels = datasets.map((dataset, index) => dataset.label || `Series ${index + 1}`);
  const legend = renderLegend(legendLabels, seriesColors, width - 170, top + 16);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(item.title || "chart")}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#FFFFFF" />
      ${item.title ? `<text x="${left}" y="24" font-size="15" font-weight="700" fill="#0F172A" font-family="${SVG_FONT_STACK}">${escapeHtml(item.title)}</text>` : ""}
      ${grid}
      <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#CBD5E1" stroke-width="1.2" />
      ${lines}
      ${xLabels}
      ${legend}
      ${item.y_label ? `<text x="16" y="${top + plotHeight / 2}" transform="rotate(-90 16 ${top + plotHeight / 2})" font-size="11" fill="#64748B" font-family="${SVG_FONT_STACK}">${escapeHtml(item.y_label)}</text>` : ""}
    </svg>
  `;
}

function pieSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function renderPieChart(item, tokens) {
  const labels = Array.isArray(item.labels) ? item.labels : [];
  const dataset = Array.isArray(item.datasets) && item.datasets[0] ? item.datasets[0] : null;
  const values = dataset && Array.isArray(dataset.values) ? dataset.values.map(numberValue).filter((value) => value != null) : [];
  if (!labels.length || !values.length) {
    return '<div class="chart-fallback">Chart data is incomplete.</div>';
  }

  const width = 680;
  const height = 320;
  const cx = 180;
  const cy = 170;
  const radius = 92;
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const colors = buildSeriesPalette(tokens.accent, values.length);
  let currentAngle = -Math.PI / 2;
  const slices = values.map((value, index) => {
    const angle = (value / total) * Math.PI * 2;
    const pathData = pieSlicePath(cx, cy, radius, currentAngle, currentAngle + angle);
    currentAngle += angle;
    return `<path d="${pathData}" fill="${colors[index]}" stroke="#FFFFFF" stroke-width="2" />`;
  }).join("");
  const legendLabels = labels.map((label, index) => `${label} · ${Math.round((values[index] / total) * 1000) / 10}%`);
  const legend = renderLegend(legendLabels, colors, 340, 110);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(item.title || "chart")}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#FFFFFF" />
      ${item.title ? `<text x="32" y="28" font-size="15" font-weight="700" fill="#0F172A" font-family="${SVG_FONT_STACK}">${escapeHtml(item.title)}</text>` : ""}
      ${slices}
      ${legend}
    </svg>
  `;
}

function renderInlineMarkdown(value) {
  let html = escapeHtml(value ?? "");
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return html;
}

function renderRichText(value) {
  return renderInlineMarkdown(value).replace(/\n/g, "<br />");
}

function renderChart(item, tokens) {
  switch ((item.chart_type || "bar").toLowerCase()) {
    case "line":
      return renderLineChart(item, tokens);
    case "pie":
      return renderPieChart(item, tokens);
    case "bar":
    default:
      return renderBarChart(item, tokens);
  }
}

function renderTable(block) {
  const rawHeaders = Array.isArray(block.headers) ? block.headers : (Array.isArray(block.header) ? block.header : []);
  const rawRows = Array.isArray(block.rows) ? block.rows : [];
  const headers = rawHeaders.length ? rawHeaders : (rawRows[0] || []).map(() => "");
  const rows = rawRows.map((row) => (Array.isArray(row) ? row : [row]));
  if (!headers.length) {
    return "";
  }
  return `
    <figure class="table-figure">
      <table class="data-table">
        <thead>
          <tr>${headers.map((header) => `<th>${renderRichText(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderRichText(cell)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
      ${block.caption ? `<figcaption>${renderRichText(block.caption)}</figcaption>` : ""}
    </figure>
  `;
}

function renderImage(block, baseDir, figureNumber) {
  const source = resolveAssetSource(block.path || block.src, baseDir);
  if (!source) {
    return '<p class="caption muted">Image source missing.</p>';
  }
  const caption = block.caption ? escapeHtml(block.caption) : "";
  const resolvedCaption = block.type === "figure"
    ? `Figure ${figureNumber}${caption ? `: ${caption}` : ""}`
    : caption;
  return `
    <figure class="media-block">
      <img src="${escapeAttr(source)}" alt="${escapeAttr(resolvedCaption || "image")}" />
      ${resolvedCaption ? `<figcaption>${renderRichText(resolvedCaption)}</figcaption>` : ""}
    </figure>
  `;
}

function renderBibliography(block) {
  const items = Array.isArray(block.items) ? block.items : [];
  if (!items.length) {
    return "";
  }
  return `
    <section class="bibliography-block">
      ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ""}
      <ol class="bibliography-list">
        ${items.map((item) => {
          if (typeof item === "string") {
            return `<li>${renderRichText(item)}</li>`;
          }
          const id = item.id ? `[${escapeHtml(item.id)}] ` : "";
          return `<li>${id}${renderRichText(item.text || item.content || "")}</li>`;
        }).join("")}
      </ol>
    </section>
  `;
}

function renderBlocks(blocks, tokens, baseDir) {
  const html = [];
  let index = 0;
  let figureNumber = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    const kind = String(block.type || "body").toLowerCase();

    if (kind === "bullet" || kind === "numbered") {
      const listKind = kind;
      const items = [];
      while (index < blocks.length && String(blocks[index].type || "").toLowerCase() === listKind) {
        items.push(blocks[index]);
        index += 1;
      }
      html.push(
        listKind === "bullet"
          ? `<ul class="bullet-list">${items.map((item) => `<li>${renderRichText(item.text || item.content || "")}</li>`).join("")}</ul>`
          : `<ol class="number-list">${items.map((item) => `<li>${renderRichText(item.text || item.content || "")}</li>`).join("")}</ol>`
      );
      continue;
    }

    if (kind === "figure") {
      figureNumber += 1;
    }

    switch (kind) {
      case "h1":
        html.push(`<section class="section-heading"><h1>${renderRichText(block.text || "")}</h1><div class="section-rule"></div></section>`);
        break;
      case "h2":
        html.push(`<h2>${renderRichText(block.text || "")}</h2>`);
        break;
      case "h3":
        html.push(`<h3>${renderRichText(block.text || "")}</h3>`);
        break;
      case "body":
        html.push(`<p>${renderRichText(block.text || "")}</p>`);
        break;
      case "callout":
        html.push(`
          <aside class="callout">
            ${block.title ? `<div class="callout-title">${renderRichText(block.title)}</div>` : ""}
            <div class="callout-body">${renderRichText(block.text || "")}</div>
          </aside>
        `);
        break;
      case "table":
        html.push(renderTable(block));
        break;
      case "chart":
        html.push(`
          <figure class="chart-block">
            ${renderChart(block, tokens)}
            ${block.caption ? `<figcaption>${renderRichText(block.caption)}</figcaption>` : ""}
          </figure>
        `);
        break;
      case "image":
      case "figure":
        html.push(renderImage(block, baseDir, figureNumber));
        break;
      case "code":
        html.push(`
          <section class="code-block">
            ${block.language ? `<div class="code-language">${escapeHtml(String(block.language).toUpperCase())}</div>` : ""}
            <pre>${escapeHtml(block.text || "")}</pre>
          </section>
        `);
        break;
      case "math":
        html.push(`
          <section class="formula-block">
            <pre>${escapeHtml(block.text || "")}</pre>
            ${block.label ? `<div class="formula-label">${escapeHtml(block.label)}</div>` : ""}
            ${block.caption ? `<div class="formula-caption">${escapeHtml(block.caption)}</div>` : ""}
          </section>
        `);
        break;
      case "flowchart":
        html.push(`
          <section class="flowchart-fallback">
            <div class="flowchart-title">${escapeHtml(block.title || "Flowchart")}</div>
            <p>${escapeHtml("This renderer keeps flowcharts as structured notes to stay dependency-free.")}</p>
            <pre>${escapeHtml(JSON.stringify({ nodes: block.nodes || [], edges: block.edges || [] }, null, 2))}</pre>
          </section>
        `);
        break;
      case "bibliography":
        html.push(renderBibliography(block));
        break;
      case "divider":
        html.push('<hr class="divider" />');
        break;
      case "caption":
        html.push(`<p class="caption">${renderRichText(block.text || "")}</p>`);
        break;
      case "pagebreak":
        html.push('<div class="page-break"></div>');
        break;
      case "spacer":
        html.push(`<div style="height:${Math.max(Number(block.pt) || 12, 4) * 1.333}px"></div>`);
        break;
      default:
        html.push(`<p>${renderRichText(block.text || block.content || "")}</p>`);
        break;
    }

    index += 1;
  }

  return html.join("\n");
}

function coverImageHtml(tokens, baseDir) {
  if (!tokens.cover_image) {
    return "";
  }
  const source = resolveAssetSource(tokens.cover_image, baseDir);
  if (!source) {
    return "";
  }
  return `<img class="cover-image" src="${escapeAttr(source)}" alt="" />`;
}

function renderCover(tokens, baseDir) {
  const subtitle = tokens.subtitle ? `<div class="cover-subtitle">${escapeHtml(tokens.subtitle)}</div>` : "";
  const abstract = tokens.abstract ? `<p class="cover-abstract">${escapeHtml(tokens.abstract)}</p>` : "";
  const meta = [tokens.author, tokens.date].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("<span class=\"meta-divider\"></span>");
  const image = coverImageHtml(tokens, baseDir);

  switch (tokens.cover_pattern) {
    case "split":
      return `
        <section class="pdf-page cover cover-split">
          <div class="split-left">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            <div class="cover-meta">${meta}</div>
          </div>
          <div class="split-right">
            <div class="dot-grid"></div>
            ${abstract}
          </div>
        </section>
      `;
    case "typographic":
      return `
        <section class="pdf-page cover cover-typographic">
          <div class="cover-inner">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            ${abstract}
            <div class="cover-meta">${meta}</div>
          </div>
        </section>
      `;
    case "terminal":
      return `
        <section class="pdf-page cover cover-terminal">
          <div class="terminal-grid"></div>
          <div class="terminal-status">SYSTEM_REPORT // ${escapeHtml(tokens.date || "NOW")}</div>
          <div class="cover-inner">
            <div class="eyebrow">&gt; ${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            ${abstract}
          </div>
          <div class="cover-meta">${meta}</div>
        </section>
      `;
    case "poster":
      return `
        <section class="pdf-page cover cover-poster">
          <div class="poster-bar"></div>
          <div class="cover-inner">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            <div class="cover-meta">${meta}</div>
          </div>
          ${image}
        </section>
      `;
    case "frame":
      return `
        <section class="pdf-page cover cover-frame">
          <div class="frame-shell">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            ${abstract}
            <div class="cover-meta">${meta}</div>
          </div>
        </section>
      `;
    case "magazine":
    case "darkroom":
      return `
        <section class="pdf-page cover cover-centered ${tokens.cover_pattern === "darkroom" ? "cover-centered-dark" : ""}">
          <div class="cover-inner centered">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            ${image}
            ${abstract}
            <div class="cover-meta">${meta}</div>
          </div>
        </section>
      `;
    case "minimal":
      return `
        <section class="pdf-page cover cover-minimal">
          <div class="minimal-bar"></div>
          <div class="cover-inner">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            <div class="cover-meta">${meta}</div>
          </div>
        </section>
      `;
    case "stripe":
      return `
        <section class="pdf-page cover cover-stripe">
          <div class="stripe-top"></div>
          <div class="stripe-middle">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
          </div>
          <div class="stripe-bottom">
            <div class="cover-meta">${meta}</div>
          </div>
        </section>
      `;
    case "diagonal":
    case "editorial":
    case "atmospheric":
    case "fullbleed":
    default:
      return `
        <section class="pdf-page cover cover-fullbleed ${tokens.cover_pattern === "editorial" ? "cover-editorial" : ""}">
          <div class="cover-overlay"></div>
          <div class="dot-grid"></div>
          <div class="cover-inner">
            <div class="eyebrow">${escapeHtml(tokens.doc_type.toUpperCase())}</div>
            <h1>${escapeHtml(tokens.title)}</h1>
            ${subtitle}
            ${abstract}
          </div>
          <div class="cover-meta">${meta}</div>
        </section>
      `;
  }
}

function renderHtml(tokens, blocks, baseDir) {
  const cover = renderCover(tokens, baseDir);
  const body = renderBlocks(blocks, tokens, baseDir);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page { size: A4; margin: 0; }
      :root {
        --cover-bg: ${tokens.cover_bg};
        --accent: ${tokens.accent};
        --accent-light: ${tokens.accent_lt};
        --page-bg: ${tokens.page_bg};
        --dark: ${tokens.dark};
        --body-text: ${tokens.body_text};
        --muted: ${tokens.muted};
        --text-light: ${tokens.text_light};
        --font-display: ${tokens.font_display};
        --font-body: ${tokens.font_body};
        --font-mono: ${tokens.font_mono};
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${A4_WIDTH}px;
        min-height: ${A4_HEIGHT}px;
        background: var(--page-bg);
        color: var(--body-text);
        font-family: var(--font-body);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        font-size: 14px;
        line-height: 1.7;
        text-rendering: optimizeLegibility;
      }
      body.cjk-doc {
        line-height: 1.78;
      }
      body.cjk-doc .cover h1,
      body.cjk-doc .section-heading h1,
      body.cjk-doc h2,
      body.cjk-doc h3 {
        letter-spacing: 0;
      }
      body.cjk-doc .cover h1 {
        line-height: 1.08;
      }
      .pdf-page {
        width: ${A4_WIDTH}px;
        min-height: ${A4_HEIGHT}px;
        page-break-after: always;
        position: relative;
        overflow: hidden;
      }
      .cover {
        background: var(--cover-bg);
        color: var(--text-light);
      }
      .cover h1 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 58px;
        line-height: 1.02;
        letter-spacing: -0.03em;
      }
      .cover .cover-inner {
        position: relative;
        z-index: 2;
      }
      .cover .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent);
        margin-bottom: 22px;
      }
      .cover .cover-subtitle {
        max-width: 540px;
        margin-top: 22px;
        font-size: 18px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.82);
      }
      .cover .cover-abstract {
        max-width: 520px;
        margin-top: 30px;
        font-size: 15px;
        line-height: 1.8;
        color: rgba(255, 255, 255, 0.78);
      }
      .cover .cover-meta {
        position: absolute;
        left: 76px;
        right: 76px;
        bottom: 64px;
        display: flex;
        gap: 14px;
        align-items: center;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.72);
        letter-spacing: 0.04em;
      }
      .cover .meta-divider {
        width: 18px;
        height: 1px;
        background: rgba(255, 255, 255, 0.28);
      }
      .dot-grid {
        position: absolute;
        inset: 0;
        background-image:
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 0),
          radial-gradient(circle at 1px 1px, rgba(59,109,138,0.25) 1px, transparent 0);
        background-size: 30px 30px, 24px 24px;
        background-position: 72% 10%, 78% 14%;
        opacity: 0.34;
      }
      .cover-fullbleed .cover-overlay {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(110deg, rgba(255,255,255,0.04), transparent 38%),
          linear-gradient(180deg, rgba(0,0,0,0.12), transparent 36%);
      }
      .cover-fullbleed .cover-inner,
      .cover-minimal .cover-inner,
      .cover-terminal .cover-inner,
      .cover-poster .cover-inner {
        padding: 140px 76px 160px;
      }
      .cover-editorial h1 {
        text-transform: uppercase;
        font-size: 72px;
        letter-spacing: 0.01em;
      }
      .cover-split {
        display: grid;
        grid-template-columns: 330px 1fr;
      }
      .cover-split .split-left {
        background: var(--cover-bg);
        padding: 150px 42px 150px 42px;
      }
      .cover-split .split-left h1 {
        font-size: 40px;
        color: var(--text-light);
      }
      .cover-split .split-right {
        position: relative;
        background: var(--page-bg);
        color: var(--dark);
        padding: 150px 48px;
        border-left: 3px solid var(--accent);
      }
      .cover-split .split-right .cover-abstract {
        color: var(--body-text);
        max-width: 320px;
      }
      .cover-split .cover-meta {
        position: static;
        margin-top: 36px;
        color: rgba(255,255,255,0.72);
      }
      .cover-typographic,
      .cover-minimal {
        background: var(--page-bg);
        color: var(--dark);
      }
      .cover-typographic .cover-inner,
      .cover-minimal .cover-inner,
      .cover-frame .frame-shell {
        padding: 150px 86px 150px;
      }
      .cover-typographic .cover-subtitle,
      .cover-typographic .cover-abstract,
      .cover-minimal .cover-subtitle,
      .cover-minimal .cover-abstract,
      .cover-frame .cover-subtitle,
      .cover-frame .cover-abstract {
        color: var(--body-text);
      }
      .cover-typographic h1 {
        font-size: 74px;
        max-width: 620px;
        color: var(--dark);
      }
      .cover-centered {
        background: var(--page-bg);
        color: var(--dark);
      }
      .cover-centered-dark {
        background: var(--cover-bg);
        color: var(--text-light);
      }
      .cover-centered .centered {
        min-height: ${A4_HEIGHT}px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 120px 100px 180px;
      }
      .cover-centered .cover-subtitle,
      .cover-centered .cover-abstract {
        max-width: 580px;
        text-align: center;
      }
      .cover-centered-dark .cover-subtitle,
      .cover-centered-dark .cover-abstract {
        color: rgba(255, 255, 255, 0.78);
      }
      .cover-centered h1 {
        color: var(--dark);
      }
      .cover-centered-dark h1 {
        color: var(--text-light);
      }
      .cover-frame {
        background: var(--page-bg);
        color: var(--dark);
      }
      .cover-frame .frame-shell {
        position: absolute;
        inset: 42px;
        border: 1.4px solid rgba(0, 0, 0, 0.16);
      }
      .cover-frame .frame-shell::before,
      .cover-frame .frame-shell::after {
        content: "";
        position: absolute;
        left: 28px;
        right: 28px;
        height: 4px;
        background: var(--accent);
      }
      .cover-frame .frame-shell::before { top: 26px; }
      .cover-frame .frame-shell::after { bottom: 26px; }
      .cover-terminal {
        background: #0B1118;
        color: #E6EDF3;
        font-family: var(--font-mono);
      }
      .cover-terminal h1 {
        font-family: var(--font-mono);
        font-size: 46px;
        padding: 16px 18px;
        border-left: 3px solid var(--accent);
        border-top: 1px solid rgba(61, 122, 92, 0.5);
        max-width: 580px;
        color: var(--text-light);
      }
      .cover-terminal .cover-subtitle,
      .cover-terminal .cover-abstract,
      .cover-terminal .cover-meta,
      .terminal-status {
        font-family: var(--font-mono);
      }
      .terminal-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(61,122,92,0.10) 1px, transparent 1px),
          linear-gradient(90deg, rgba(61,122,92,0.10) 1px, transparent 1px);
        background-size: 48px 48px;
      }
      .terminal-status {
        position: absolute;
        top: 52px;
        left: 76px;
        z-index: 2;
        font-size: 12px;
        letter-spacing: 0.12em;
        color: var(--accent);
      }
      .cover-terminal .cover-meta {
        color: rgba(230, 237, 243, 0.72);
      }
      .cover-poster {
        background: #FFFFFF;
        color: var(--dark);
      }
      .cover-poster .poster-bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 54px;
        background: var(--accent);
      }
      .cover-poster h1 {
        font-size: 84px;
        text-transform: uppercase;
        max-width: 520px;
        color: var(--dark);
      }
      .cover-poster .cover-image {
        position: absolute;
        right: 64px;
        bottom: 150px;
        width: 220px;
        max-height: 320px;
        object-fit: cover;
        filter: grayscale(18%);
      }
      .cover-centered .cover-image {
        width: 240px;
        max-height: 280px;
        object-fit: cover;
        margin: 28px auto 0;
      }
      .cover-minimal .minimal-bar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 10px;
        background: var(--accent);
      }
      .cover-stripe {
        display: grid;
        grid-template-rows: 120px 1fr 180px;
      }
      .cover-stripe .stripe-top {
        background: var(--accent);
      }
      .cover-stripe .stripe-middle {
        padding: 110px 76px;
        background: var(--cover-bg);
      }
      .cover-stripe .stripe-middle h1 {
        color: var(--text-light);
      }
      .cover-stripe .stripe-bottom {
        padding: 46px 76px;
        background: var(--page-bg);
        color: var(--dark);
      }
      .report-body {
        break-before: page;
        padding: ${tokens.margin_top}px ${tokens.margin_right}px ${tokens.margin_bottom}px ${tokens.margin_left}px;
        color: var(--body-text);
      }
      .report-shell {
        position: relative;
      }
      .body-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-bottom: 16px;
        margin-bottom: 28px;
        border-bottom: 1.5px solid var(--accent);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1, h2, h3, p, ul, ol, figure, pre, aside, hr, table, section {
        margin-top: 0;
      }
      h1, h2, h3 {
        color: var(--dark);
        break-after: avoid-page;
      }
      h1, h2, h3, p, li, .callout-body, .callout-title,
      .data-table th, .data-table td, .body-header span,
      figure figcaption, .caption, .formula-caption {
        word-break: normal;
        overflow-wrap: break-word;
        hyphens: manual;
        line-break: auto;
      }
      body.cjk-doc p,
      body.cjk-doc li,
      body.cjk-doc .callout-body,
      body.cjk-doc .data-table th,
      body.cjk-doc .data-table td {
        line-break: strict;
      }
      .cover-fullbleed h1,
      .cover-minimal h1,
      .cover-frame h1 {
        color: inherit;
      }
      .cover-typographic .cover-meta,
      .cover-minimal .cover-meta,
      .cover-frame .cover-meta,
      .cover-centered .cover-meta,
      .cover-poster .cover-meta {
        color: rgba(15, 23, 42, 0.62);
      }
      .cover-centered-dark .cover-meta,
      .cover-fullbleed .cover-meta,
      .cover-stripe .cover-meta {
        color: rgba(255, 255, 255, 0.72);
      }
      .section-heading {
        margin: 34px 0 16px;
        break-inside: avoid;
      }
      .section-heading h1 {
        margin-bottom: 10px;
        font-size: 28px;
        line-height: 1.2;
        font-family: var(--font-display);
      }
      .section-rule {
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, var(--accent), transparent 72%);
      }
      h2 {
        margin: 24px 0 10px;
        font-size: 18px;
        line-height: 1.35;
        font-family: var(--font-display);
      }
      h3 {
        margin: 18px 0 8px;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 700;
      }
      p, li {
        font-size: 14px;
        line-height: 1.78;
        orphans: 3;
        widows: 3;
      }
      p {
        margin-bottom: 12px;
      }
      .bullet-list,
      .number-list {
        margin: 10px 0 14px 20px;
        padding: 0;
      }
      .bullet-list li,
      .number-list li {
        margin-bottom: 8px;
      }
      .callout {
        margin: 18px 0;
        padding: 18px 20px 18px 22px;
        background: var(--accent-light);
        border-left: 4px solid var(--accent);
        border-radius: 12px;
        break-inside: avoid;
      }
      .callout-title {
        margin-bottom: 6px;
        font-weight: 700;
        color: var(--dark);
      }
      .table-figure,
      .chart-block,
      .media-block,
      .code-block,
      .formula-block,
      .flowchart-fallback,
      .bibliography-block {
        margin: 18px 0 20px;
        break-inside: avoid;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        overflow: hidden;
        border: 1px solid #D5D8DD;
        border-radius: 14px;
      }
      .data-table thead {
        display: table-header-group;
      }
      .data-table th,
      .data-table td {
        padding: 12px 14px;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      .data-table th {
        background: var(--accent);
        color: #FFFFFF;
        font-weight: 700;
        font-size: 13px;
        text-align: left;
      }
      .data-table tbody tr:nth-child(even) td {
        background: var(--accent-light);
      }
      .data-table tbody tr:nth-child(odd) td {
        background: #FFFFFF;
      }
      figure figcaption,
      .caption,
      .formula-caption {
        margin-top: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }
      .chart-block svg,
      .media-block img {
        display: block;
        width: 100%;
        border-radius: 14px;
      }
      .media-block img {
        max-height: 420px;
        object-fit: cover;
        background: #E5E7EB;
      }
      .code-block {
        background: var(--accent-light);
        border-left: 4px solid var(--accent);
        border-radius: 12px;
        padding: 16px 18px;
      }
      .code-language {
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 11px;
        letter-spacing: 0.18em;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.65;
      }
      .formula-block {
        padding: 16px 18px;
        border: 1px solid #D8DCE3;
        border-radius: 12px;
        background: #FFFFFF;
      }
      .formula-label {
        margin-top: 8px;
        text-align: right;
        color: var(--muted);
        font-size: 12px;
      }
      .flowchart-fallback {
        padding: 16px 18px;
        background: #FFFFFF;
        border: 1px dashed #CBD5E1;
        border-radius: 12px;
      }
      .flowchart-title {
        margin-bottom: 8px;
        font-weight: 700;
        color: var(--dark);
      }
      strong {
        font-weight: 700;
        color: var(--dark);
      }
      em {
        font-style: italic;
      }
      p code,
      li code,
      td code,
      th code,
      .callout-body code,
      .caption code {
        font-family: var(--font-mono);
        font-size: 0.92em;
        background: rgba(15, 23, 42, 0.07);
        padding: 0.08em 0.32em;
        border-radius: 0.34em;
      }
      .bibliography-list {
        margin: 0;
        padding-left: 22px;
      }
      .bibliography-list li {
        margin-bottom: 8px;
      }
      .divider {
        border: none;
        height: 1px;
        background: #D7DBE2;
        margin: 22px 0;
      }
      .page-break {
        break-after: page;
        page-break-after: always;
        height: 0;
      }
      .chart-fallback {
        padding: 18px;
        border-radius: 12px;
        background: #FFFFFF;
        border: 1px dashed #CBD5E1;
        color: var(--muted);
      }
    </style>
  </head>
  <body class="${tokens.cjk_layout ? "cjk-doc" : ""}">
    ${cover}
    <main class="report-body">
      <div class="report-shell">
        <div class="body-header">
          <span>${escapeHtml(tokens.title)}</span>
          <span>${escapeHtml(tokens.date || tokens.author || tokens.doc_type)}</span>
        </div>
        ${body}
      </div>
    </main>
  </body>
  </html>`;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (_) {}

  const globalRoots = [];
  globalRoots.push(path.resolve(process.execPath, "..", "..", "lib", "node_modules"));
  if (process.env.npm_config_prefix) {
    globalRoots.push(path.join(process.env.npm_config_prefix, "lib", "node_modules"));
  }
  if (process.env.HOME) {
    globalRoots.push(path.join(process.env.HOME, ".npm-global", "lib", "node_modules"));
  }
  globalRoots.push("/opt/homebrew/lib/node_modules");
  globalRoots.push("/usr/local/lib/node_modules");

  for (const root of globalRoots) {
    try {
      return require(path.join(root, "playwright"));
    } catch (_) {}
  }

  console.error(JSON.stringify({
    status: "error",
    error: "playwright not found",
    hint: "Run: npm install -g playwright && npx playwright install chromium",
  }));
  process.exit(2);
}

async function renderPdf(html, outFile) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minimax-pdf-"));
  const htmlFile = path.join(tempDir, "document.html");
  fs.writeFileSync(htmlFile, html, "utf8");

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    await page.pdf({
      path: outFile,
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sourceFile = opts.content || opts.input;
  const sourceDir = path.dirname(path.resolve(sourceFile));
  const sourceDoc = opts.content
    ? JSON.parse(fs.readFileSync(opts.content, "utf8"))
    : loadInputDocument(opts.input);
  const blocks = expandEmbeddedMarkdownBlocks(normalizeDocument(sourceDoc));
  const tokens = buildTokens(opts);
  const html = renderHtml(tokens, blocks, sourceDir);
  const output = resolveCanonicalOutPath(opts.out, opts.title);
  const outFile = output.finalOut;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  await renderPdf(html, outFile);

  const stat = fs.statSync(outFile);
  console.log(JSON.stringify({
    status: "ok",
    out: outFile,
    filename: path.basename(outFile),
    rewritten_from: output.rewrittenFrom,
    size_kb: Math.round(stat.size / 1024),
    renderer: "node-playwright",
    blocks: blocks.length,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "error",
    error: String(error?.message || error),
  }));
  process.exit(3);
});
