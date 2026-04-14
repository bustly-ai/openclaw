import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Lightning, UserCircle, X } from "@phosphor-icons/react";
import { AGENT_AVATAR_OPTIONS, getAgentAvatarSrc } from "../../lib/agent-avatars.js";
import type { SkillCatalogItem } from "../../lib/skill-catalog";
import { AgentSkillsPanel } from "../skills/SkillLibraryPanels";

export type AgentSettingsSkill = SkillCatalogItem;

type AgentSettingsModalProps = {
  open: boolean;
  agentName: string;
  agentAvatarSrc: string | null;
  agentIcon: ReactNode;
  draftName: string;
  draftIdentityMarkdown: string;
  draftAvatarName: string | null;
  activeTab: "identity" | "skills";
  saving: boolean;
  skillsLoading: boolean;
  skillsError: string | null;
  skills: AgentSettingsSkill[];
  enabledSkillsCount: number;
  onClose: () => void;
  onSave: () => void;
  onNameChange: (value: string) => void;
  onIdentityMarkdownChange: (value: string) => void;
  onAvatarSelect: (avatarName: string) => void;
  onTabChange: (tab: "identity" | "skills") => void;
  onToggleSkill: (skillName: string) => void;
  isSkillEnabled: (skillName: string) => boolean;
};

function SettingsTabButton(props: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
        props.active
          ? "bg-gray-200 text-[#1A162F]"
          : "text-[#666F8D] hover:bg-gray-100 hover:text-[#1A162F]"
      }`}
    >
      {props.icon}
      <span className="flex-1 truncate text-left">{props.label}</span>
      {props.rightSlot}
    </button>
  );
}

export default function AgentSettingsModal(props: AgentSettingsModalProps) {
  const identityTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncIdentityTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 72)}px`;
  };

  useLayoutEffect(() => {
    if (!props.open || props.activeTab !== "identity") {
      return;
    }
    syncIdentityTextareaHeight(identityTextareaRef.current);
  }, [props.activeTab, props.draftIdentityMarkdown, props.open]);

  if (!props.open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-[rgba(17,24,39,0.28)] p-5"
      onClick={props.onClose}
    >
      <div
        className="flex h-[85vh] w-[90vw] max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-[#E8EBF3] bg-white shadow-[0_32px_90px_rgba(26,22,47,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E8EBF3] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#F4F5F8] text-[#1A162F]">
              {props.agentAvatarSrc ? (
                <img src={props.agentAvatarSrc} alt={props.agentName} className="h-full w-full object-cover" />
              ) : (
                props.agentIcon
              )}
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#1A162F]">{props.draftName.trim() || props.agentName}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A93B2] transition-colors hover:bg-[#F4F5F8] hover:text-[#1A162F]"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="custom-scrollbar flex w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50/30 pt-6">
            <div className="space-y-6 px-3 pb-6">
              <div className="space-y-[2px]">
                <SettingsTabButton
                  active={props.activeTab === "identity"}
                  label="Identity"
                  icon={<UserCircle size={18} weight="bold" className="shrink-0" />}
                  onClick={() => props.onTabChange("identity")}
                />
                <SettingsTabButton
                  active={props.activeTab === "skills"}
                  label="Skills"
                  icon={<Lightning size={18} weight="bold" className="shrink-0" />}
                  rightSlot={
                    <span className="rounded-full bg-[#E8EBF3] px-2 py-0.5 text-[11px] font-bold text-[#666F8D]">
                      {props.enabledSkillsCount}
                    </span>
                  }
                  onClick={() => props.onTabChange("skills")}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden bg-white">
            {props.activeTab === "identity" ? (
              <div className="custom-scrollbar h-full overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="block text-lg font-bold text-[#1A162F]">
                      Agent name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={props.draftName}
                      onChange={(event) => props.onNameChange(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1A162F] outline-none transition-all focus:border-[#1A162F] focus:ring-2 focus:ring-[#1A162F]/20"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-lg font-bold text-[#1A162F]">Agent avatar</label>
                    <div className="grid max-w-[420px] grid-cols-3 gap-3 sm:grid-cols-5">
                      {AGENT_AVATAR_OPTIONS.map((avatarFile) => {
                        const avatarSrc = getAgentAvatarSrc(avatarFile);
                        const selected = props.draftAvatarName === avatarFile;
                        return (
                          <button
                            key={avatarFile}
                            type="button"
                            onClick={() => props.onAvatarSelect(avatarFile)}
                            className={`flex aspect-square items-center justify-center rounded-2xl border bg-white transition-all ${
                              selected
                                ? "border-[#1A162F] shadow-[0_12px_32px_rgba(26,22,47,0.12)] ring-2 ring-[#1A162F]/10"
                                : "border-[#E8EBF3] hover:border-[#C8D0E2] hover:shadow-[0_10px_24px_rgba(26,22,47,0.06)]"
                            }`}
                          >
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={avatarFile} className="h-14 w-14 rounded-full object-cover" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-lg font-bold text-[#1A162F]">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={identityTextareaRef}
                      rows={1}
                      value={props.draftIdentityMarkdown}
                      onChange={(event) => {
                        syncIdentityTextareaHeight(event.currentTarget);
                        props.onIdentityMarkdownChange(event.target.value);
                      }}
                      placeholder="Edit identity.md..."
                      className="w-full resize-none overflow-hidden rounded-xl border border-[#E8EBF3] bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-[#1A162F] placeholder:font-normal placeholder:text-[#8A93B2] outline-none transition-all focus:border-[#1A162F] focus:ring-2 focus:ring-[#1A162F]/20"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="custom-scrollbar h-full overflow-y-auto bg-white">
                <AgentSkillsPanel
                  items={props.skills}
                  loading={props.skillsLoading}
                  error={props.skillsError}
                  selectedSkillNames={props.skills.every((skill) => props.isSkillEnabled(skill.name))
                    ? null
                    : props.skills.filter((skill) => props.isSkillEnabled(skill.name)).map((skill) => skill.name)}
                  onToggleSkill={props.onToggleSkill}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.saving}
            className="rounded-xl bg-[#1A162F] px-6 py-2.5 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-[#27223F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
