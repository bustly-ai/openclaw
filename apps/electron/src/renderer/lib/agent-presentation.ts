import {
  resolveBustlyPresetChannel,
  resolveBustlyPresetUseCases,
} from "../../shared/bustly-preset-channels.js";
import type { BustlyPresetUseCase } from "../../shared/bustly-preset-channels.js";
import { getAgentAvatarSrc, isAgentAvatarFile } from "./agent-avatars.js";
import { getSessionIconComponent, type SessionIconId } from "./session-icons.js";

type ResolveAgentPresentationParams = {
  workspaceId?: string | null;
  agentId?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
};

export type AgentPresentation = {
  name: string;
  description: string;
  avatarSrc: string | null;
  avatarName: string | null;
  iconId: SessionIconId;
  useCases: BustlyPresetUseCase[];
};

export function resolveAgentPresentation(params: ResolveAgentPresentationParams): AgentPresentation {
  const preset = resolveBustlyPresetChannel({
    workspaceId: params.workspaceId,
    agentId: params.agentId,
  });
  const explicitAvatarSrc = getAgentAvatarSrc(params.icon);
  const avatarName = isAgentAvatarFile(params.icon) ? params.icon?.trim() || null : preset?.avatar ?? null;
  const avatarSrc = explicitAvatarSrc ?? getAgentAvatarSrc(preset?.avatar);
  const name = params.name?.trim() || preset?.label || "Agent";
  const description = params.description?.trim() || preset?.description?.trim() || "How can I help you today?";
  const iconId = (
    preset?.icon ||
    (!isAgentAvatarFile(params.icon) ? params.icon?.trim() : null) ||
    "Robot"
  ) as SessionIconId;

  return {
    name,
    description,
    avatarSrc,
    avatarName,
    iconId,
    useCases:
      preset?.useCases?.map((useCase) => ({ ...useCase })) ??
      resolveBustlyPresetUseCases({
        workspaceId: params.workspaceId,
        agentId: params.agentId,
      }),
  };
}

export function resolveAgentIconComponent(params: ResolveAgentPresentationParams) {
  return getSessionIconComponent(resolveAgentPresentation(params).iconId);
}
