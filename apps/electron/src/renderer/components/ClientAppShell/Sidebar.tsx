import { createPortal } from "react-dom";
import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  DotsThree,
  Gear,
  BugBeetle,
  Lightning,
  PencilSimple,
  Plus,
  UserCircle,
  UserPlus,
  SquaresFour,
  SignOut,
  Trash,
  X,
} from "@phosphor-icons/react";
import bustlyWordmark from "../../assets/imgs/bustly_wordmark.png";
import logoIcon from "../../assets/imgs/collapsed_logo_v2.svg";
import openSidebarIcon from "../../assets/imgs/open_sidebar.svg";
import {
  buildChatRoute,
  CollapsedScenariosIcon,
  getSessionIconComponent,
} from "../../lib/session-icons";
import {
  AGENT_AVATAR_OPTIONS,
  DEFAULT_AGENT_AVATAR,
  getAgentAvatarSrc,
  normalizeAgentAvatarName,
} from "../../lib/agent-avatars";
import { resolveAgentPresentation } from "../../lib/agent-presentation";
import { listWorkspaceSummaries, type WorkspaceSummary } from "../../lib/bustly-supabase";
import {
  fetchSkillCatalog,
  recommendSkillNames,
  type SkillCatalogItem,
} from "../../lib/skill-catalog";
import { useAppState } from "../../providers/AppStateProvider";
import { useGlobalLoader } from "../../providers/GlobalLoaderProvider";
import {
  buildBustlyWorkspaceAgentId,
  resolveAgentIdFromSessionKey,
} from "../../../shared/bustly-agent";
import UpdatePrompt from "../Updater/UpdatePrompt";
import { CreateAgentSkillsStep } from "../skills/SkillLibraryPanels";
import Skeleton from "../ui/Skeleton";
import PortalTooltip from "../ui/PortalTooltip";

type ClientAppSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

type SidebarTask = {
  id: string;
  agentId: string;
  name: string;
  icon?: string;
  skills?: string[];
  isMain?: boolean;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type SidebarSession = {
  id: string;
  agentId: string;
  name: string;
  icon?: string;
  running?: boolean;
  updatedAt?: number | null;
};

const SIDEBAR_TASKS_REFRESH_EVENT = "openclaw:sidebar-refresh-tasks";
const SIDEBAR_TASK_RUN_STATE_EVENT = "openclaw:sidebar-task-run-state";
const CREATE_AGENT_VIBES = ["Professional", "Friendly", "Creative", "Concise", "Casual", "Expert"] as const;

function notifySidebarTasksRefresh() {
  window.dispatchEvent(new Event(SIDEBAR_TASKS_REFRESH_EVENT));
}

function SpinnerIcon({ className }: { className?: string }) {
  return <CircleNotch size={14} weight="bold" className={className} />;
}

function TaskStatusIndicator(props: { status?: "running"; className?: string }) {
  if (props.status !== "running") {
    return null;
  }
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center text-[#5A5CFF] ${props.className ?? ""}`}>
      <CircleNotch size={13} weight="bold" className="animate-spin" />
    </span>
  );
}

function sortSidebarAgents(
  agents: BustlyWorkspaceAgent[],
  options: { pendingAgentId?: string | null },
): BustlyWorkspaceAgent[] {
  const pendingAgentId = options?.pendingAgentId?.trim() || null;
  return [...agents].sort((left, right) => {
    if (left.isMain && !right.isMain) {
      return -1;
    }
    if (right.isMain && !left.isMain) {
      return 1;
    }
    if (pendingAgentId) {
      if (left.agentId === pendingAgentId && right.agentId !== pendingAgentId) {
        return -1;
      }
      if (right.agentId === pendingAgentId && left.agentId !== pendingAgentId) {
        return 1;
      }
    }
    const leftCreatedAt = left.createdAt ?? 0;
    const rightCreatedAt = right.createdAt ?? 0;
    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }
    return left.name.localeCompare(right.name);
  });
}

function sortSidebarSessions(sessions: SidebarSession[]): SidebarSession[] {
  return [...sessions].sort((left, right) => {
    const leftUpdatedAt = left.updatedAt ?? 0;
    const rightUpdatedAt = right.updatedAt ?? 0;
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }
    return left.name.localeCompare(right.name);
  });
}

type IconProps = {
  className?: string;
};

function CaretDownIcon({ className }: IconProps) {
  return <CaretDown size={14} weight="bold" className={className} />;
}

function CaretRightIcon({ className }: IconProps) {
  return <CaretRight size={14} weight="bold" className={className} />;
}

function CheckIcon({ className }: IconProps) {
  return <Check size={16} weight="bold" className={className} />;
}

function CloseIcon({ className }: IconProps) {
  return <X size={16} weight="bold" className={className} />;
}

function GearIcon({ className }: IconProps) {
  return <Gear size={16} weight="bold" className={className} />;
}

function UserPlusIcon({ className }: IconProps) {
  return <UserPlus size={16} weight="bold" className={className} />;
}

function ReportIssueIcon({ className }: IconProps) {
  return <BugBeetle size={16} weight="bold" className={className} />;
}

function SignOutIcon({ className }: IconProps) {
  return <SignOut size={16} weight="bold" className={className} />;
}

function LightningIcon({ className }: IconProps) {
  return <Lightning size={18} weight="bold" className={className} />;
}

function SidebarModal(props: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  flush?: boolean;
}) {
  useEffect(() => {
    if (!props.open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.open, props.onClose]);

  if (!props.open) {
    return null;
  }
  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/20 p-4"
      onClick={props.onClose}
    >
      <div
        className={`w-full rounded-3xl border border-gray-200 bg-white shadow-2xl ${props.widthClassName ?? "max-w-sm"} ${props.panelClassName ?? ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between gap-3 ${
            props.flush
              ? "border-b border-[#E8EBF3] px-6 py-5"
              : "mb-4 px-5 pt-5"
          } ${props.headerClassName ?? ""}`}
        >
          <h2 className="text-lg font-semibold text-[#1A162F]">{props.title}</h2>
          <button
            type="button"
            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            onClick={props.onClose}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className={`${props.flush ? "" : "px-5 pb-5"} ${props.bodyClassName ?? ""}`}>
          {props.children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SidebarItem(props: {
  icon: ComponentType<Record<string, unknown>> | string;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
  rightSlot?: ReactNode;
  rightSlotVisible?: boolean;
  showTooltip?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  insetClassName?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const itemRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <div
        ref={itemRef}
        onClick={props.onClick}
        onMouseEnter={() => {
          setIsHovered(true);
          props.onMouseEnter?.();
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          props.onMouseLeave?.();
        }}
        className={`group relative flex cursor-pointer items-center rounded-xl transition-all duration-200 ${
          props.collapsed
            ? props.insetClassName ?? "mx-2 justify-center px-2 py-3"
            : props.insetClassName ?? "mx-4 gap-3 px-4 py-2.5"
        } ${
          props.active
            ? "bg-[#1A162F]/10 font-semibold text-[#1A162F] hover:bg-[#1A162F]/15"
            : "text-slate-500 hover:bg-[#1A162F]/5 hover:text-slate-900"
        }`}
      >
        {typeof props.icon === "string" ? (
          <img src={props.icon} alt={props.label} className="h-[18px] w-[18px] shrink-0" />
        ) : (
          createElement(props.icon, { className: "h-[18px] w-[18px] shrink-0", size: 18, weight: "bold" })
        )}
        {!props.collapsed ? (
          <div className={`min-w-0 flex-1 transition-[padding] duration-150 ${props.rightSlot && props.rightSlotVisible ? "pr-11" : ""}`}>
            <span
              className={`block min-w-0 truncate whitespace-nowrap text-[14px] ${props.active ? "font-medium" : "font-normal"}`}
              title={props.label}
            >
              {props.label}
            </span>
          </div>
        ) : null}
        {!props.collapsed && props.rightSlot ? (
          <div className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 items-center">{props.rightSlot}</div>
        ) : null}
      </div>
      <PortalTooltip
        open={!!props.collapsed && !!props.showTooltip && isHovered}
        anchor={itemRef.current}
        side="right"
        content={props.label}
      />
    </>
  );
}

function AgentFolderItem(props: {
  agent: SidebarTask;
  workspaceId: string;
  active: boolean;
  hasSessions: boolean;
  expanded: boolean;
  collapsed: boolean;
  onToggleExpand: () => void;
  onOpenAgent: () => void;
  onRename: () => void;
  onDelete: () => void;
  onChangeIcon: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const presentation = resolveAgentPresentation({
    workspaceId: props.workspaceId,
    agentId: props.agent.agentId,
    name: props.agent.name,
    icon: props.agent.icon,
  });
  const Icon = getSessionIconComponent(presentation.iconId);
  const handleRowClick = () => {
    if (props.hasSessions) {
      props.onToggleExpand();
      return;
    }
    props.onOpenAgent();
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleRowClick}
        className={`group relative mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 transition-all duration-200 ${
          props.active
            ? "bg-[#1A162F]/10 text-[#1A162F] hover:bg-[#1A162F]/15"
            : "text-text-sub hover:bg-[#1A162F]/5 hover:text-text-main"
        }`}
      >
        {!props.collapsed ? (
          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            {props.hasSessions ? (
              <>
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                    isHovered ? "scale-90 opacity-0" : "scale-100 opacity-100"
                  }`}
                >
                  {presentation.avatarSrc ? (
                    <img
                      src={presentation.avatarSrc}
                      alt={props.agent.name}
                      className="h-5 w-5 rounded-full border border-[#E8EBF3] object-cover"
                    />
                  ) : (
                    <Icon size={16} weight="bold" className="shrink-0" />
                  )}
                </div>
                <div
                  className={`absolute inset-0 flex items-center justify-center text-[#8A93B2] transition-all duration-200 ${
                    isHovered ? "scale-100 opacity-100" : "scale-90 opacity-0"
                  }`}
                  style={{ transform: `rotate(${props.expanded ? 90 : 0}deg)` }}
                >
                  <CaretRight size={12} weight="fill" />
                </div>
              </>
            ) : presentation.avatarSrc ? (
              <img
                src={presentation.avatarSrc}
                alt={props.agent.name}
                className="h-5 w-5 rounded-full border border-[#E8EBF3] object-cover"
              />
            ) : (
              <Icon size={16} weight="bold" className="shrink-0" />
            )}
          </div>
        ) : null}

        {!props.collapsed ? (
          <div className="min-w-0 flex-1 pr-12">
            <span className={`block truncate whitespace-nowrap text-[14px] ${props.active ? "font-medium" : "font-normal"}`}>
              {props.agent.name}
            </span>
          </div>
        ) : null}

        {!props.collapsed ? (
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-0.5">
            <PortalTooltip
              content="More actions"
              side="right"
              disabled={menuOpen}
              className={`transition-all ${!isHovered && !menuOpen ? "pointer-events-none opacity-0" : ""}`}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                className={`flex h-5 w-5 items-center justify-center rounded text-current transition-all hover:bg-white hover:text-[#1A162F] ${
                  menuOpen ? "bg-white/80 shadow-sm" : ""
                }`}
                aria-label="More actions"
              >
                <DotsThree size={14} weight="bold" />
              </button>
            </PortalTooltip>
            <PortalTooltip
              content="New task"
              side="right"
              className={`transition-all ${!isHovered ? "pointer-events-none opacity-0" : ""}`}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onOpenAgent();
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-current transition-all hover:bg-white hover:text-[#1A162F]"
                aria-label="New task"
              >
                <Plus size={12} weight="bold" />
              </button>
            </PortalTooltip>
          </div>
        ) : null}
      </div>

      {menuOpen && !props.collapsed && triggerRef.current
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[11000] w-40 rounded-xl border border-gray-100 bg-white p-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]"
              style={{
                top: triggerRef.current.getBoundingClientRect().bottom + 4,
                right: window.innerWidth - triggerRef.current.getBoundingClientRect().right,
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-text-sub transition-colors hover:bg-gray-50 hover:text-text-main"
                onClick={() => {
                  setMenuOpen(false);
                  props.onChangeIcon();
                }}
              >
                <UserCircle size={16} weight="bold" />
                Change avatar
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-text-sub transition-colors hover:bg-gray-50 hover:text-text-main"
                onClick={() => {
                  setMenuOpen(false);
                  props.onRename();
                }}
              >
                <PencilSimple size={16} weight="bold" />
                Rename
              </button>
              {!props.agent.isMain ? <div className="my-1 h-px bg-gray-100" /> : null}
              {!props.agent.isMain ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    props.onDelete();
                  }}
                >
                  <Trash size={16} weight="bold" />
                  Delete
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function AgentChildItem(props: {
  label: string;
  active: boolean;
  running?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`relative mx-3 ml-[30px] flex w-auto items-center rounded-lg py-1.5 pr-2 pl-2 text-left transition-all duration-200 ${
        props.active ? "bg-[#1A162F]/10 text-[#1A162F]" : "text-text-sub hover:bg-[#1A162F]/5 hover:text-text-main"
      }`}
    >
      <div className="min-w-0 flex-1 pr-6">
        <span className="block truncate whitespace-nowrap text-[13px] font-normal transition-colors duration-200">
          {props.label}
        </span>
      </div>
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {props.running ? <TaskStatusIndicator status="running" className="scale-75" /> : null}
      </div>
    </button>
  );
}

function CollapsedScenariosButton(props: {
  tasks: SidebarTask[];
  workspaceId: string;
  activeTaskId: string;
  onOpenTask: (task: SidebarTask) => void;
  onRenameClick: (task: SidebarTask) => void;
  onDeleteClick: (task: SidebarTask) => void;
  onChangeIcon: (task: SidebarTask) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuTask, setMenuTask] = useState<SidebarTask | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const activeTask = props.tasks.find((task) => task.id === props.activeTaskId);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: Math.max(20, rect.top - 8),
      left: rect.right + 14,
    });
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const openPanel = useCallback(() => {
    clearCloseTimeout();
    updatePosition();
    setIsOpen(true);
  }, [clearCloseTimeout, updatePosition]);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setMenuTask(null);
    }, 120);
  }, [clearCloseTimeout]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleResize = () => updatePosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setMenuTask(null);
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousedown", handlePointerDown);
      clearCloseTimeout();
    };
  }, [clearCloseTimeout, isOpen, updatePosition]);

  const openTaskMenu = (event: ReactMouseEvent<HTMLButtonElement>, task: SidebarTask) => {
    event.stopPropagation();
    clearCloseTimeout();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const viewportPadding = 12;
    const preferredLeft = rect.right + 8;
    const maxLeft = window.innerWidth - menuWidth - viewportPadding;
    setMenuPosition({
      top: Math.max(16, rect.top - 6),
      left: Math.min(preferredLeft, maxLeft),
    });
    setMenuTask(task);
  };

  return (
    <>
      <div ref={triggerRef} onMouseEnter={openPanel} onMouseLeave={scheduleClose} className="flex w-full justify-center">
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              setMenuTask(null);
              return;
            }
            openPanel();
          }}
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
            activeTask ? "bg-[#1A162F]/10 text-[#1A162F]" : "text-text-sub hover:bg-[#1A162F]/5 hover:text-text-main"
          }`}
          aria-label="Agents"
          title="Agents"
        >
          <CollapsedScenariosIcon size={18} weight="bold" />
        </button>
      </div>

      {isOpen
        ? createPortal(
            <div
              ref={panelRef}
              onMouseEnter={openPanel}
              onMouseLeave={scheduleClose}
              className="fixed z-[9999] w-[280px] rounded-2xl border border-[#E6E9F0] bg-white p-2 shadow-[0_18px_48px_rgba(26,22,47,0.14)]"
              style={{ top: coords.top, left: coords.left }}
            >
              <div className="px-2 pt-1 pb-2 text-xs font-medium text-[#666F8D]">Agents</div>
              <div className="space-y-0.5">
                {props.tasks.map((task) => {
                  const presentation = resolveAgentPresentation({
                    workspaceId: props.workspaceId,
                    agentId: task.agentId,
                    name: task.name,
                    icon: task.icon,
                  });
                  const Icon = getSessionIconComponent(presentation.iconId);
                  const isActive = task.id === props.activeTaskId;
                  return (
                    <div
                      key={task.id}
                      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                        isActive ? "bg-[#1A162F]/10" : "hover:bg-[#F5F7FB]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          props.onOpenTask(task);
                          setIsOpen(false);
                          setMenuTask(null);
                        }}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors ${
                          isActive ? "text-[#1A162F]" : "text-[#666F8D] hover:text-[#1A162F]"
                        }`}
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {presentation.avatarSrc ? (
                            <img
                              src={presentation.avatarSrc}
                              alt={task.name}
                              className="h-5 w-5 rounded-full border border-[#E8EBF3] object-cover"
                            />
                          ) : (
                            <Icon size={17} weight="bold" className="shrink-0" />
                          )}
                        </div>
                        <span className={`min-w-0 flex-1 truncate text-sm ${isActive ? "font-medium" : "font-normal"}`}>
                          {task.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openTaskMenu(event, task)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          menuTask?.id === task.id
                            ? "bg-[#EEF1F6] text-[#1A162F]"
                            : "text-[#8A93B2] hover:bg-[#EEF1F6] hover:text-[#1A162F]"
                        }`}
                      >
                        <DotsThree size={15} weight="bold" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}

      {menuTask
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[10000] w-44 rounded-xl border border-[#E6E9F0] bg-white p-1.5 shadow-[0_18px_48px_rgba(26,22,47,0.14)]"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              onMouseEnter={openPanel}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                onClick={() => {
                  props.onChangeIcon(menuTask);
                  setMenuTask(null);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#666F8D] transition-colors hover:bg-[#F5F7FB] hover:text-[#1A162F]"
              >
                <UserCircle size={16} weight="bold" />
                Change avatar
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onRenameClick(menuTask);
                  setMenuTask(null);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#666F8D] transition-colors hover:bg-[#F5F7FB] hover:text-[#1A162F]"
              >
                <PencilSimple size={16} weight="bold" />
                Rename
              </button>
              {!menuTask.isMain ? <div className="my-1 h-px bg-[#EEF1F6]" /> : null}
              {!menuTask.isMain ? (
                <button
                  type="button"
                  onClick={() => {
                    props.onDeleteClick(menuTask);
                    setMenuTask(null);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash size={16} weight="bold" />
                  Delete
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TaskItemSkeleton() {
  return (
    <div className="mx-4 flex items-center gap-3 px-4 py-2.5">
      <Skeleton className="h-3.5 w-full rounded-md" />
    </div>
  );
}

function WorkspaceItemSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-28 rounded-md" />
      </div>
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
  );
}

function WorkspaceTriggerSkeleton(props: { collapsed: boolean }) {
  if (props.collapsed) {
    return <Skeleton className="h-10 w-10 rounded-xl" />;
  }
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <Skeleton className="h-6 w-6 rounded-md" />
      <Skeleton className="h-5 w-32 rounded-md" />
      <Skeleton className="ml-auto h-3 w-3 rounded-sm" />
    </div>
  );
}

function getWorkspaceInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "W";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0]?.slice(0, 1) ?? ""}${parts[1]?.slice(0, 1) ?? ""}`.toUpperCase();
}

function WorkspaceAvatar(props: {
  name: string;
  logoUrl: string | null | undefined;
  className: string;
  imageClassName?: string;
  initialsClassName?: string;
}) {
  if (props.logoUrl) {
    return <img src={props.logoUrl} alt={props.name} className={props.imageClassName ?? props.className} />;
  }
  return (
    <div className={props.className}>
      <span className={props.initialsClassName ?? "text-sm font-semibold text-[#1A162F]"}>
        {getWorkspaceInitials(props.name)}
      </span>
    </div>
  );
}

function WorkspaceSwitcher(props: {
  collapsed: boolean;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  loading: boolean;
  onBeforeOpen: () => void;
  onSwitchWorkspace: (workspaceId: string) => void;
  onOpenSettings: (workspaceId: string) => void;
  onOpenInvite: (workspaceId: string) => void;
  onOpenManage: (workspaceId: string) => void;
  onOpenPricing: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuLayout, setMenuLayout] = useState({ top: 0, left: 0, maxHeight: 520 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const computeMenuLayout = () => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const viewportPadding = 16;
    const width = 340;
    const desiredMaxHeight = 520;
    let left = rect.left;
    if (left + width + viewportPadding > window.innerWidth) {
      left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    } else {
      left = Math.max(viewportPadding, left);
    }
    const spaceBelow = window.innerHeight - (rect.bottom + 4) - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const shouldOpenUp = spaceBelow < 360 && spaceAbove > spaceBelow;
    if (shouldOpenUp) {
      const maxHeight = Math.max(280, Math.min(desiredMaxHeight, spaceAbove - 4));
      setMenuLayout({
        top: Math.max(viewportPadding, rect.top - 4 - maxHeight),
        left,
        maxHeight,
      });
      return;
    }
    const maxHeight = Math.max(280, Math.min(desiredMaxHeight, spaceBelow));
    setMenuLayout({
      top: rect.bottom + 4,
      left,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    computeMenuLayout();
    const onResize = () => computeMenuLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen]);

  const activeWorkspace =
    props.workspaces.find((workspace) => workspace.id === props.activeWorkspaceId) ??
    props.workspaces[0] ?? {
      id: "",
      name: "Workspace",
      logoUrl: null,
      role: "member",
      status: "ACTIVE",
      members: 0,
      plan: null,
      expired: false,
    };
  const showWorkspaceSkeleton = props.loading && props.workspaces.length === 0;
  const canManageSubscription = activeWorkspace.role?.toUpperCase() === "OWNER";

  const handleOpenSettings = () => {
    if (!activeWorkspace.id) {
      return;
    }
    setIsOpen(false);
    props.onOpenSettings(activeWorkspace.id);
  };

  const handleOpenInvite = () => {
    if (!activeWorkspace.id) {
      return;
    }
    setIsOpen(false);
    props.onOpenInvite(activeWorkspace.id);
  };

  const handleOpenManage = () => {
    if (!activeWorkspace.id) {
      return;
    }
    setIsOpen(false);
    props.onOpenPricing(activeWorkspace.id);
  };

  const showPlanCard = Boolean(activeWorkspace.expired || activeWorkspace.plan || activeWorkspace.badge);

  return (
    <div ref={menuRef} className={props.collapsed ? "relative mx-auto" : "relative"}>
      {props.collapsed ? (
        showWorkspaceSkeleton ? (
          <WorkspaceTriggerSkeleton collapsed />
        ) : (
          <button
            type="button"
            onClick={() => {
              props.onBeforeOpen();
              computeMenuLayout();
              setIsOpen((prev) => !prev);
            }}
            className={`[-webkit-app-region:no-drag] flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              isOpen
                ? "border-[#1A162F] bg-white shadow-md ring-1 ring-[#1A162F]"
                : "border-transparent bg-transparent text-gray-700 hover:border-gray-200 hover:bg-white"
            }`}
          >
            <WorkspaceAvatar
              name={activeWorkspace.name}
              logoUrl={activeWorkspace.logoUrl}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E5E7EB]"
              imageClassName="h-6 w-6 object-contain"
              initialsClassName="text-sm font-semibold text-[#1A162F]"
            />
          </button>
        )
      ) : (
        showWorkspaceSkeleton ? (
          <WorkspaceTriggerSkeleton collapsed={false} />
        ) : (
          <button
            type="button"
            onClick={() => {
              props.onBeforeOpen();
              computeMenuLayout();
              setIsOpen((prev) => !prev);
            }}
            className={`[-webkit-app-region:no-drag] group relative z-10 flex w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition-all ${
              isOpen
                ? "border-[#1A162F] bg-white shadow-md ring-1 ring-[#1A162F]"
                : "border-gray-200 bg-white shadow-sm hover:border-gray-300"
            }`}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-100 bg-gray-100 text-gray-700 transition-colors group-hover:border-gray-200">
              <WorkspaceAvatar
                name={activeWorkspace.name}
                logoUrl={activeWorkspace.logoUrl}
                className="flex h-full w-full items-center justify-center bg-[#E5E7EB]"
                imageClassName="h-full w-full object-contain p-0.5"
                initialsClassName="text-sm font-semibold text-[#1A162F]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-gray-900">{activeWorkspace.name}</div>
            </div>
            <CaretDownIcon className="h-3 w-3 text-gray-400 transition-colors group-hover:text-gray-600" />
          </button>
        )
      )}

      {isOpen
        ? createPortal(
            <div
              className="fixed z-[9999] flex w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-100"
              style={{ top: menuLayout.top, left: menuLayout.left, maxHeight: menuLayout.maxHeight }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="custom-scrollbar flex-1 overflow-y-auto">
                <div className="p-4 pb-2">
                  {showWorkspaceSkeleton ? (
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-5 w-32 rounded-md" />
                        <Skeleton className="h-4 w-20 rounded-md" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm">
                        <WorkspaceAvatar
                          name={activeWorkspace.name}
                          logoUrl={activeWorkspace.logoUrl}
                          className="flex h-full w-full items-center justify-center bg-[#E5E7EB]"
                          imageClassName="h-full w-full object-contain p-1"
                          initialsClassName="text-base font-semibold text-[#1A162F]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 truncate text-base leading-tight font-bold text-gray-900">{activeWorkspace.name}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          {activeWorkspace.members} member{activeWorkspace.members === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={handleOpenSettings}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!activeWorkspace.id}
                  >
                    <GearIcon className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInvite}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!activeWorkspace.id}
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    Invite members
                  </button>
                </div>

                {showPlanCard ? (
                  <div className="mx-4 mb-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {activeWorkspace.planDisplayText}
                      </span>
                      {activeWorkspace.badge ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {activeWorkspace.badge}
                        </span>
                      ) : null}
                    </div>
                    {canManageSubscription ? (
                      <button
                        type="button"
                        onClick={handleOpenManage}
                        className={`rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                          activeWorkspace.expired || activeWorkspace.planStatus === "canceled"
                            ? "border border-transparent bg-[#1A162F] text-white hover:bg-[#1A162F]/90"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        disabled={!activeWorkspace.id}
                      >
                        {activeWorkspace.buttonText}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mx-0 mb-2 h-px bg-gray-100" />
                <div className="px-4 py-2 text-xs font-medium text-gray-500">All workspaces</div>
                <div className="custom-scrollbar max-h-[200px] space-y-0.5 overflow-y-auto px-2 pb-2">
                  {props.loading && props.workspaces.length === 0 ? (
                    <>
                      <WorkspaceItemSkeleton />
                      <WorkspaceItemSkeleton />
                      <WorkspaceItemSkeleton />
                    </>
                  ) : (
                    props.workspaces.map((workspace) => {
                      const isActive = workspace.id === props.activeWorkspaceId;
                      return (
                        <div
                          key={workspace.id}
                          onClick={() => {
                            props.onSwitchWorkspace(workspace.id);
                            setIsOpen(false);
                          }}
                          className="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white text-gray-700">
                              <WorkspaceAvatar
                                name={workspace.name}
                                logoUrl={workspace.logoUrl}
                                className="flex h-full w-full items-center justify-center bg-[#E5E7EB]"
                                imageClassName="h-full w-full object-contain p-1"
                                initialsClassName="text-sm font-semibold text-[#1A162F]"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">{workspace.name}</div>
                            </div>
                            {workspace.expired ? (
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-600">
                                EXPIRED
                              </span>
                            ) : workspace.plan ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="rounded bg-[#1A162F] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                  {workspace.plan}
                                </span>
                                {workspace.badge ? (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                                    {workspace.badge}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          {isActive ? (
                            <CheckIcon className="ml-2 h-4 w-4 shrink-0 text-gray-900" />
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-auto border-t border-gray-100 bg-white p-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    props.onCreateWorkspace();
                  }}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-100 text-gray-400 transition-colors group-hover:border-gray-400 group-hover:text-gray-600">
                    <span className="text-base font-bold">+</span>
                  </div>
                  <span className="text-sm font-medium">Create new workspace</span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ClientAppSidebar(props: ClientAppSidebarProps) {
  const { checking, initialized } = useAppState();
  const { showGlobalLoading, hideGlobalLoading } = useGlobalLoader();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);
  const [recentTasks, setRecentTasks] = useState<SidebarTask[]>([]);
  const [sessionsByAgent, setSessionsByAgent] = useState<Record<string, SidebarSession[]>>({});
  const [runningTasks, setRunningTasks] = useState<Record<string, boolean>>({});
  const [tasksLoading, setTasksLoading] = useState(true);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [bustlyUserInfo, setBustlyUserInfo] = useState<BustlyUserInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [hasLoadedWorkspaces, setHasLoadedWorkspaces] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPreparingIssueReport, setIsPreparingIssueReport] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createAgentStep, setCreateAgentStep] = useState<"info" | "skills">("info");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [iconModalOpen, setIconModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [draftScenarioName, setDraftScenarioName] = useState("");
  const [draftScenarioDescription, setDraftScenarioDescription] = useState("");
  const [draftScenarioVibe, setDraftScenarioVibe] = useState<(typeof CREATE_AGENT_VIBES)[number]>("Professional");
  const [createSkillCatalog, setCreateSkillCatalog] = useState<SkillCatalogItem[]>([]);
  const [createSkillsLoading, setCreateSkillsLoading] = useState(false);
  const [createSkillsError, setCreateSkillsError] = useState<string | null>(null);
  const [selectedCreateSkills, setSelectedCreateSkills] = useState<string[]>([]);
  const [hasSeededCreateSkills, setHasSeededCreateSkills] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_AGENT_AVATAR);
  const [iconPickerMode, setIconPickerMode] = useState<"create" | "edit">("edit");
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const workspaceLoadingRef = useRef(false);
  const hasLoadedWorkspacesRef = useRef(false);
  const [userMenuLayout, setUserMenuLayout] = useState({ top: 0, left: 0, width: 224 });
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsPage = false;
  const isSkillPage = location.pathname === "/skill";
  const effectiveWorkspaceId = activeWorkspaceId || bustlyUserInfo?.workspaceId || "";
  const defaultWorkspaceAgentId = useMemo(
    () => buildBustlyWorkspaceAgentId(effectiveWorkspaceId),
    [effectiveWorkspaceId],
  );
  const activeSessionKey = useMemo(() => {
    if (isSkillPage) {
      return "";
    }
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("session")?.trim() || "";
  }, [isSkillPage, location.search]);
  const activeAgentId = useMemo(() => {
    if (isSkillPage) {
      return "";
    }
    const searchParams = new URLSearchParams(location.search);
    return (
      searchParams.get("agent")?.trim() ||
      resolveAgentIdFromSessionKey(activeSessionKey) ||
      defaultWorkspaceAgentId
    );
  }, [activeSessionKey, defaultWorkspaceAgentId, isSkillPage, location.search]);
  const activeTaskId = useMemo(
    () => recentTasks.find((task) => task.agentId === activeAgentId)?.id ?? activeAgentId,
    [activeAgentId, recentTasks],
  );
  const overviewTask = useMemo(
    () => recentTasks.find((task) => task.isMain) ?? null,
    [recentTasks],
  );
  const visibleAgentTasks = useMemo(
    () => recentTasks.filter((task) => !task.isMain),
    [recentTasks],
  );
  const isOverviewActive = !isSkillPage && activeAgentId === defaultWorkspaceAgentId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  const computeUserMenuLayout = useCallback(() => {
    const rect = userMenuTriggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const viewportPadding = 12;
    const width = props.collapsed ? 224 : Math.max(224, rect.width);
    let left = Math.max(viewportPadding, rect.left);
    if (left + width + viewportPadding > window.innerWidth) {
      left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    }
    const estimatedHeight = 132;
    const top = Math.max(viewportPadding, rect.top - 8 - estimatedHeight);
    setUserMenuLayout({ top, left, width });
  }, [props.collapsed]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }
    computeUserMenuLayout();
    const onResize = () => computeUserMenuLayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeUserMenuLayout, isUserMenuOpen]);

  useEffect(() => {
    let disposed = false;

    void window.electronAPI.getNativeFullscreenStatus().then((state) => {
      if (!disposed) {
        setIsWindowFullscreen(state.isNativeFullscreen === true);
      }
    });

    const unsubscribe = window.electronAPI.onNativeFullscreenChange((state) => {
      setIsWindowFullscreen(state.isNativeFullscreen === true);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    workspaceLoadingRef.current = workspaceLoading;
  }, [workspaceLoading]);

  useEffect(() => {
    hasLoadedWorkspacesRef.current = hasLoadedWorkspaces;
  }, [hasLoadedWorkspaces]);

  const loadWorkspaces = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      const force = options?.force === true;
      const silent = options?.silent === true;
      if (workspaceLoadingRef.current) {
        return;
      }
      if (hasLoadedWorkspacesRef.current && !force) {
        return;
      }
      const shouldShowLoading = !silent && !hasLoadedWorkspacesRef.current;
      if (shouldShowLoading) {
        workspaceLoadingRef.current = true;
        setWorkspaceLoading(true);
      }
      try {
        const result = await listWorkspaceSummaries({ force });
        setWorkspaces(result.workspaces);
        setActiveWorkspaceId(result.activeWorkspaceId);
        hasLoadedWorkspacesRef.current = true;
        setHasLoadedWorkspaces(true);
      } catch {
        if (!hasLoadedWorkspacesRef.current) {
          setWorkspaces([]);
          setActiveWorkspaceId("");
        }
      } finally {
        if (shouldShowLoading) {
          workspaceLoadingRef.current = false;
          setWorkspaceLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = window.electronAPI.onBustlyLoginRefresh(() => {
      void loadWorkspaces({ force: true, silent: hasLoadedWorkspacesRef.current });
    });
    return () => {
      unsubscribe();
    };
  }, [loadWorkspaces]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    const handleRunStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionKey?: string; running?: boolean }>).detail;
      const sessionKey = typeof detail?.sessionKey === "string" ? detail.sessionKey.trim() : "";
      if (!sessionKey) {
        return;
      }
      setRunningTasks((prev) => {
        const nextRunning = detail?.running === true;
        if ((prev[sessionKey] ?? false) === nextRunning) {
          return prev;
        }
        if (!nextRunning) {
          const next = { ...prev };
          delete next[sessionKey];
          return next;
        }
        return { ...prev, [sessionKey]: true };
      });
    };

    window.addEventListener(SIDEBAR_TASK_RUN_STATE_EVENT, handleRunStateChange as EventListener);
    return () => {
      window.removeEventListener(SIDEBAR_TASK_RUN_STATE_EVENT, handleRunStateChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (checking || !initialized || !effectiveWorkspaceId) {
      return;
    }

    let disposed = false;

    const loadTasks = async () => {
      if (!disposed) {
        setTasksLoading(!hasLoadedTasks);
      }
      try {
        const agents = await window.electronAPI.bustlyListAgents(effectiveWorkspaceId);
        if (disposed) {
          return;
        }
        const sortedAgents = sortSidebarAgents(agents, { pendingAgentId });
        const sessionRows = await Promise.all(
          sortedAgents.map(async (agent) => {
            const sessions = await window.electronAPI.bustlyListAgentSessions(effectiveWorkspaceId, agent.agentId);
            return [
              agent.agentId,
              sortSidebarSessions(
                sessions.map((session) => ({
                  id: session.sessionKey,
                  agentId: session.agentId,
                  name: session.name,
                  icon: session.icon,
                  updatedAt: session.updatedAt,
                  running: runningTasks[session.sessionKey] === true,
                })),
              ),
            ] as const;
          }),
        );
        if (disposed) {
          return;
        }
        setRecentTasks(
          sortedAgents.map((agent) => ({
            id: agent.agentId,
            agentId: agent.agentId,
            name: agent.name,
            icon: agent.icon,
            skills: agent.skills,
            isMain: agent.isMain,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
          })),
        );
        setSessionsByAgent(Object.fromEntries(sessionRows));
        setHasLoadedTasks(true);
        setTasksLoading(false);
      } catch {
        if (!disposed) {
          if (!hasLoadedTasks) {
            setRecentTasks([]);
            setSessionsByAgent({});
          }
          setTasksLoading(false);
        }
      }
    };

    void loadTasks();

    const handleRefreshTasks = () => {
      void loadTasks();
    };
    window.addEventListener(SIDEBAR_TASKS_REFRESH_EVENT, handleRefreshTasks);

    return () => {
      disposed = true;
      window.removeEventListener(SIDEBAR_TASKS_REFRESH_EVENT, handleRefreshTasks);
    };
  }, [
    checking,
    effectiveWorkspaceId,
    hasLoadedTasks,
    initialized,
    location.pathname,
    location.search,
    pendingAgentId,
    runningTasks,
  ]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onBustlySessionLabelUpdated((payload) => {
      setSessionsByAgent((prev) => {
        const agentSessions = prev[payload.agentId];
        if (!agentSessions || agentSessions.length === 0) {
          return prev;
        }
        let changed = false;
        const nextSessions = sortSidebarSessions(
          agentSessions.map((session) => {
            if (session.id !== payload.sessionKey) {
              return session;
            }
            changed = true;
            return {
              ...session,
              name: payload.label,
              updatedAt: payload.updatedAt ?? session.updatedAt,
            };
          }),
        );
        if (!changed) {
          return prev;
        }
        return {
          ...prev,
          [payload.agentId]: nextSessions,
        };
      });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== "/chat") {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    const fallbackTask = recentTasks[0];
    if (!fallbackTask) {
      return;
    }
    const activeAgentKey = searchParams.get("agent")?.trim();
    if (activeAgentKey && pendingAgentId === activeAgentKey) {
      return;
    }
    if (activeAgentKey && recentTasks.some((task) => task.agentId === activeAgentKey)) {
      return;
    }
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("agent", fallbackTask.agentId);
    if (fallbackTask.name?.trim()) {
      nextSearchParams.set("label", fallbackTask.name.trim());
    }
    nextSearchParams.set(
      "icon",
      resolveAgentPresentation({
        workspaceId: effectiveWorkspaceId,
        agentId: fallbackTask.agentId,
        name: fallbackTask.name,
        icon: fallbackTask.icon,
      }).iconId,
    );
    const prompt = searchParams.get("prompt")?.trim();
    if (prompt) {
      nextSearchParams.set("prompt", prompt);
    }
    const contextPath = searchParams.get("contextPath")?.trim();
    const contextName = searchParams.get("contextName")?.trim();
    const contextKind = searchParams.get("contextKind")?.trim();
    if (contextPath) {
      nextSearchParams.set("contextPath", contextPath);
    }
    if (contextName) {
      nextSearchParams.set("contextName", contextName);
    }
    if (contextKind) {
      nextSearchParams.set("contextKind", contextKind);
    }
    void navigate(`/chat?${nextSearchParams.toString()}`, {
      replace: true,
    });
  }, [effectiveWorkspaceId, location.pathname, location.search, navigate, pendingAgentId, recentTasks]);

  useEffect(() => {
    if (!pendingAgentId) {
      return;
    }
    if (recentTasks.some((task) => task.agentId === pendingAgentId)) {
      setPendingAgentId(null);
    }
  }, [pendingAgentId, recentTasks]);

  useEffect(() => {
    setExpandedAgents((prev) => {
      const next: Record<string, boolean> = {};
      for (const task of visibleAgentTasks) {
        next[task.agentId] = prev[task.agentId] !== false;
      }
      return next;
    });
  }, [visibleAgentTasks]);

  useEffect(() => {
    let disposed = false;

    const loadBustlyUserInfo = async () => {
      try {
        const loggedIn = await window.electronAPI.bustlyIsLoggedIn();
        if (!loggedIn) {
          if (!disposed) {
            setBustlyUserInfo(null);
          }
          return;
        }
        const userInfo = await window.electronAPI.bustlyGetUserInfo();
        if (!disposed) {
          setBustlyUserInfo(userInfo);
        }
      } catch {
        if (!disposed) {
          setBustlyUserInfo(null);
        }
      }
    };

    void loadBustlyUserInfo();
    const unsubscribe = window.electronAPI.onBustlyLoginRefresh(() => {
      void loadBustlyUserInfo();
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const userName = bustlyUserInfo?.userName?.trim() || "User";
  const userEmail = bustlyUserInfo?.userEmail?.trim() || "user@example.com";
  const avatarSeed = bustlyUserInfo?.userEmail?.trim() || bustlyUserInfo?.userName?.trim() || "User";
  const avatarUrl =
    bustlyUserInfo?.userAvatarUrl?.trim()
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarSeed)}&background=1A162F&color=fff`;

  const handleOpenSettings = async () => {
    setIsUserMenuOpen(false);
    await window.electronAPI.bustlyOpenSettings();
  };

  const handleReportIssue = async () => {
    if (isPreparingIssueReport) {
      return;
    }
    setIsPreparingIssueReport(true);
    try {
      const result = await window.electronAPI.bustlyReportIssue();
      if (!result.success) {
        console.error("[Bustly Report Issue] Failed:", result.error);
      }
    } finally {
      setIsPreparingIssueReport(false);
      setIsUserMenuOpen(false);
    }
  };

  const handleOpenWorkspaceSettings = (workspaceId: string) => {
    void window.electronAPI.bustlyOpenWorkspaceSettings(workspaceId);
  };

  const handleOpenWorkspaceInvite = (workspaceId: string) => {
    void window.electronAPI.bustlyOpenWorkspaceInvite(workspaceId);
  };

  const handleOpenWorkspaceManage = (workspaceId: string) => {
    void window.electronAPI.bustlyOpenWorkspaceManage(workspaceId);
  };

  const handleOpenWorkspacePricing = (workspaceId: string) => {
    void window.electronAPI.bustlyOpenWorkspacePricing(workspaceId);
  };

  const handleCreateWorkspace = () => {
    void window.electronAPI.bustlyOpenWorkspaceCreate(effectiveWorkspaceId || undefined);
  };

  const resolveAgentRouteIcon = useCallback((task: SidebarTask) => {
    return resolveAgentPresentation({
      workspaceId: effectiveWorkspaceId,
      agentId: task.agentId,
      name: task.name,
      icon: task.icon,
    }).iconId;
  }, [effectiveWorkspaceId]);

  const toggleAgentExpand = useCallback((agentId: string) => {
    setExpandedAgents((prev) => ({
      ...prev,
      [agentId]: prev[agentId] === false,
    }));
  }, []);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) {
      return;
    }
    const workspace = workspaces.find((entry) => entry.id === workspaceId);
    showGlobalLoading(`Loading ${workspace?.name?.trim() || "workspace"}...`, "workspace-switch", "loading", 10);
    try {
      const result = await window.electronAPI.bustlySetActiveWorkspace(workspaceId, workspace?.name);
      if (!result.success) {
        hideGlobalLoading("workspace-switch");
        return;
      }
      setActiveWorkspaceId(workspaceId);
      void navigate("/chat", { replace: true });
      notifySidebarTasksRefresh();
    } catch {
      hideGlobalLoading("workspace-switch");
    }
  };

  const handleSignOut = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      const result = await window.electronAPI.bustlyLogout();
      if (!result.success) {
        return;
      }
      setBustlyUserInfo(null);
      setIsUserMenuOpen(false);
      const openResult = await window.electronAPI.bustlyOpenLogin();
      if (!openResult.success) {
        void navigate("/bustly-login", { replace: true });
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const selectedTask = recentTasks.find((entry) => entry.id === selectedTaskId) ?? null;
  const resetCreateModalState = useCallback(() => {
    setCreateAgentStep("info");
    setDraftScenarioName("");
    setDraftScenarioDescription("");
    setDraftScenarioVibe("Professional");
    setSelectedIcon(DEFAULT_AGENT_AVATAR);
    setCreateError(null);
    setCreateSkillCatalog([]);
    setCreateSkillsLoading(false);
    setCreateSkillsError(null);
    setSelectedCreateSkills([]);
    setHasSeededCreateSkills(false);
  }, []);

  const openCreateModal = () => {
    resetCreateModalState();
    setIconPickerMode("create");
    setCreateModalOpen(true);
  };

  const openRenameModal = (task: SidebarTask) => {
    setSelectedTaskId(task.id);
    setDraftScenarioName(task.name);
    setRenameError(null);
    setRenameModalOpen(true);
  };

  const toggleCreateSkill = useCallback((skillName: string) => {
    setHasSeededCreateSkills(true);
    setSelectedCreateSkills((current) => (
      current.includes(skillName)
        ? current.filter((entry) => entry !== skillName)
        : [...current, skillName].toSorted((left, right) =>
            left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }),
          )
    ));
  }, []);

  useEffect(() => {
    if (!createModalOpen || !effectiveWorkspaceId) {
      return;
    }
    let disposed = false;
    setCreateSkillsLoading(true);
    setCreateSkillsError(null);
    void fetchSkillCatalog({
      scope: `create-agent-${effectiveWorkspaceId}`,
    }).then((items) => {
      if (disposed) {
        return;
      }
      setCreateSkillCatalog(items);
    }).catch((error) => {
      if (disposed) {
        return;
      }
      setCreateSkillCatalog([]);
      setCreateSkillsError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!disposed) {
        setCreateSkillsLoading(false);
      }
    });
    return () => {
      disposed = true;
    };
  }, [createModalOpen, effectiveWorkspaceId]);

  useEffect(() => {
    if (
      !createModalOpen ||
      createAgentStep !== "skills" ||
      hasSeededCreateSkills ||
      createSkillsLoading ||
      createSkillCatalog.length === 0
    ) {
      return;
    }
    setSelectedCreateSkills(recommendSkillNames(createSkillCatalog, {
      roleText: draftScenarioDescription,
      vibe: draftScenarioVibe,
      limit: 4,
    }));
    setHasSeededCreateSkills(true);
  }, [
    createAgentStep,
    createModalOpen,
    createSkillCatalog,
    createSkillsLoading,
    draftScenarioDescription,
    draftScenarioVibe,
    hasSeededCreateSkills,
  ]);

  const openIconModal = (task?: SidebarTask) => {
    if (task) {
      setSelectedTaskId(task.id);
      setSelectedIcon(
        normalizeAgentAvatarName(task.icon) ||
          resolveAgentPresentation({
            workspaceId: effectiveWorkspaceId,
            agentId: task.agentId,
            name: task.name,
            icon: task.icon,
          }).avatarName ||
          DEFAULT_AGENT_AVATAR,
      );
      setIconPickerMode("edit");
    } else {
      setSelectedTaskId(null);
      setSelectedIcon(DEFAULT_AGENT_AVATAR);
      setIconPickerMode("create");
    }
    setIconModalOpen(true);
  };

  const handleCreateScenario = async () => {
    const name = draftScenarioName.trim();
    if (!name || createSaving || !effectiveWorkspaceId) {
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const workspace = workspaces.find((entry) => entry.id === effectiveWorkspaceId);
      const result = await window.electronAPI.bustlyCreateAgent({
        workspaceId: effectiveWorkspaceId,
        name,
        description: draftScenarioDescription.trim(),
        icon: selectedIcon,
        workspaceName: workspace?.name,
        skills:
          createSkillCatalog.length === 0
            ? undefined
            : selectedCreateSkills.length === createSkillCatalog.length
              ? null
              : selectedCreateSkills,
      });
      if (!result.success) {
        setCreateError(result.error ?? "Failed to create agent.");
        return;
      }
      const nextAgentId = result.agentId ?? buildBustlyWorkspaceAgentId(effectiveWorkspaceId, name);
      setPendingAgentId(nextAgentId);
      setHasLoadedTasks(true);
      setRecentTasks((prev) => {
        const nextTask: SidebarTask = {
          id: nextAgentId,
          agentId: nextAgentId,
          name,
          icon: selectedIcon,
          isMain: false,
        };
        const remainingTasks = prev.filter((entry) => entry.id !== nextAgentId);
        const mainTask = remainingTasks.find((entry) => entry.isMain) ?? null;
        const otherTasks = remainingTasks.filter((entry) => !entry.isMain);
        return mainTask ? [mainTask, nextTask, ...otherTasks] : [nextTask, ...otherTasks];
      });
      setSessionsByAgent((prev) => ({ ...prev, [nextAgentId]: [] }));
      resetCreateModalState();
      setCreateModalOpen(false);
      notifySidebarTasksRefresh();
      void navigate(buildChatRoute({ agentId: nextAgentId, label: name, icon: selectedIcon }));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreateSaving(false);
    }
  };

  const handleRenameScenario = async () => {
    if (!selectedTaskId) {
      return;
    }
    const selectedTask = recentTasks.find((entry) => entry.id === selectedTaskId);
    if (!selectedTask || !effectiveWorkspaceId) {
      return;
    }
    const name = draftScenarioName.trim();
    if (!name || renameSaving) {
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const result = await window.electronAPI.bustlyUpdateAgent({
        workspaceId: effectiveWorkspaceId,
        agentId: selectedTask.agentId,
        name,
      });
      if (!result.success) {
        setRenameError(result.error ?? "Failed to save agent name.");
        return;
      }
      setRecentTasks((prev) => prev.map((entry) => (entry.id === selectedTaskId ? { ...entry, name } : entry)));
      setRenameModalOpen(false);
      setSelectedTaskId(null);
      setDraftScenarioName("");
      if (selectedTask.agentId === activeAgentId) {
        void navigate(
          buildChatRoute({
            agentId: selectedTask.agentId,
            sessionKey: activeSessionKey || undefined,
            label: name,
            icon: resolveAgentRouteIcon({ ...selectedTask, name }),
          }),
          { replace: true },
        );
      }
      notifySidebarTasksRefresh();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : String(error));
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDeleteScenario = async () => {
    if (!selectedTask || selectedTask.isMain || !effectiveWorkspaceId) {
      setDeleteModalOpen(false);
      setSelectedTaskId(null);
      return;
    }
    try {
      const result = await window.electronAPI.bustlyDeleteAgent({
        workspaceId: effectiveWorkspaceId,
        agentId: selectedTask.agentId,
      });
      if (!result.success) {
        setDeleteModalOpen(false);
        return;
      }
      setRecentTasks((prev) => prev.filter((entry) => entry.id !== selectedTask.id));
      setSessionsByAgent((prev) => {
        const next = { ...prev };
        delete next[selectedTask.agentId];
        return next;
      });
      setDeleteModalOpen(false);
      setSelectedTaskId(null);
      if (selectedTask.agentId === activeAgentId) {
        void navigate("/chat", { replace: true });
      }
      notifySidebarTasksRefresh();
    } catch {
      setDeleteModalOpen(false);
      setSelectedTaskId(null);
    }
  };

  const handleSelectIcon = async (icon: string) => {
    if (iconPickerMode === "create") {
      setSelectedIcon(icon);
      setIconModalOpen(false);
      return;
    }
    if (!selectedTaskId) {
      return;
    }
    const selectedTask = recentTasks.find((entry) => entry.id === selectedTaskId);
    if (!selectedTask || !effectiveWorkspaceId) {
      return;
    }
    const result = await window.electronAPI.bustlyUpdateAgent({
      workspaceId: effectiveWorkspaceId,
      agentId: selectedTask.agentId,
      icon,
    });
    if (!result.success) {
      return;
    }
    setRecentTasks((prev) => prev.map((entry) => (entry.id === selectedTaskId ? { ...entry, icon } : entry)));
    setIconModalOpen(false);
    setSelectedTaskId(null);
    if (selectedTask.agentId === activeAgentId) {
      void navigate(
        buildChatRoute({
          agentId: selectedTask.agentId,
          sessionKey: activeSessionKey || undefined,
          label: selectedTask.name,
          icon: resolveAgentRouteIcon({ ...selectedTask, icon }),
        }),
        { replace: true },
      );
    }
    notifySidebarTasksRefresh();
  };

  return (
    <div
      className={`[-webkit-app-region:drag] z-[100] flex h-full flex-col border-r border-[#E5E7EB] bg-[#F4F5F8] transition-all duration-300 ${
        props.collapsed ? "w-20" : "w-64 overflow-x-hidden"
      } ${isWindowFullscreen ? "pt-0" : "pt-[20px]"}`}
    >
      <div
        className={`group relative flex transition-all duration-300 ${
          props.collapsed ? "flex-col items-center gap-4 pt-4 pb-2" : "flex-col gap-2 px-4 pt-4 pb-0"
        }`}
      >
        {isSettingsPage ? null : (
          <>
            {!props.collapsed ? (
              <div className="flex w-full items-center justify-between">
                <img src={bustlyWordmark} alt="Bustly" className="h-10 w-auto object-contain" />
                <PortalTooltip content="Collapse Sidebar" side="bottom">
                  <button
                    type="button"
                    onClick={props.onToggleCollapsed}
                    className="[-webkit-app-region:no-drag] rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-gray-100"
                  >
                    <img src={openSidebarIcon} alt="Collapse sidebar" className="h-[18px] w-[18px] shrink-0" />
                  </button>
                </PortalTooltip>
              </div>
            ) : null}
            <div className={`transition-all duration-300 ${props.collapsed ? "flex w-full flex-col items-center gap-2" : "w-full"}`}>
              {props.collapsed ? (
                <PortalTooltip content="Expand Sidebar" side="right">
                  <button
                    type="button"
                    onClick={props.onToggleCollapsed}
                    className="[-webkit-app-region:no-drag] group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                  >
                    <img src={logoIcon} alt="Bustly" className="absolute h-8 w-8 transition-opacity duration-200 group-hover:opacity-0" />
                    <img
                      src={openSidebarIcon}
                      alt="Expand sidebar"
                      className="absolute h-[18px] w-[18px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                  </button>
                </PortalTooltip>
              ) : null}
              <WorkspaceSwitcher
                collapsed={props.collapsed}
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId || bustlyUserInfo?.workspaceId || ""}
                loading={workspaceLoading}
                onBeforeOpen={() => {
                  void loadWorkspaces({ silent: true });
                }}
                onSwitchWorkspace={handleSwitchWorkspace}
                onOpenSettings={handleOpenWorkspaceSettings}
                onOpenInvite={handleOpenWorkspaceInvite}
                onOpenManage={handleOpenWorkspaceManage}
                onOpenPricing={handleOpenWorkspacePricing}
                onCreateWorkspace={handleCreateWorkspace}
              />
            </div>
          </>
        )}
      </div>

      <div
        className={`[-webkit-app-region:no-drag] custom-scrollbar flex flex-1 flex-col ${
          props.collapsed ? "items-center overflow-visible" : "overflow-y-auto overflow-x-hidden"
        }`}
      >
        {!props.collapsed ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-0.5 px-0 pt-2 pb-2">
              <SidebarItem
                icon={SquaresFour}
                label="Overview"
                active={isOverviewActive}
                onClick={() => {
                  const target = overviewTask ?? recentTasks[0];
                  if (!target) {
                    return;
                  }
                  void navigate(
                    buildChatRoute({
                      agentId: target.agentId,
                      label: target.name,
                      icon: resolveAgentRouteIcon(target),
                    }),
                  );
                }}
                collapsed={false}
              />
              <SidebarItem
                icon={LightningIcon}
                label="Skills"
                active={isSkillPage}
                onClick={() => {
                  void navigate({
                    pathname: "/skill",
                    search: location.search,
                  });
                }}
                collapsed={false}
              />
            </div>

            <div
              className="custom-scrollbar flex-1 overflow-y-auto pb-4"
              style={{ scrollbarGutter: "stable" }}
            >
              <div className="sticky top-0 z-10 bg-[#F4F5F8] px-3 pb-1.5">
                <div className="group flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-1 text-[11px] font-normal text-[#8A93B2]">
                    My agents
                  </div>
                  <PortalTooltip content="Create agent" side="right" className="shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreateModal();
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded-md text-[#8A93B2] opacity-0 transition-all duration-200 hover:bg-[#1A162F]/10 hover:text-[#1A162F] group-hover:opacity-100"
                      aria-label="Create agent"
                    >
                      <Plus size={12} weight="bold" />
                    </button>
                  </PortalTooltip>
                </div>
              </div>

              <div className="space-y-0.5">
                {tasksLoading ? (
                  <>
                    <TaskItemSkeleton />
                    <TaskItemSkeleton />
                    <TaskItemSkeleton />
                  </>
                ) : (
                  visibleAgentTasks.map((task) => {
                    const childSessions = sessionsByAgent[task.agentId] ?? [];
                    const showChildSessions = childSessions.length > 0 && expandedAgents[task.agentId] !== false;
                    return (
                      <div key={task.id} className="flex flex-col gap-0.5">
                        <AgentFolderItem
                          agent={task}
                          workspaceId={effectiveWorkspaceId}
                          active={!activeSessionKey && activeTaskId === task.id}
                          hasSessions={childSessions.length > 0}
                          expanded={expandedAgents[task.agentId] !== false}
                          collapsed={false}
                          onToggleExpand={() => toggleAgentExpand(task.agentId)}
                          onOpenAgent={() => {
                            void navigate(
                              buildChatRoute({
                                agentId: task.agentId,
                                label: task.name,
                                icon: resolveAgentRouteIcon(task),
                              }),
                            );
                          }}
                          onRename={() => {
                            openRenameModal(task);
                          }}
                          onDelete={() => {
                            setSelectedTaskId(task.id);
                            setDeleteModalOpen(true);
                          }}
                          onChangeIcon={() => {
                            openIconModal(task);
                          }}
                        />

                        <div
                          className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{
                            gridTemplateRows: showChildSessions ? "1fr" : "0fr",
                            opacity: showChildSessions ? 1 : 0.72,
                          }}
                        >
                          <div className="overflow-hidden">
                            <div
                              className={`relative mb-1 flex flex-col gap-0.5 before:absolute before:top-0 before:bottom-3 before:left-[30px] before:w-px before:bg-gray-200/60 before:content-[''] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                showChildSessions ? "translate-y-0" : "-translate-y-1"
                              }`}
                            >
                              {childSessions.map((session) => (
                                <AgentChildItem
                                  key={session.id}
                                  label={session.name}
                                  active={activeSessionKey === session.id}
                                  running={session.running}
                                  onClick={() => {
                                    void navigate(
                                      buildChatRoute({
                                        agentId: task.agentId,
                                        sessionKey: session.id,
                                        label: session.name,
                                        icon: session.icon ?? resolveAgentRouteIcon(task),
                                      }),
                                    );
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center pt-4 gap-4">
            <div className="flex w-full flex-1 flex-col items-center gap-3">
              {recentTasks.length > 0 ? (
                <CollapsedScenariosButton
                  tasks={recentTasks}
                  workspaceId={effectiveWorkspaceId}
                  activeTaskId={activeTaskId}
                  onOpenTask={(task) => {
                    void navigate(buildChatRoute({ agentId: task.agentId, label: task.name, icon: resolveAgentRouteIcon(task) }));
                  }}
                  onRenameClick={openRenameModal}
                  onDeleteClick={(task) => {
                    setSelectedTaskId(task.id);
                    setDeleteModalOpen(true);
                  }}
                  onChangeIcon={(task) => {
                    openIconModal(task);
                  }}
                />
              ) : null}
              <PortalTooltip content="Create agent" side="right" className="w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    openCreateModal();
                  }}
                  className="group flex h-10 w-10 items-center justify-center rounded-xl text-text-sub transition-all hover:bg-[#1A162F]/5 hover:text-text-main"
                  aria-label="Create agent"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-gray-50 transition-colors group-hover:border-[#1A162F]/10 group-hover:bg-white">
                    <Plus size={18} weight="bold" />
                  </div>
                </button>
              </PortalTooltip>
            </div>

            <div className="w-full space-y-2 border-t border-[#E5E7EB] px-2 pt-4">
              <SidebarItem
                icon={LightningIcon}
                label="Skills"
                active={isSkillPage}
                onClick={() => {
                  void navigate({
                    pathname: "/skill",
                    search: location.search,
                  });
                }}
                collapsed
                showTooltip
              />
            </div>
          </div>
        )}
      </div>

      {!isSettingsPage ? (
        <div className={`[-webkit-app-region:no-drag] shrink-0 ${props.collapsed ? "px-2 pb-2" : "px-4 pb-2"}`}>
          <UpdatePrompt />
        </div>
      ) : null}

      <div
        ref={userMenuRef}
        className={`[-webkit-app-region:no-drag] relative z-20 mt-auto shrink-0 border-t border-gray-100/50 py-3 ${
          props.collapsed ? "flex flex-col items-center px-2" : "px-4"
        }`}
      >
        {isUserMenuOpen
          ? createPortal(
              <div
                className="fixed z-[9999]"
                style={{ top: userMenuLayout.top, left: userMenuLayout.left, width: userMenuLayout.width }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="space-y-0.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                  <button
                    type="button"
                    onClick={() => {
                      void handleOpenSettings();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <GearIcon className="h-4 w-4 text-gray-500" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleReportIssue();
                    }}
                    disabled={isPreparingIssueReport}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreparingIssueReport ? (
                      <SpinnerIcon className="h-4 w-4 animate-spin text-gray-500" />
                    ) : (
                      <ReportIssueIcon className="h-4 w-4 text-gray-500" />
                    )}
                    {isPreparingIssueReport ? "Preparing report..." : "Report an issue"}
                  </button>
                  <div className="mx-2 my-1 h-px bg-gray-100" />
                  <button
                    type="button"
                    onClick={() => {
                      void handleSignOut();
                    }}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SignOutIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">Sign out</span>
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}

        <div
          ref={userMenuTriggerRef}
          className={`relative cursor-pointer rounded-xl p-1.5 outline-none transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-[#1A162F]/20 ${
            isUserMenuOpen ? "bg-gray-200" : ""
          } ${props.collapsed ? "flex justify-center" : "flex items-center gap-3"}`}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            computeUserMenuLayout();
            setIsUserMenuOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              computeUserMenuLayout();
              setIsUserMenuOpen((prev) => !prev);
            }
          }}
        >
          <img
            src={avatarUrl}
            alt="Profile"
            className="h-8 w-8 rounded-full border border-gray-200 bg-white"
          />
          {!props.collapsed ? (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          ) : null}
        </div>
      </div>

      <SidebarModal
        open={createModalOpen}
        title="Create Agent"
        widthClassName="max-w-3xl"
        panelClassName="flex h-[calc(100vh-80px)] max-h-[860px] flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        flush
        onClose={() => {
          resetCreateModalState();
          setCreateModalOpen(false);
        }}
      >
        {createAgentStep === "info" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setCreateError(null);
              setHasSeededCreateSkills(false);
              setSelectedCreateSkills([]);
              setCreateAgentStep("skills");
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 px-6 pb-6 pt-6">
              <h2 className="text-[22px] font-bold text-[#1A162F]">Hire a Digital Employee</h2>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#1A162F]">Agent name</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openIconModal()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E8EBF3] bg-[#F4F5F8] text-[#1A162F] transition-transform hover:scale-[1.02]"
                      aria-label="Choose avatar"
                      title="Choose avatar"
                    >
                      {getAgentAvatarSrc(selectedIcon) ? (
                        <img
                          src={getAgentAvatarSrc(selectedIcon) ?? undefined}
                          alt="avatar"
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        createElement(getSessionIconComponent(selectedIcon), { size: 20, weight: "bold" })
                      )}
                    </button>
                    <input
                      autoFocus
                      type="text"
                      value={draftScenarioName}
                      onChange={(event) => setDraftScenarioName(event.target.value)}
                      placeholder="e.g. Supplier finder"
                      className="flex-1 rounded-xl border border-[#E8EBF3] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1A162F] placeholder:font-normal placeholder:text-[#8A93B2] focus:border-[#1A162F] focus:outline-none focus:ring-1 focus:ring-[#1A162F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#1A162F]">Role & Responsibilities</label>
                  <textarea
                    rows={5}
                    value={draftScenarioDescription}
                    onChange={(event) => setDraftScenarioDescription(event.target.value)}
                    placeholder="Describe what this digital employee is hired to do..."
                    className="min-h-[120px] w-full resize-none rounded-xl border border-[#E8EBF3] bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-[#1A162F] placeholder:font-normal placeholder:text-[#8A93B2] focus:border-[#1A162F] focus:outline-none focus:ring-1 focus:ring-[#1A162F]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#1A162F]">Work style & Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {CREATE_AGENT_VIBES.map((vibe) => (
                      <button
                        key={vibe}
                        type="button"
                        onClick={() => setDraftScenarioVibe(vibe)}
                        className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all ${
                          draftScenarioVibe === vibe
                            ? "border-[#1A162F] bg-[#1A162F] text-white"
                            : "border-[#E8EBF3] bg-white text-[#666F8D] hover:border-[#C8D0E2] hover:text-[#1A162F]"
                        }`}
                      >
                        {vibe}
                      </button>
                    ))}
                  </div>
                </div>

                {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E8EBF3] bg-white px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="h-10 rounded-xl px-4 py-2 text-[13px] font-medium text-[#666F8D] transition-colors hover:bg-[#F4F5F8]"
                  disabled={createSaving}
                  onClick={() => {
                    resetCreateModalState();
                    setCreateModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-[#1A162F] px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#27223F] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!draftScenarioName.trim() || !draftScenarioDescription.trim()}
                >
                  Next step
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-6 pb-6 pt-6">
              <h2 className="text-[22px] font-bold text-[#1A162F]">Assign Skills</h2>
            </div>
            <CreateAgentSkillsStep
              items={createSkillCatalog}
              loading={createSkillsLoading}
              error={createError ?? createSkillsError}
              selectedSkillNames={selectedCreateSkills}
              recommendedSkillNames={recommendSkillNames(createSkillCatalog, {
                roleText: draftScenarioDescription,
                vibe: draftScenarioVibe,
                limit: 4,
              })}
              saving={createSaving}
              onToggleSkill={toggleCreateSkill}
              onBack={() => setCreateAgentStep("info")}
              onCreate={() => {
                void handleCreateScenario();
              }}
            />
          </div>
        )}
      </SidebarModal>

      <SidebarModal
        open={renameModalOpen}
        title="Rename agent"
        onClose={() => {
          setRenameModalOpen(false);
          setSelectedTaskId(null);
          setDraftScenarioName("");
          setRenameError(null);
        }}
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A162F]">Agent name</label>
            <input
              autoFocus
              type="text"
              value={draftScenarioName}
              onChange={(event) => setDraftScenarioName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRenameScenario();
                }
                if (event.key === "Escape") {
                  setRenameModalOpen(false);
                  setSelectedTaskId(null);
                  setDraftScenarioName("");
                  setRenameError(null);
                }
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-normal transition-all focus:border-[#1A162F] focus:outline-none focus:ring-2 focus:ring-[#1A162F]/5"
            />
          </div>
          {renameError ? <p className="text-sm text-red-600">{renameError}</p> : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              disabled={renameSaving}
              onClick={() => {
                setRenameModalOpen(false);
                setSelectedTaskId(null);
                setDraftScenarioName("");
                setRenameError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={renameSaving || !draftScenarioName.trim()}
              className="rounded-lg bg-[#1A162F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#27223F] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleRenameScenario}
            >
              {renameSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </SidebarModal>

      <SidebarModal
        open={iconModalOpen}
        title="Choose avatar"
        widthClassName="max-w-md"
        onClose={() => {
          setIconModalOpen(false);
          if (iconPickerMode === "edit") {
            setSelectedTaskId(null);
          }
        }}
      >
        <div className="grid grid-cols-4 gap-2">
          {AGENT_AVATAR_OPTIONS.map((avatarFile) => {
            const avatarSrc = getAgentAvatarSrc(avatarFile);
            const isSelected = selectedIcon === avatarFile;
            return (
              <button
                key={avatarFile}
                type="button"
                aria-label={`Select avatar ${avatarFile}`}
                title={avatarFile}
                onClick={() => {
                  void handleSelectIcon(avatarFile);
                }}
                className={`flex h-16 items-center justify-center overflow-hidden rounded-2xl border transition-all ${
                  isSelected
                    ? "border-[#1A162F] bg-[#1A162F]/5 shadow-sm ring-2 ring-[#1A162F]/20"
                    : "border-transparent bg-[#F7F8FC] hover:border-[#1A162F]/10 hover:bg-[#F1F3F8]"
                }`}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar option" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <UserCircle size={22} weight="bold" className="text-[#1A162F]" />
                )}
              </button>
            );
          })}
        </div>
      </SidebarModal>

      <SidebarModal
        open={deleteModalOpen}
        title="Delete agent"
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedTaskId(null);
        }}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-gray-600">
            {`Are you sure you want to delete ${selectedTask?.name ? `"${selectedTask.name}"` : "this agent"}? This action cannot be undone.`}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedTaskId(null);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              onClick={() => {
                void handleDeleteScenario();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </SidebarModal>
    </div>
  );
}
