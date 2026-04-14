import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  CheckSquare,
  CircleNotch,
  Code,
  Cpu,
  DownloadSimple,
  FileText,
  GithubLogo,
  Globe,
  Image,
  Lightning,
  MagnifyingGlass,
  PenNib,
  Plus,
  Sparkle,
  Square,
  TerminalWindow,
  ToggleLeft,
  ToggleRight,
  WarningCircle,
} from "@phosphor-icons/react";
import Skeleton from "../ui/Skeleton";
import type { SkillCatalogItem } from "../../lib/skill-catalog";
import { getSkillCategoryOptions } from "../../lib/skill-catalog";

type IconComponent = ComponentType<{ size?: number; weight?: "bold" | "fill" | "regular"; className?: string }>;

type WorkspaceSkillsPanelProps = {
  items: SkillCatalogItem[];
  loading: boolean;
  error: string | null;
  notice?: string | null;
  installingSkillName?: string | null;
  onBuildWithBustly: () => void;
  onUploadSkill: () => void;
  onImportGithub: () => void;
  onInstallSkill?: (skill: SkillCatalogItem) => void;
};

type AgentSkillsPanelProps = {
  items: SkillCatalogItem[];
  loading: boolean;
  error: string | null;
  selectedSkillNames: string[] | null;
  onToggleSkill: (skillName: string) => void;
};

type CreateAgentSkillsStepProps = {
  items: SkillCatalogItem[];
  loading: boolean;
  error: string | null;
  selectedSkillNames: string[];
  recommendedSkillNames: string[];
  saving: boolean;
  onToggleSkill: (skillName: string) => void;
  onBack: () => void;
  onCreate: () => void;
};

const ALL_CATEGORY = "All";
const RECOMMENDED_CATEGORY = "Recommended";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeSkillSearchText(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function matchesSkillQuery(skill: SkillCatalogItem, query: string): boolean {
  if (!query) {
    return true;
  }

  return [
    skill.name,
    skill.description,
    skill.source,
    skill.sourceLabel,
    skill.skillKey,
    skill.filePath,
    skill.homepage,
    skill.primaryEnv,
    skill.category,
  ].some((field) => normalizeSkillSearchText(field).includes(query));
}

function resolveSkillIcon(skill: SkillCatalogItem): IconComponent {
  const haystack = `${skill.name} ${skill.description} ${skill.primaryEnv ?? ""} ${skill.sourceLabel}`.toLowerCase();
  if (haystack.includes("image") || haystack.includes("photo") || haystack.includes("vision")) {
    return Image;
  }
  if (haystack.includes("github") || haystack.includes("git") || haystack.includes("code")) {
    return Code;
  }
  if (haystack.includes("browser") || haystack.includes("web") || haystack.includes("http")) {
    return Globe;
  }
  if (haystack.includes("mcp") || haystack.includes("terminal") || haystack.includes("shell")) {
    return TerminalWindow;
  }
  if (haystack.includes("cpu") || haystack.includes("tool") || haystack.includes("automation")) {
    return Cpu;
  }
  if (
    haystack.includes("doc") ||
    haystack.includes("pdf") ||
    haystack.includes("ppt") ||
    haystack.includes("text")
  ) {
    return FileText;
  }
  if (haystack.includes("copy") || haystack.includes("write") || haystack.includes("content")) {
    return PenNib;
  }
  if (haystack.includes("chat") || haystack.includes("mail") || haystack.includes("message")) {
    return ChatCircleText;
  }
  return Lightning;
}

function sortSkills(items: SkillCatalogItem[]): SkillCatalogItem[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

function buildCategoryOptions(items: SkillCatalogItem[], options?: { includeRecommended?: boolean }): string[] {
  const categories = [ALL_CATEGORY, ...getSkillCategoryOptions(items)];
  return options?.includeRecommended ? [RECOMMENDED_CATEGORY, ...categories] : categories;
}

function isSkillInstallable(skill: SkillCatalogItem): boolean {
  return skill.canInstall;
}

function isSkillInstalledInHub(skill: SkillCatalogItem): boolean {
  return skill.installed;
}

function SkillCategoryChips(props: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{
        WebkitMaskImage: "linear-gradient(to right, black calc(100% - 48px), transparent 100%)",
        maskImage: "linear-gradient(to right, black calc(100% - 48px), transparent 100%)",
      }}
    >
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => props.onSelect(option)}
          className={joinClasses(
            "shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-bold transition-all",
            props.selected === option
              ? "border-[#1A162F] bg-[#1A162F] text-white shadow-sm"
              : "border-[#E8EBF3] bg-white text-[#666F8D] hover:border-[#C8D0E2] hover:text-[#1A162F]",
          )}
        >
          {option}
        </button>
      ))}
      <div className="w-12 shrink-0" />
    </div>
  );
}

function SkillSearchInput(props: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <MagnifyingGlass size={16} weight="bold" className="text-[#8A93B2]" />
      </div>
      <input
        type="search"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="block w-full rounded-xl border border-[#E8EBF3] bg-white py-2.5 pl-9 pr-4 text-[13px] font-medium text-[#1A162F] outline-none transition-all placeholder:font-normal placeholder:text-[#8A93B2] focus:border-[#1A162F] focus:ring-1 focus:ring-[#1A162F]"
      />
    </div>
  );
}

function SkillCardSkeleton(props?: { compact?: boolean }) {
  return (
    <div
      className={joinClasses(
        "rounded-2xl border border-[#E8EBF3] bg-white shadow-[0_8px_24px_rgba(26,22,47,0.04)]",
        props?.compact ? "px-4 py-5" : "p-4",
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40 rounded-md" />
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#D7DDE8] bg-white px-6 py-16 text-center shadow-[0_8px_28px_rgba(26,22,47,0.04)]">
      <h3 className="text-[16px] font-bold text-[#1A162F]">{props.title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-[#8A93B2]">{props.description}</p>
    </div>
  );
}

function SectionHeader(props: {
  title: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {props.icon}
      <h3 className="text-[15px] font-bold text-[#1A162F]">{props.title}</h3>
      <span className="rounded-md bg-[#F4F5F8] px-2 py-0.5 text-[12px] font-bold text-[#666F8D]">
        {props.count}
      </span>
    </div>
  );
}

function SkillIconBadge(props: {
  skill: SkillCatalogItem;
  active: boolean;
  size?: "compact" | "default";
}) {
  const Icon = resolveSkillIcon(props.skill);

  return (
    <div
      className={joinClasses(
        "shrink-0 items-center justify-center rounded-xl transition-colors",
        props.size === "compact" ? "flex h-8 w-8 rounded-lg" : "flex h-10 w-10",
        props.active ? "bg-[#1A162F] text-white" : "border border-[#E8EBF3] bg-[#F8F9FC] text-[#1A162F]",
      )}
    >
      <Icon size={props.size === "compact" ? 16 : 20} weight={props.size === "compact" ? "bold" : "fill"} />
    </div>
  );
}

function SkillHubCard(props: {
  skill: SkillCatalogItem;
  installing: boolean;
  onInstall?: (skill: SkillCatalogItem) => void;
}) {
  const installable = isSkillInstallable(props.skill);

  return (
    <div className="group flex h-[108px] items-center justify-between rounded-2xl border border-[#E8EBF3] bg-white px-4 shadow-[0_8px_28px_rgba(26,22,47,0.04)] transition-all hover:border-[#DCE2EE] hover:shadow-[0_10px_24px_rgba(26,22,47,0.05)]">
      <div className="flex min-w-0 flex-1 items-center gap-4 pr-4">
        <SkillIconBadge skill={props.skill} active={false} />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[#1A162F]">{props.skill.name}</h3>
          <p className="truncate text-xs text-[#66708F]">{props.skill.description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {installable ? (
          <button
            type="button"
            disabled={props.installing || !props.onInstall}
            onClick={() => props.onInstall?.(props.skill)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#F4F5F8] px-3 text-[12px] font-bold text-[#1A162F] transition-colors hover:bg-[#E8EBF3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.installing ? (
              <>
                <CircleNotch size={14} weight="bold" className="animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <DownloadSimple size={14} weight="bold" />
                Install
              </>
            )}
          </button>
        ) : props.skill.installed ? (
          <div className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-[#8A93B2]">
            <CheckCircle size={14} weight="bold" />
            Installed
          </div>
        ) : (
          <div className="flex h-8 items-center gap-1.5 rounded-lg bg-[#FFF4E8] px-3 text-[12px] font-bold text-[#C56A18]">
            <WarningCircle size={14} weight="bold" />
            Needs setup
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSkillCard(props: {
  skill: SkillCatalogItem;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="group flex w-full items-start justify-between rounded-2xl border border-[#E8EBF3] bg-white p-4 text-left shadow-[0_8px_24px_rgba(26,22,47,0.04)] transition-all hover:border-[#1A162F] focus:outline-none"
    >
      <div className="flex w-full items-start gap-3 overflow-hidden pr-2">
        <div className="mt-0.5">
          <SkillIconBadge skill={props.skill} active={props.enabled} size="compact" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate pr-2 text-[13px] font-bold text-[#1A162F]">{props.skill.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[#8A93B2]">
            {props.skill.description}
          </div>
        </div>
      </div>

      <div className="ml-1 mt-1 shrink-0 transition-colors">
        {props.enabled ? (
          <ToggleRight size={28} weight="fill" className="text-[#1A162F]" />
        ) : (
          <ToggleLeft size={28} weight="regular" className="text-[#C8D0E2] group-hover:text-[#8A93B2]" />
        )}
      </div>
    </button>
  );
}

function AddPaneSkillCard(props: {
  skill: SkillCatalogItem;
  selected: boolean;
  onToggleSelected: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className={joinClasses(
        "group flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all hover:shadow-sm",
        props.selected
          ? "border-[#1A162F] bg-[#F8F9FC]/50 ring-1 ring-[#1A162F]"
          : "border-[#E8EBF3] bg-white hover:border-[#C8D0E2]",
      )}
    >
      <button
        type="button"
        onClick={props.onToggleSelected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="shrink-0 text-[#1A162F] transition-colors">
          {props.selected ? (
            <CheckSquare size={20} weight="fill" />
          ) : (
            <Square size={20} weight="bold" className="text-[#C8D0E2] group-hover:text-[#8A93B2]" />
          )}
        </div>
        <SkillIconBadge skill={props.skill} active={false} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-[#1A162F]">{props.skill.name}</div>
          <div className="mt-1 truncate text-[12px] text-[#666F8D]">{props.skill.description}</div>
        </div>
      </button>

      <button
        type="button"
        onClick={props.onAdd}
        className="shrink-0 rounded-lg bg-[#F4F5F8] px-3.5 py-1.5 text-[12px] font-bold text-[#1A162F] transition-colors hover:bg-[#E8EBF3]"
      >
        Add
      </button>
    </div>
  );
}

function CreateSkillCard(props: {
  skill: SkillCatalogItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="group flex w-full self-start items-start justify-between rounded-xl border border-[#E8EBF3] bg-white p-3.5 text-left shadow-sm transition-all hover:border-[#1A162F] focus:outline-none"
    >
      <div className="flex w-full items-start gap-3 overflow-hidden pr-2">
        <div className="mt-0.5">
          <SkillIconBadge skill={props.skill} active={props.selected} size="compact" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate pr-2 text-[13px] font-bold text-[#1A162F]">{props.skill.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[#8A93B2]">
            {props.skill.description}
          </div>
        </div>
      </div>

      <div className="ml-1 mt-1 shrink-0 transition-colors">
        {props.selected ? (
          <ToggleRight size={28} weight="fill" className="text-[#1A162F]" />
        ) : (
          <ToggleLeft size={28} weight="regular" className="text-[#C8D0E2] group-hover:text-[#8A93B2]" />
        )}
      </div>
    </button>
  );
}

function SkillGridLoading(props?: { compact?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SkillCardSkeleton compact={props?.compact} />
      <SkillCardSkeleton compact={props?.compact} />
      <SkillCardSkeleton compact={props?.compact} />
      <SkillCardSkeleton compact={props?.compact} />
    </div>
  );
}

export function WorkspaceSkillsPanel(props: WorkspaceSkillsPanelProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const categoryOptions = useMemo(() => buildCategoryOptions(props.items), [props.items]);
  const normalizedQuery = normalizeSkillSearchText(deferredSearchQuery);

  const filteredItems = useMemo(() => {
    return sortSkills(
      props.items.filter((item) => {
        const matchesCategory = selectedCategory === ALL_CATEGORY || item.category === selectedCategory;
        return matchesCategory && matchesSkillQuery(item, normalizedQuery);
      }),
    );
  }, [normalizedQuery, props.items, selectedCategory]);

  const installedItems = useMemo(
    () => filteredItems.filter((item) => isSkillInstalledInHub(item)),
    [filteredItems],
  );
  const installableItems = useMemo(
    () => filteredItems.filter((item) => isSkillInstallable(item)),
    [filteredItems],
  );
  const hasSearchOrFilter = Boolean(normalizedQuery) || selectedCategory !== ALL_CATEGORY;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pt-6 pb-6 font-sans">
      <div className="sticky top-0 z-30 -mx-6 -mt-6 bg-[#E9ECF1] px-6 pt-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-[#1A162F]">Skills</h1>
            <p className="mt-1 text-[14px] font-medium leading-6 text-[#666F8D]">
              Manage your skill library, and install or update what you need.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((current) => !current)}
                className="flex h-11 items-center gap-2 rounded-[18px] border border-[#EEF1F6] bg-white px-5 text-[13px] font-bold text-[#1A162F] shadow-[0_10px_30px_rgba(26,22,47,0.08)] transition-all hover:border-[#DCE2EE] hover:shadow-[0_14px_32px_rgba(26,22,47,0.1)]"
              >
                <span>Manage</span>
                <CaretDown size={14} weight="bold" className="text-[#8A93B2]" />
              </button>

              {dropdownOpen ? (
                <div className="absolute top-full right-0 z-20 mt-2 w-72 rounded-2xl border border-[#E8EBF3] bg-white p-2 shadow-[0_16px_40px_rgba(26,22,47,0.18)]">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        props.onBuildWithBustly();
                      }}
                      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#1A162F]/5"
                    >
                      <Sparkle size={18} weight="bold" className="mt-0.5 text-[#1A162F] opacity-60 transition-opacity group-hover:opacity-100" />
                      <div>
                        <span className="block text-sm font-medium text-[#1A162F]">Build with Bustly</span>
                        <span className="mt-0.5 block text-xs text-[#8A93B2] transition-colors group-hover:text-[#1A162F]">
                          Create a new skill through conversation.
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        props.onImportGithub();
                      }}
                      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#1A162F]/5"
                    >
                      <GithubLogo size={18} weight="bold" className="mt-0.5 text-[#1A162F] opacity-60 transition-opacity group-hover:opacity-100" />
                      <div>
                        <span className="block text-sm font-medium text-[#1A162F]">Import from GitHub</span>
                        <span className="mt-0.5 block text-xs text-[#8A93B2] transition-colors group-hover:text-[#1A162F]">
                          Add a skill from a repository URL.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={props.onUploadSkill}
              className="flex h-11 items-center gap-2 rounded-[18px] bg-[#1A162F] px-5 text-[13px] font-bold text-white shadow-[0_10px_30px_rgba(26,22,47,0.14)] transition-all hover:bg-[#27223F]"
            >
              <Plus size={16} weight="bold" />
              <span>Upload</span>
            </button>
          </div>
        </div>

        <div className="pb-6">
          <SkillCategoryChips
            options={categoryOptions}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <div className="mt-4">
            <SkillSearchInput
              value={searchQuery}
              placeholder="Search skills..."
              onChange={setSearchQuery}
            />
          </div>

          {props.notice ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {props.notice}
            </div>
          ) : null}
        </div>
      </div>

      {props.loading ? (
        <SkillGridLoading compact />
      ) : props.error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
          {props.error}
        </div>
      ) : filteredItems.length === 0 ? (
        hasSearchOrFilter ? (
          <EmptyState
            title="No skills found"
            description="Try another keyword or switch the current filter."
          />
        ) : (
          <EmptyState
            title="No skills available yet"
            description="Upload one from your machine, import it from GitHub, or build a new skill with Bustly."
          />
        )
      ) : (
        <div className="space-y-8 pb-10">
          {installedItems.length > 0 ? (
            <div>
              <SectionHeader
                title="Installed"
                count={installedItems.length}
                icon={<CheckCircle size={18} weight="fill" className="text-[#1A162F]" />}
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {installedItems.map((skill) => (
                  <SkillHubCard
                    key={skill.id}
                    skill={skill}
                    installing={props.installingSkillName === skill.name}
                    onInstall={props.onInstallSkill}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {installableItems.length > 0 ? (
            <div>
              <SectionHeader
                title="Available to Install"
                count={installableItems.length}
                icon={<DownloadSimple size={18} weight="bold" className="text-[#1A162F]" />}
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {installableItems.map((skill) => (
                  <SkillHubCard
                    key={skill.id}
                    skill={skill}
                    installing={props.installingSkillName === skill.name}
                    onInstall={props.onInstallSkill}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AgentSkillsPanel(props: AgentSkillsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [showAddPane, setShowAddPane] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryCategory, setLibraryCategory] = useState(ALL_CATEGORY);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredLibraryQuery = useDeferredValue(librarySearchQuery);

  const enabledSkillNames = useMemo(
    () => new Set(props.selectedSkillNames ?? props.items.map((item) => item.name)),
    [props.items, props.selectedSkillNames],
  );

  const enabledCount = props.selectedSkillNames?.length ?? props.items.length;

  const categoryOptions = useMemo(() => buildCategoryOptions(props.items), [props.items]);
  const availableItems = useMemo(
    () => sortSkills(props.items.filter((item) => !enabledSkillNames.has(item.name))),
    [enabledSkillNames, props.items],
  );
  const availableCategories = useMemo(() => buildCategoryOptions(availableItems), [availableItems]);

  const filteredItems = useMemo(() => {
    const query = normalizeSkillSearchText(deferredSearchQuery);
    return sortSkills(
      props.items.filter((item) => {
        const matchesCategory = selectedCategory === ALL_CATEGORY || item.category === selectedCategory;
        return matchesCategory && matchesSkillQuery(item, query);
      }),
    );
  }, [deferredSearchQuery, props.items, selectedCategory]);

  const filteredAvailableItems = useMemo(() => {
    const query = normalizeSkillSearchText(deferredLibraryQuery);
    return sortSkills(
      availableItems.filter((item) => {
        const matchesCategory = libraryCategory === ALL_CATEGORY || item.category === libraryCategory;
        return matchesCategory && matchesSkillQuery(item, query);
      }),
    );
  }, [availableItems, deferredLibraryQuery, libraryCategory]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set<string>();
      for (const name of current) {
        if (availableItems.some((item) => item.name === name)) {
          next.add(name);
        }
      }
      return next;
    });
  }, [availableItems]);

  const addSelectedSkills = () => {
    const names = [...selectedIds];
    for (const name of names) {
      props.onToggleSkill(name);
    }
    setSelectedIds(new Set());
  };

  const content = (() => {
    if (props.loading) {
      return (
        <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2">
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
        </div>
      );
    }

    if (props.error) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
          {props.error}
        </div>
      );
    }

    if (showAddPane) {
      return (
        <div className="relative flex min-h-0 flex-1 flex-col bg-white animate-in slide-in-from-right-8 fade-in duration-300">
          <div className="sticky top-0 z-30 shrink-0 bg-white px-6 pt-6 pb-4">
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddPane(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A93B2] transition-colors hover:bg-[#F4F5F8] hover:text-[#1A162F]"
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
              <div>
                <h3 className="text-[18px] font-bold text-[#1A162F]">Add skills from Hub</h3>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <SkillCategoryChips
                options={availableCategories}
                selected={libraryCategory}
                onSelect={setLibraryCategory}
              />
              <SkillSearchInput
                value={librarySearchQuery}
                placeholder="Search skills..."
                onChange={setLibrarySearchQuery}
              />
            </div>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pt-0 pb-24">
            {filteredAvailableItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2">
                {filteredAvailableItems.map((skill) => (
                  <AddPaneSkillCard
                    key={skill.id}
                    skill={skill}
                    selected={selectedIds.has(skill.name)}
                    onToggleSelected={() => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (next.has(skill.name)) {
                          next.delete(skill.name);
                        } else {
                          next.add(skill.name);
                        }
                        return next;
                      });
                    }}
                    onAdd={() => {
                      props.onToggleSkill(skill.name);
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        next.delete(skill.name);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={availableItems.length > 0 ? "No matching skills" : "Everything is already enabled"}
                description={
                  availableItems.length > 0
                    ? "Try another keyword or switch the current filter."
                    : "This agent already has every available skill from the Hub enabled."
                }
              />
            )}
          </div>

          {selectedIds.size > 0 ? (
            <div className="absolute top-6 right-6 z-10 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={addSelectedSkills}
                className="flex items-center gap-2 rounded-xl bg-[#1A162F] px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#27223F]"
              >
                <span>Add Selected</span>
                <span className="flex h-5 items-center justify-center rounded-md bg-white/20 px-1.5 text-[11px] font-bold">
                  {selectedIds.size}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (props.items.length === 0) {
      return (
        <EmptyState
          title="No skills in Hub yet"
          description="Install or upload skills in the global Hub before enabling them for this agent."
        />
      );
    }

    return filteredItems.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2">
        {filteredItems.map((skill) => (
          <ToggleSkillCard
            key={skill.id}
            skill={skill}
            enabled={enabledSkillNames.has(skill.name)}
            onToggle={() => props.onToggleSkill(skill.name)}
          />
        ))}
      </div>
    ) : (
      <EmptyState
        title="No skills found"
        description="Try another keyword or switch the current filter."
      />
    );
  })();

  if (showAddPane) {
    return <div className="w-full bg-white px-0 pb-20 font-sans">{content}</div>;
  }

  return (
    <div className="w-full bg-white px-0 pb-20 font-sans">
      <div className="sticky top-0 z-30 bg-white px-6 pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[18px] font-bold text-[#1A162F]">{enabledCount} skills</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPane(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1A162F] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#27223F]"
          >
            <Plus size={16} weight="bold" />
            <span>Add skill</span>
          </button>
        </div>

        <div className="pb-4">
          <SkillCategoryChips
            options={categoryOptions}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <div className="mt-4">
            <SkillSearchInput
              value={searchQuery}
              placeholder="Search skills..."
              onChange={setSearchQuery}
            />
          </div>
        </div>
      </div>

      <div className="px-6">{content}</div>
    </div>
  );
}

export function CreateAgentSkillsStep(props: CreateAgentSkillsStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(RECOMMENDED_CATEGORY);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const selectedNames = useMemo(() => new Set(props.selectedSkillNames), [props.selectedSkillNames]);
  const recommendedNames = useMemo(() => new Set(props.recommendedSkillNames), [props.recommendedSkillNames]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(props.items, { includeRecommended: true }),
    [props.items],
  );

  const visibleItems = useMemo(() => {
    const query = normalizeSkillSearchText(deferredSearchQuery);
    return sortSkills(
      props.items.filter((item) => {
        const matchesCategory =
          selectedCategory === ALL_CATEGORY
            ? true
            : selectedCategory === RECOMMENDED_CATEGORY
              ? recommendedNames.has(item.name)
              : item.category === selectedCategory;
        return matchesCategory && matchesSkillQuery(item, query);
      }),
    );
  }, [deferredSearchQuery, props.items, recommendedNames, selectedCategory]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 bg-white px-6 pb-5">
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-[#666F8D]">
            Based on your description, we&apos;ve pre-selected some recommended skills. You can search and add more from the workspace library.
          </p>

          <SkillCategoryChips
            options={categoryOptions}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          <SkillSearchInput
            value={searchQuery}
            placeholder="Search skills..."
            onChange={setSearchQuery}
          />
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {props.loading ? (
          <div className="grid min-h-[320px] auto-rows-max content-start items-start grid-cols-1 gap-3 lg:grid-cols-2">
            <SkillCardSkeleton />
            <SkillCardSkeleton />
            <SkillCardSkeleton />
            <SkillCardSkeleton />
          </div>
        ) : props.error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center text-sm text-red-600">
            {props.error}
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="grid min-h-[320px] auto-rows-max content-start items-start grid-cols-1 gap-3 lg:grid-cols-2">
            {visibleItems.map((skill) => (
              <CreateSkillCard
                key={skill.id}
                skill={skill}
                selected={selectedNames.has(skill.name)}
                onToggle={() => props.onToggleSkill(skill.name)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No skills found"
            description="Try another keyword or switch the current filter."
          />
        )}
      </div>

      <div className="shrink-0 border-t border-[#E8EBF3] bg-white px-6 py-4">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={props.onBack}
            className="h-10 rounded-xl px-4 py-2 text-[13px] font-medium text-[#666F8D] transition-colors hover:bg-[#F4F5F8]"
          >
            Back
          </button>
          <button
            type="button"
            disabled={props.saving}
            onClick={props.onCreate}
            className="h-10 rounded-xl bg-[#1A162F] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#27223F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {props.saving ? "Creating..." : "Save & Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
