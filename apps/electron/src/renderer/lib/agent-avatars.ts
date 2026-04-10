import overviewAvatar from "../assets/imgs/agent-avatars/Web3_Avatar.png";
import marketingAvatar from "../assets/imgs/agent-avatars/Web3 _Avatar_1.png";
import storeOpsAvatar from "../assets/imgs/agent-avatars/Web3_Avatar_2.png";
import customersAvatar from "../assets/imgs/agent-avatars/Web3_Avatar_3.png";
import financeAvatar from "../assets/imgs/agent-avatars/Web3_Avatar_4.png";

const LEGACY_AVATAR_ALIASES: Record<string, string> = {
  "Web3 _Avatar_1.png": "Web3_Avatar_1.png",
};

const AGENT_AVATAR_SRC_MAP: Record<string, string> = {
  "Web3_Avatar.png": overviewAvatar,
  "Web3_Avatar_1.png": marketingAvatar,
  "Web3_Avatar_2.png": storeOpsAvatar,
  "Web3_Avatar_3.png": customersAvatar,
  "Web3_Avatar_4.png": financeAvatar,
};

export const DEFAULT_AGENT_AVATAR = "Web3_Avatar.png";

export const AGENT_AVATAR_OPTIONS = [
  DEFAULT_AGENT_AVATAR,
  "Web3_Avatar_1.png",
  "Web3_Avatar_2.png",
  "Web3_Avatar_3.png",
  "Web3_Avatar_4.png",
] as const;

function looksLikeResolvedAssetPath(value: string): boolean {
  return /^(https?:\/\/|data:image\/|blob:|\/|\.{1,2}\/)/i.test(value);
}

export function normalizeAgentAvatarName(avatarName?: string | null): string {
  const rawValue = typeof avatarName === "string" ? decodeURIComponent(avatarName).trim() : "";
  if (!rawValue) {
    return "";
  }
  const sanitized = rawValue.split("?")[0]?.split("#")[0] ?? rawValue;
  const fileName = sanitized.split("/").pop() || sanitized;
  return LEGACY_AVATAR_ALIASES[fileName] || fileName;
}

export function isAgentAvatarFile(avatarName?: string | null): boolean {
  const normalized = normalizeAgentAvatarName(avatarName);
  return Boolean(normalized && AGENT_AVATAR_SRC_MAP[normalized]);
}

export function getAgentAvatarSrc(avatarName?: string | null): string | null {
  const rawValue = typeof avatarName === "string" ? decodeURIComponent(avatarName).trim() : "";
  if (!rawValue) {
    return null;
  }
  const normalized = normalizeAgentAvatarName(rawValue);
  if (normalized && AGENT_AVATAR_SRC_MAP[normalized]) {
    return AGENT_AVATAR_SRC_MAP[normalized];
  }
  return looksLikeResolvedAssetPath(rawValue) ? rawValue : null;
}
