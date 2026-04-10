import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Gear, Lightning, UserCircle, X } from "@phosphor-icons/react";
import { AGENT_AVATAR_OPTIONS, getAgentAvatarSrc } from "../../lib/agent-avatars.js";

export type AgentSettingsSkill = {
  name: string;
  description: string;
  source: string;
  eligible: boolean;
};

type AgentSettingsModalProps = {
  open: boolean;
  agentName: string;
  agentAvatarSrc: string | null;
  agentIcon: ReactNode;
  draftName: string;
  draftAvatarName: string | null;
  activeTab: "identity" | "skills";
  saving: boolean;
  skills: AgentSettingsSkill[];
  enabledSkillsCount: number;
  onClose: () => void;
  onSave: () => void;
  onNameChange: (value: string) => void;
  onAvatarSelect: (avatarName: string) => void;
  onTabChange: (tab: "identity" | "skills") => void;
  onToggleSkill: (skillName: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  isSkillEnabled: (skillName: string) => boolean;
};

function SkillToggle(props: { checked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        props.checked ? "bg-[#1A162F]" : "bg-[#E8EBF3]"
      } ${props.disabled ? "cursor-not-allowed opacity-50" : ""}`}
      aria-pressed={props.checked}
    >
      <span
        className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white text-[#1A162F] shadow-sm transition-transform ${
          props.checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      >
        {props.checked ? <Check size={12} weight="bold" /> : null}
      </span>
    </button>
  );
}

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

          <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto bg-white">
            <div className="mx-auto max-w-4xl px-8 py-6">
              {props.activeTab === "identity" ? (
                <div className="space-y-6 pb-20">
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
                </div>
              ) : (
                <div className="space-y-5 pb-20">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#1A162F]">Enabled skills</h3>
                      <p className="mt-1 text-sm text-[#666F8D]">
                        Skill activation now belongs to the current agent only.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={props.onDisableAll}
                        className="rounded-lg border border-[#E8EBF3] px-3 py-2 text-sm font-medium text-[#666F8D] transition-colors hover:bg-[#F8F9FC] hover:text-[#1A162F]"
                      >
                        Disable All
                      </button>
                      <button
                        type="button"
                        onClick={props.onEnableAll}
                        className="rounded-lg border border-[#E8EBF3] px-3 py-2 text-sm font-medium text-[#1A162F] transition-colors hover:bg-[#F8F9FC]"
                      >
                        Use All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {props.skills.map((skill) => {
                      const enabled = props.isSkillEnabled(skill.name);
                      return (
                        <div
                          key={skill.name}
                          className="flex items-start gap-4 rounded-2xl border border-[#E8EBF3] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(26,22,47,0.04)]"
                        >
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F4F5F8] text-[#1A162F]">
                            <Gear size={18} weight="bold" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#1A162F]">{skill.name}</div>
                                <p className="mt-1 text-sm leading-6 text-[#666F8D]">{skill.description}</p>
                              </div>
                              <SkillToggle
                                checked={enabled}
                                disabled={!skill.eligible}
                                onClick={() => props.onToggleSkill(skill.name)}
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded-full bg-[#F4F5F8] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A93B2]">
                                {skill.source}
                              </span>
                              {!skill.eligible ? (
                                <span className="rounded-full bg-[#FFF4E8] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#C56A18]">
                                  Missing requirements
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {props.skills.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#E8EBF3] px-4 py-8 text-center text-sm text-[#8A93B2]">
                        No skills available yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
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
