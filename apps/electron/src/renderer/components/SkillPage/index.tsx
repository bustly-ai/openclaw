import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowsCounterClockwise,
  File,
  FileZip,
  FolderSimple,
  GithubLogo,
  X,
} from "@phosphor-icons/react";
import collapsedLogo from "../../assets/imgs/collapsed_logo_clean.svg";
import { fetchSkillCatalog, installSkillCatalogItem, type SkillCatalogItem } from "../../lib/skill-catalog";
import { WorkspaceSkillsPanel } from "../skills/SkillLibraryPanels";

const BUILD_WITH_BUSTLY_PROMPT =
  "/skill-creator Help me create a skill together. First ask me what the skill should do.";

type PendingChatContext = {
  path: string;
  name: string;
  kind: "file" | "directory";
};

function ModalShell(props: {
  isOpen: boolean;
  maxWidth: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!props.isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={props.onClose} />
      <div className={`relative z-10 w-full ${props.maxWidth} animate-in fade-in zoom-in-95 duration-200`}>
        {props.children}
      </div>
    </div>,
    document.body,
  );
}

function buildImportGithubSkillPrompt(url: string): string {
  return `Help me install a skill from GitHub together. I want to use this repository: ${url}`;
}

function basenameFromPath(pathValue: string): string {
  return pathValue.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || pathValue;
}

function buildUploadSkillPrompt(selection: PendingChatContext): string {
  const sourceType = selection.kind === "directory" ? "folder" : "file";
  return `Help me install a local skill together. I just selected a ${sourceType} named "${selection.name}". First help me inspect whether it is a valid skill, then guide me through installation.`;
}

function parseTransferredFilePaths(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split("\0")
    .join("\n")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("file://")) {
        try {
          return decodeURIComponent(new URL(entry).pathname);
        } catch {
          return entry;
        }
      }
      return entry;
    })
    .filter((entry) => entry.startsWith("/"));
}

function extractNativeTransferPaths(dataTransfer?: DataTransfer | null): string[] {
  if (!dataTransfer) {
    return [];
  }
  const candidates = [
    dataTransfer.getData("text/uri-list"),
    dataTransfer.getData("text/plain"),
  ];
  const paths = new Set<string>();
  for (const candidate of candidates) {
    for (const path of parseTransferredFilePaths(candidate)) {
      paths.add(path);
    }
  }
  return [...paths];
}

async function resolveDroppedSkillSelection(dataTransfer: DataTransfer): Promise<PendingChatContext | null> {
  const transferPaths = extractNativeTransferPaths(dataTransfer);
  const firstFile = dataTransfer.files?.[0];
  const firstItem = dataTransfer.items?.[0];
  const entryHandle =
    firstItem &&
    typeof firstItem === "object" &&
    "webkitGetAsEntry" in firstItem &&
    typeof (firstItem as DataTransferItem & {
      webkitGetAsEntry?: () => { fullPath?: string; name?: string } | null;
    }).webkitGetAsEntry === "function"
      ? (firstItem as DataTransferItem & {
          webkitGetAsEntry: () => { fullPath?: string; name?: string } | null;
        }).webkitGetAsEntry()
      : null;
  const resolved = await window.electronAPI.resolvePastedPath({
    file: firstFile ?? undefined,
    entryPath: transferPaths[0] ?? entryHandle?.fullPath,
    entryName: firstFile?.name ?? entryHandle?.name,
    transferPaths,
    fallbackKind: "file",
  });
  const path = resolved.path?.trim();
  if (!path) {
    return null;
  }
  return {
    path,
    name: basenameFromPath(path),
    kind: resolved.kind === "directory" ? "directory" : "file",
  };
}

function UploadSkillModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: PendingChatContext) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  if (!props.isOpen) {
    return null;
  }

  return (
    <ModalShell isOpen={props.isOpen} onClose={props.onClose} maxWidth="max-w-lg">
      <div className="rounded-2xl bg-white shadow-2xl">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1A162F]">Upload skill</h2>
            <button
              type="button"
              onClick={props.onClose}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <div
            className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              isDragging ? "border-[#1A162F] bg-[#1A162F]/5" : "border-gray-200 hover:border-[#1A162F]/50 hover:bg-gray-50"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void resolveDroppedSkillSelection(event.dataTransfer).then((selection) => {
                if (selection) {
                  props.onSelect(selection);
                }
              });
            }}
            onClick={() => {
              void window.electronAPI.selectChatContextPaths().then((selected) => {
                const first = Array.isArray(selected) ? selected[0] : null;
                if (!first?.path) {
                  return;
                }
                props.onSelect({
                  path: first.path,
                  name: first.name?.trim() || basenameFromPath(first.path),
                  kind: first.kind === "directory" ? "directory" : "file",
                });
              });
            }}
          >
            <div className="mb-4 flex gap-[-8px]">
              <FileZip size={32} weight="bold" className="translate-x-2 rotate-[-6deg] text-gray-400" />
              <File size={32} weight="bold" className="z-10 -translate-y-2 text-gray-400" />
              <FolderSimple size={32} weight="bold" className="-translate-x-2 rotate-[6deg] text-gray-400" />
            </div>
            <p className="text-sm font-medium text-[#1A162F]">Drag and drop or click to upload</p>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-bold text-[#1A162F]">What happens next</h3>
            <ul className="space-y-2 text-sm text-[#6B7280]">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                <span>You can choose any local file or folder as the skill source.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                <span>Bustly will inspect it with you, but a valid installable skill still needs a root-level `SKILL.md`.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function GithubImportModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!props.isOpen) {
      setUrl("");
      setError("");
    }
  }, [props.isOpen]);

  return (
    <ModalShell isOpen={props.isOpen} onClose={props.onClose} maxWidth="max-w-md">
      <div className="rounded-2xl bg-white shadow-2xl">
        <div className="relative p-6 text-center">
          <button
            type="button"
            onClick={props.onClose}
            className="absolute top-4 right-4 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={20} weight="bold" />
          </button>

          <div className="mb-4 flex items-center justify-center gap-4">
            <GithubLogo size={32} weight="bold" className="text-[#111827] opacity-90" />
            <div className="text-gray-300">
              <ArrowsCounterClockwise size={24} weight="bold" />
            </div>
            <img src={collapsedLogo} alt="Bustly" className="h-8 w-8 object-contain" />
          </div>

          <h2 className="mb-2 text-xl font-bold text-[#1A162F]">Import from GitHub</h2>
          <p className="mb-6 text-sm text-[#6B7280]">Import a skill directly from a public GitHub repository.</p>

          <div className="mb-6 text-left">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#1A162F]">URL</label>
            <input
              type="text"
              value={url}
              autoFocus
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
              }}
              placeholder="https://github.com/username/repo"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition-all focus:border-[#1A162F] focus:ring-2 focus:ring-[#1A162F]/10"
            />
            {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
          </div>

          <button
            type="button"
            disabled={!url}
            onClick={() => {
              const normalized = url.trim();
              const isValid = /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?\/?$/.test(normalized);
              if (!isValid) {
                setError("Please enter a valid GitHub repository URL.");
                return;
              }
              props.onImport(normalized);
            }}
            className="h-10 w-full rounded-lg bg-[#1A162F] text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1A162F]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default function SkillPage() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillActionError, setSkillActionError] = useState<string | null>(null);
  const [installingSkillName, setInstallingSkillName] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSkills = useCallback(async (options?: { withSpinner?: boolean }) => {
    const withSpinner = options?.withSpinner !== false;
    if (withSpinner) {
      setLoadingSkills(true);
    }
    const items = await fetchSkillCatalog({ scope: "skill-page" });
    if (!mountedRef.current) {
      return;
    }
    setSkills(items);
    setSkillsError(null);
    if (withSpinner) {
      setLoadingSkills(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSkills({ withSpinner: true })
      .catch((error) => {
        if (cancelled || !mountedRef.current) {
          return;
        }
        setSkillsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setLoadingSkills(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadSkills]);

  const handleInstallSkill = useCallback(async (skill: SkillCatalogItem) => {
    const installId = skill.installOptions[0]?.id;
    if (!installId) {
      return;
    }

    setSkillActionError(null);
    setInstallingSkillName(skill.name);

    try {
      await installSkillCatalogItem({
        skillName: skill.name,
        installId,
        scope: `skill-install-${skill.skillKey || skill.name}`,
      });
      await loadSkills({ withSpinner: false });
    } catch (error) {
      if (mountedRef.current) {
        setSkillActionError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (mountedRef.current) {
        setInstallingSkillName(null);
      }
    }
  }, [loadSkills]);

  const navigateToChatWithPrompt = (prompt: string, context?: PendingChatContext) => {
    const searchParams = new URLSearchParams();
    searchParams.set("prompt", prompt);
    if (context) {
      searchParams.set("contextPath", context.path);
      searchParams.set("contextName", context.name);
      searchParams.set("contextKind", context.kind);
    }
    void navigate(`/chat?${searchParams.toString()}`);
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[#E9ECF1]">
      <WorkspaceSkillsPanel
        items={skills}
        loading={loadingSkills}
        error={skillsError}
        notice={skillActionError}
        installingSkillName={installingSkillName}
        onBuildWithBustly={() => navigateToChatWithPrompt(BUILD_WITH_BUSTLY_PROMPT)}
        onUploadSkill={() => setShowUploadModal(true)}
        onImportGithub={() => setShowGithubModal(true)}
        onInstallSkill={handleInstallSkill}
      />

      <UploadSkillModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelect={(selection) => {
          setShowUploadModal(false);
          navigateToChatWithPrompt(buildUploadSkillPrompt(selection), selection);
        }}
      />

      <GithubImportModal
        isOpen={showGithubModal}
        onClose={() => setShowGithubModal(false)}
        onImport={(url) => {
          setShowGithubModal(false);
          navigateToChatWithPrompt(buildImportGithubSkillPrompt(url));
        }}
      />
    </div>
  );
}
