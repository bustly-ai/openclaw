const INLINE_SIMPLE_COMMAND_ALIASES = new Map<string, string>([
  ["/help", "/help"],
  ["/commands", "/commands"],
  ["/whoami", "/whoami"],
  ["/id", "/whoami"],
]);
const INLINE_SIMPLE_COMMAND_RE = /(?:^|\s)\/(help|commands|whoami|id)(?=$|\s|:)/i;

const INLINE_STATUS_RE = /(?:^|\s)\/status(?=$|\s|:)(?:\s*:\s*)?/gi;

function normalizeStrippedInlineText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function stripMatchedInlineDirective(body: string, match: RegExpMatchArray): string {
  const matchStart = match.index ?? 0;
  const slashOffset = match[0].indexOf("/");
  const start = slashOffset >= 0 ? matchStart + slashOffset : matchStart;
  const end = matchStart + match[0].length;
  return normalizeStrippedInlineText(`${body.slice(0, start)} ${body.slice(end)}`);
}

export function extractInlineSimpleCommand(body?: string): {
  command: string;
  cleaned: string;
} | null {
  if (!body) {
    return null;
  }
  const match = body.match(INLINE_SIMPLE_COMMAND_RE);
  if (!match || match.index === undefined) {
    return null;
  }
  const alias = `/${match[1].toLowerCase()}`;
  const command = INLINE_SIMPLE_COMMAND_ALIASES.get(alias);
  if (!command) {
    return null;
  }
  const cleaned = stripMatchedInlineDirective(body, match);
  return { command, cleaned };
}

export function stripInlineStatus(body: string): {
  cleaned: string;
  didStrip: boolean;
} {
  const trimmed = body.trim();
  if (!trimmed) {
    return { cleaned: "", didStrip: false };
  }
  const matches = Array.from(trimmed.matchAll(INLINE_STATUS_RE));
  if (matches.length === 0) {
    return { cleaned: trimmed, didStrip: false };
  }
  let cleaned = trimmed;
  for (const match of matches.toReversed()) {
    cleaned = stripMatchedInlineDirective(cleaned, match);
  }
  return { cleaned, didStrip: true };
}
