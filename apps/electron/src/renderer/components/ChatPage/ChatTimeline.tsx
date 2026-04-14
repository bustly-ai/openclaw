import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Lottie from "lottie-react";
import {
  ArrowsCounterClockwise,
  Brain,
  Browser,
  CaretRight,
  ChatCircle,
  Check,
  CircleNotch,
  Clock,
  Copy,
  Cpu,
  DownloadSimple,
  File,
  FileText,
  Folder,
  Globe,
  Image,
  ListBullets,
  ListDashes,
  MagnifyingGlass,
  NotePencil,
  Paperclip,
  PaperPlaneRight,
  PenNib,
  PlusCircle,
  Plug,
  Pulse,
  PuzzlePiece,
  Robot,
  ShareNetwork,
  SpeakerHigh,
  Square,
  TerminalWindow,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import loadingAnimation from "../../assets/lottie/thinking.json";
import PortalTooltip from "../ui/PortalTooltip";
import { getRendererHostAdapter } from "../../platform/host";
import {
  parseInputArtifactsFromMessage,
  type ChatInputArtifact,
} from "./input-artifacts";
import type { TimelineArtifact, TimelineNode } from "./types";
import {
  isAbsoluteLocalMarkdownPath,
  normalizeMarkdownLocalPath,
  toSanitizedMarkdownHtml,
} from "./utils";

type ChatTimelineProps = {
  timeline: TimelineNode[];
  activeRunningToolKey: string | null;
  liveIndicatorLabel?: string | null;
  liveIndicatorVisible?: boolean;
  onCopyText?: (text: string) => void;
  onRetryRun?: (runId?: string) => void;
  onPreviewImage?: (url: string) => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatUserTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

function formatProcessedDuration(durationMs: number | null | undefined): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 1000) {
    return "";
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function ChevronIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <CaretRight size={14} weight="bold" className={cx("transition-transform duration-200", expanded && "rotate-90")} />
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return <CircleNotch size={14} weight="bold" className={cx("animate-spin", className)} />;
}

function UserImageIcon() {
  return <Image size={16} weight="bold" className="h-4 w-4" />;
}

function UserFileIcon() {
  return <File size={16} weight="bold" className="h-4 w-4" />;
}

function UserFolderIcon() {
  return <Folder size={16} weight="bold" className="h-4 w-4" />;
}

function UserArtifactCard({
  artifact,
  onPreviewImage,
}: {
  artifact: ChatInputArtifact | TimelineArtifact;
  onPreviewImage?: (url: string) => void;
}) {
  const host = useMemo(() => getRendererHostAdapter(), []);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(() =>
    "imageUrl" in artifact ? artifact.imageUrl : undefined,
  );

  useEffect(() => {
    const immediatePreview = "imageUrl" in artifact ? artifact.imageUrl : undefined;
    if (immediatePreview) {
      setPreviewUrl(immediatePreview);
      return;
    }
    if (artifact.kind !== "image" || !artifact.path || typeof host.resolveChatImagePreview !== "function") {
      setPreviewUrl(undefined);
      return;
    }
    let cancelled = false;
    void host.resolveChatImagePreview(artifact.path).then((resolved) => {
      if (!cancelled) {
        setPreviewUrl(resolved ?? undefined);
      }
    }).catch(() => {
      if (!cancelled) {
        setPreviewUrl(undefined);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [artifact, host]);

  const Icon =
    artifact.kind === "directory"
      ? UserFolderIcon
      : artifact.kind === "image" || ("imageUrl" in artifact && typeof artifact.imageUrl === "string" && artifact.imageUrl.length > 0)
        ? UserImageIcon
        : UserFileIcon;

  return (
    <div className="flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 py-1 pr-1 pl-2 text-xs font-medium text-text-main">
      {previewUrl ? (
        <button
          type="button"
          className="h-5 w-5 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white"
          onClick={() => {
            onPreviewImage?.(previewUrl);
          }}
        >
          <img src={previewUrl} alt={artifact.name} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-text-sub">
          <Icon />
        </div>
      )}
      <div className="min-w-0 max-w-[220px] truncate" title={artifact.path ?? artifact.name}>
        {artifact.name}
      </div>
    </div>
  );
}

function ToolIcon({ name }: { name: string }) {
  switch (name) {
    case "terminalWindow":
      return <TerminalWindow size={16} weight="bold" className="h-4 w-4" />;
    case "cpu":
      return <Cpu size={16} weight="bold" className="h-4 w-4" />;
    case "fileText":
      return <FileText size={16} weight="bold" className="h-4 w-4" />;
    case "penNib":
      return <PenNib size={16} weight="bold" className="h-4 w-4" />;
    case "pencilSimple":
      return <NotePencil size={16} weight="bold" className="h-4 w-4" />;
    case "edit":
    case "penLine":
      return <NotePencil size={16} weight="bold" className="h-4 w-4" />;
    case "paperclip":
      return <Paperclip size={16} weight="bold" className="h-4 w-4" />;
    case "globe":
      return <Globe size={16} weight="bold" className="h-4 w-4" />;
    case "downloadSimple":
      return <DownloadSimple size={16} weight="bold" className="h-4 w-4" />;
    case "browser":
      return <Browser size={16} weight="bold" className="h-4 w-4" />;
    case "square":
      return <Square size={16} weight="bold" className="h-4 w-4" />;
    case "shareNetwork":
      return <ShareNetwork size={16} weight="bold" className="h-4 w-4" />;
    case "chatCircle":
      return <ChatCircle size={16} weight="bold" className="h-4 w-4" />;
    case "speakerHigh":
      return <SpeakerHigh size={16} weight="bold" className="h-4 w-4" />;
    case "listBullets":
      return <ListBullets size={16} weight="bold" className="h-4 w-4" />;
    case "listDashes":
      return <ListDashes size={16} weight="bold" className="h-4 w-4" />;
    case "clock":
      return <Clock size={16} weight="bold" className="h-4 w-4" />;
    case "paperPlaneRight":
      return <PaperPlaneRight size={16} weight="bold" className="h-4 w-4" />;
    case "plusCircle":
      return <PlusCircle size={16} weight="bold" className="h-4 w-4" />;
    case "robot":
      return <Robot size={16} weight="bold" className="h-4 w-4" />;
    case "pulse":
      return <Pulse size={16} weight="bold" className="h-4 w-4" />;
    case "magnifyingGlass":
      return <MagnifyingGlass size={16} weight="bold" className="h-4 w-4" />;
    case "brain":
      return <Brain size={16} weight="bold" className="h-4 w-4" />;
    case "image":
      return <Image size={16} weight="bold" className="h-4 w-4" />;
    case "smartphone":
      return <PuzzlePiece size={16} weight="bold" className="h-4 w-4" />;
    case "loader":
      return <SpinnerIcon className="h-4 w-4" />;
    case "plug":
      return <Plug size={16} weight="bold" className="h-4 w-4" />;
    case "circle":
      return <Check size={16} weight="bold" className="h-4 w-4" />;
    case "messageSquare":
      return <NotePencil size={16} weight="bold" className="h-4 w-4" />;
    case "wrench":
      return <Wrench size={16} weight="bold" className="h-4 w-4" />;
    case "puzzle":
    default:
      return <PuzzlePiece size={16} weight="bold" className="h-4 w-4" />;
  }
}

function markdownClassName(isErrorText: boolean) {
  return cx(
    "max-w-full break-words text-sm leading-7 text-gray-900 [overflow-wrap:anywhere]",
    isErrorText && "text-red-600",
    "[&_a]:text-[#1A162F] [&_a]:underline [&_a]:underline-offset-2",
    "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500",
    "[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:break-words [&_code]:[overflow-wrap:anywhere]",
    "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-gray-200 [&_pre]:bg-gray-50 [&_pre]:p-4 [&_pre]:text-xs [&_pre]:leading-6 [&_pre]:[overflow-wrap:anywhere]",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
    "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold",
    "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold",
    "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
    "[&_hr]:my-4 [&_hr]:border-gray-200",
    "[&_img]:my-3 [&_img]:max-h-[28rem] [&_img]:rounded-2xl [&_img]:border [&_img]:border-gray-200",
    "[&_video]:my-3 [&_video]:max-h-[28rem] [&_video]:w-full [&_video]:max-w-[360px] [&_video]:rounded-2xl [&_video]:border [&_video]:border-gray-200",
    "[&_audio]:my-3 [&_audio]:w-full [&_audio]:max-w-[360px]",
    "[&_li]:my-1",
    "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
    "[&_p]:my-1",
    "[&_table]:my-3 [&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:rounded-xl [&_table]:border [&_table]:border-gray-200",
    "[&_td]:border-r [&_td]:border-b [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
    "[&_th]:border-r [&_th]:border-b [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
    "[&_tr>*:last-child]:border-r-0",
    "[&_tbody_tr:last-child>*]:border-b-0",
    "[&_thead_tr:first-child_th:first-child]:rounded-tl-xl",
    "[&_thead_tr:first-child_th:last-child]:rounded-tr-xl",
    "[&_tbody_tr:last-child_td:first-child]:rounded-bl-xl",
    "[&_tbody_tr:last-child_td:last-child]:rounded-br-xl",
    "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  );
}

function isProcessNode(node: TimelineNode | null): boolean {
  if (!node) {
    return false;
  }
  if (node.kind === "tool" || node.kind === "processed") {
    return true;
  }
  return (
    node.kind === "text" &&
    (node.tone === "thinking" || (node.tone === "assistant" && (node.streaming || !node.final)))
  );
}

function shouldTightJoin(prev: TimelineNode | null, next: TimelineNode | null): boolean {
  if (!prev || !next) {
    return false;
  }
  return isProcessNode(prev) && isProcessNode(next);
}

function resolveExpandableNodeId(node: Extract<TimelineNode, { kind: "tool" | "processed" | "streamFold" }>): string {
  if (node.kind === "tool") {
    return `tool:${node.mergeKey || node.key}`;
  }
  if (node.kind === "streamFold") {
    const firstItemKey = node.items[0]?.key ?? node.key;
    return `streamFold:${firstItemKey}`;
  }
  return `processed:${node.key}`;
}

const TIMELINE_ENTER_FROM_CLASS = "translate-y-3 scale-[0.985] opacity-0";
const TIMELINE_ENTER_TO_CLASS = "translate-y-0 scale-100 opacity-100";

const TimelineReveal = memo(function TimelineReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEntered(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={cx(
        "origin-top transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        entered ? TIMELINE_ENTER_TO_CLASS : TIMELINE_ENTER_FROM_CLASS,
        className,
      )}
    >
      {children}
    </div>
  );
});

const AnimatedCollapsible = memo(function AnimatedCollapsible({
  open,
  children,
  className,
  innerClassName,
  keepMounted = true,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  keepMounted?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(open);
  const [height, setHeight] = useState<string>(open ? "auto" : "0px");

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    if (open) {
      setRendered(true);
      setHeight("0px");
      const frame = window.requestAnimationFrame(() => {
        setHeight(`${content.scrollHeight}px`);
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const currentHeight = `${content.getBoundingClientRect().height}px`;
    setHeight(currentHeight);
    const frame = window.requestAnimationFrame(() => {
      setHeight("0px");
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!rendered && !open && !keepMounted) {
    return null;
  }

  return (
    <div
      className={cx(
        "overflow-hidden transition-[height,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        className,
      )}
      style={{ height }}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget || event.propertyName !== "height") {
          return;
        }
        if (open) {
          setHeight("auto");
          return;
        }
        if (!keepMounted) {
          setRendered(false);
        }
      }}
      aria-hidden={!open}
    >
      <div ref={contentRef} className={innerClassName}>
        {children}
      </div>
    </div>
  );
});

const StreamFoldNode = memo(function StreamFoldNode({
  node,
  expanded,
  expandedNodeIds,
  activeRunningToolKey,
  onToggleExpanded,
  onToggleNodeExpanded,
  onCopyText,
  onRetryRun,
  onPreviewImage,
}: {
  node: Extract<TimelineNode, { kind: "streamFold" }>;
  expanded: boolean;
  expandedNodeIds: Record<string, true>;
  activeRunningToolKey: string | null;
  onToggleExpanded: () => void;
  onToggleNodeExpanded: (id: string) => void;
  onCopyText?: (text: string) => void;
  onRetryRun?: (runId?: string) => void;
  onPreviewImage?: (url: string) => void;
}) {
  const stepLabel = "Hidden activity";

  return (
    <div className={expanded ? "" : "py-2"}>
      <AnimatedCollapsible
        open={!expanded}
        className="pl-11"
        keepMounted={false}
      >
        <button
          type="button"
          onClick={() => {
            onToggleExpanded();
          }}
          className="group flex w-full items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#D8DCE7] bg-[#FBFBFD] px-4 py-3 text-center transition-[background-color,border-color,transform] duration-200 hover:border-[#C5CBD9] hover:bg-[#F7F8FC] active:scale-[0.99]"
        >
          <div className="flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100">
            <div className="h-1.5 w-1.5 rounded-full bg-[#666F8D]/60" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#666F8D]/60" />
            <div className="h-1.5 w-1.5 rounded-full bg-[#666F8D]/60" />
          </div>
          <span className="text-[15px] font-medium tracking-[-0.01em] text-[#66708F]">
            {stepLabel} (click to expand)
          </span>
        </button>
      </AnimatedCollapsible>
      <AnimatedCollapsible open={expanded} keepMounted={false}>
        <TimelineStack
          items={node.items}
          expandedNodeIds={expandedNodeIds}
          activeRunningToolKey={activeRunningToolKey}
          onToggleExpanded={onToggleNodeExpanded}
          onCopyText={onCopyText}
          onRetryRun={onRetryRun}
          onPreviewImage={onPreviewImage}
        />
      </AnimatedCollapsible>
    </div>
  );
});

const ErrorStateNode = memo(function ErrorStateNode({
  node,
  onRetryRun,
}: {
  node: Extract<TimelineNode, { kind: "errorState" }>;
  onRetryRun?: (runId?: string) => void;
}) {
  return (
    <div className="mt-4 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50/50 p-5">
        <div className="flex items-center gap-2 text-red-600">
          <WarningCircle size={20} weight="bold" />
          <span className="text-sm font-semibold tracking-tight">Execution Failed</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-[13px] font-medium text-text-main">
            Reason: <span className="ml-1 font-mono text-red-600/80">{node.reason}</span>
          </div>
          <div className="text-[13px] leading-relaxed text-text-sub">{node.description}</div>
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onRetryRun?.(node.runId);
            }}
            className="flex items-center gap-2 rounded-xl bg-text-main px-4 py-2 text-xs font-medium text-white transition-all hover:bg-text-main/90 active:scale-95"
          >
            <ArrowsCounterClockwise size={14} weight="bold" />
            Retry Now
          </button>
        </div>
      </div>
    </div>
  );
});

async function copyText(text: string, onCopyText?: (text: string) => void) {
  if (onCopyText) {
    onCopyText(text);
    return;
  }
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard write failures should not break the timeline UI.
  }
}

function localMediaFallbackLabel(localPath: string, altText: string | null): string {
  const trimmedAlt = altText?.trim() ?? "";
  if (trimmedAlt) {
    return trimmedAlt;
  }
  const trimmedPath = localPath.trim().replace(/[\\/]+$/, "");
  const baseName = trimmedPath.split(/[\\/]/).pop() ?? "";
  return baseName || "Open file";
}

function replaceImageWithLocalLink(image: HTMLImageElement, localPath: string): void {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", localPath);
  anchor.setAttribute("data-local-path", localPath);
  anchor.setAttribute("title", localPath);
  anchor.textContent = localMediaFallbackLabel(localPath, image.getAttribute("alt"));
  image.replaceWith(anchor);
}

function replaceImageWithFallbackText(image: HTMLImageElement, sourceHint: string): void {
  const fallback = document.createElement("span");
  fallback.textContent = localMediaFallbackLabel(sourceHint, image.getAttribute("alt"));
  image.replaceWith(fallback);
}

function replaceImageWithLocalVideo(
  image: HTMLImageElement,
  localPath: string,
  dataUrl: string,
  mimeType: string,
): void {
  const video = document.createElement("video");
  video.controls = true;
  video.preload = "metadata";
  video.setAttribute("title", localPath);
  video.setAttribute("data-local-path", localPath);
  const source = document.createElement("source");
  source.src = dataUrl;
  source.type = mimeType;
  video.appendChild(source);
  video.appendChild(document.createTextNode(localMediaFallbackLabel(localPath, image.getAttribute("alt"))));
  image.replaceWith(video);
}

function replaceImageWithLocalAudio(
  image: HTMLImageElement,
  localPath: string,
  dataUrl: string,
  mimeType: string,
): void {
  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.setAttribute("title", localPath);
  audio.setAttribute("data-local-path", localPath);
  const source = document.createElement("source");
  source.src = dataUrl;
  source.type = mimeType;
  audio.appendChild(source);
  image.replaceWith(audio);
}

const MarkdownContent = memo(function MarkdownContent({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const host = useMemo(() => getRendererHostAdapter(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const html = toSanitizedMarkdownHtml(text);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }
    let disposed = false;

    root.querySelectorAll<HTMLAnchorElement>("a[data-local-path]").forEach((anchor) => {
      const path = anchor.getAttribute("data-local-path")?.trim() ?? "";
      if (!isAbsoluteLocalMarkdownPath(path)) {
        return;
      }
      anchor.setAttribute("title", path);
      anchor.classList.add("cursor-pointer");
    });
    root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      const source = image.getAttribute("src")?.trim() ?? "";
      const localPath = normalizeMarkdownLocalPath(
        image.getAttribute("data-local-path") ?? source,
      );
      if (!localPath || !isAbsoluteLocalMarkdownPath(localPath)) {
        const lowerSource = source.toLowerCase();
        const isWebOrDataSource = lowerSource.startsWith("http://")
          || lowerSource.startsWith("https://")
          || lowerSource.startsWith("data:")
          || lowerSource.startsWith("blob:");
        if (source && !isWebOrDataSource) {
          replaceImageWithFallbackText(image, source);
        }
        return;
      }
      image.setAttribute("data-local-path", localPath);
      image.setAttribute("title", localPath);

      if (typeof host.resolveChatMediaPreview === "function") {
        void host.resolveChatMediaPreview(localPath)
          .then((preview) => {
            if (disposed || !root.contains(image)) {
              return;
            }
            if (!preview) {
              replaceImageWithLocalLink(image, localPath);
              return;
            }
            if (preview.kind === "image") {
              image.src = preview.dataUrl;
              return;
            }
            if (preview.kind === "video") {
              replaceImageWithLocalVideo(image, localPath, preview.dataUrl, preview.mimeType);
              return;
            }
            replaceImageWithLocalAudio(image, localPath, preview.dataUrl, preview.mimeType);
          })
          .catch(() => {
            if (disposed || !root.contains(image)) {
              return;
            }
            replaceImageWithLocalLink(image, localPath);
          });
        return;
      }

      if (typeof host.resolveChatImagePreview === "function") {
        void host.resolveChatImagePreview(localPath)
          .then((resolved) => {
            if (disposed || !root.contains(image)) {
              return;
            }
            if (resolved) {
              image.src = resolved;
              return;
            }
            replaceImageWithLocalLink(image, localPath);
          })
          .catch(() => {
            if (disposed || !root.contains(image)) {
              return;
            }
            replaceImageWithLocalLink(image, localPath);
          });
        return;
      }

      replaceImageWithLocalLink(image, localPath);
    });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[data-local-path]");
      if (!(anchor instanceof HTMLAnchorElement) || !root.contains(anchor)) {
        return;
      }

      const path = anchor.getAttribute("data-local-path")?.trim() ?? "";
      if (!isAbsoluteLocalMarkdownPath(path)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (host.openLocalPath) {
        void host.openLocalPath(path);
      }
    };

    root.addEventListener("click", handleClick);
    return () => {
      disposed = true;
      root.removeEventListener("click", handleClick);
    };
  }, [host, html]);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

const TextNode = memo(function TextNode({
  node,
  onCopyText,
  onPreviewImage,
}: {
  node: Extract<TimelineNode, { kind: "text" }>;
  onCopyText?: (text: string) => void;
  onPreviewImage?: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  if (node.tone === "user") {
    const timeLabel = formatUserTime(node.timestamp);
    const parsed = parseInputArtifactsFromMessage(node.text);
    const artifacts = node.artifacts ?? parsed.artifacts;
    return (
      <div className="group/user flex flex-col items-end">
        {artifacts.length > 0 ? (
          <div className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2">
            {artifacts.map((artifact, index) => (
              <UserArtifactCard
                key={`${artifact.kind}:${artifact.name}:${artifact.path ?? index}`}
                artifact={artifact}
                onPreviewImage={onPreviewImage}
              />
            ))}
          </div>
        ) : null}
        <div className="flex max-w-[85%] min-w-0 flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          {parsed.text ? (
            <div
              className="max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900 [overflow-wrap:anywhere]"
              dir="auto"
            >
              {parsed.text}
            </div>
          ) : null}
        </div>
        <div className="mt-1.5 flex min-h-[24px] items-center gap-2 px-1">
          <PortalTooltip content="Copy">
            <button
              type="button"
              aria-label="Copy message"
              className="rounded-md p-1 text-gray-500 opacity-0 transition hover:bg-gray-100 hover:text-gray-900 group-hover/user:opacity-100"
              onClick={async () => {
                void copyText(node.text, onCopyText);
                setCopied(true);
              }}
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
            </button>
          </PortalTooltip>
          {timeLabel ? <span className="text-[11px] font-medium text-gray-400">{timeLabel}</span> : null}
        </div>
      </div>
    );
  }

  const isErrorText = /^(error:|err:)/i.test(node.text.trim());
  if (node.tone === "thinking") {
    return (
      <div className={cx("relative animate-in fade-in slide-in-from-left-2 duration-500 pl-11", node.streaming && "opacity-90")}>
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-[26px] top-0 z-0 w-[2px]"
          style={{
            backgroundImage: "linear-gradient(to bottom, #E5E7EB 50%, transparent 50%)",
            backgroundSize: "2px 8px",
            backgroundRepeat: "repeat-y",
          }}
        />
        <MarkdownContent
          text={node.text}
          className={cx(markdownClassName(isErrorText), "relative z-10 !text-gray-500")}
        />
      </div>
    );
  }

  if (node.tone === "assistant" && !node.final) {
    return (
      <div className="pl-3">
        <MarkdownContent
          text={node.text}
          className={markdownClassName(isErrorText)}
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "animate-in fade-in slide-in-from-bottom-2 duration-500 pl-3",
        node.streaming && "opacity-95",
        node.final && "pb-1",
      )}
    >
      <MarkdownContent
        text={node.text}
        className={markdownClassName(isErrorText)}
      />
    </div>
  );
});

const ToolNode = memo(function ToolNode({
  node,
  expanded,
  activeRunningToolKey,
  onToggleExpanded,
}: {
  node: Extract<TimelineNode, { kind: "tool" }>;
  expanded: boolean;
  activeRunningToolKey: string | null;
  onToggleExpanded: () => void;
}) {
  const running = node.running && node.key === activeRunningToolKey;

  return (
    <div className="relative flex flex-col">
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-[26px] top-[54px] z-0 w-[2px]"
        style={{
          backgroundImage: "linear-gradient(to bottom, #E5E7EB 50%, transparent 50%)",
          backgroundSize: "2px 8px",
          backgroundRepeat: "repeat-y",
        }}
      />

      <div className="relative z-10 flex flex-col">
        <button
          type="button"
          className="group mb-1 mt-1 flex items-center gap-3 text-left"
          onClick={() => {
            onToggleExpanded();
          }}
        >
          <div className="relative flex-1 rounded-xl transition-colors hover:bg-white">
            <div
              className={cx(
                "absolute inset-0 rounded-xl transition-colors",
                expanded ? "bg-[#1A162F]/5" : "bg-transparent group-hover:bg-[#1A162F]/5",
              )}
            />

            <div className="relative flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-900">
                  <ToolIcon name={node.icon ?? "puzzle"} />
                </div>
                <span className="text-sm font-semibold text-gray-900">{node.label ?? node.summary}</span>
                <div className="flex h-3.5 w-3.5 items-center justify-center">
                  {running ? <SpinnerIcon className="text-gray-500" /> : null}
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-500">
                <ChevronIcon expanded={expanded} />
              </div>
            </div>
          </div>
        </button>

        <div className="ml-11">
          <AnimatedCollapsible open={expanded} className={expanded ? "mb-4" : ""} keepMounted={false}>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-words pr-1 text-xs leading-relaxed text-gray-500">
                {node.detail}
              </pre>
            </div>
          </AnimatedCollapsible>
        </div>
      </div>
    </div>
  );
});

const ProcessedNode = memo(function ProcessedNode({
  node,
  expanded,
  expandedNodeIds,
  activeRunningToolKey,
  onToggleExpanded,
  onToggleNodeExpanded,
  onRetryRun,
}: {
  node: Extract<TimelineNode, { kind: "processed" }>;
  expanded: boolean;
  expandedNodeIds: Record<string, true>;
  activeRunningToolKey: string | null;
  onToggleExpanded: () => void;
  onToggleNodeExpanded: (id: string) => void;
  onRetryRun?: (runId?: string) => void;
}) {
  const duration = formatProcessedDuration(node.durationMs);
  const summary = duration ? `Processed in ${duration}` : "Processed";

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 text-left transition-colors hover:bg-gray-100"
        onClick={() => {
          onToggleExpanded();
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A162F]/5 text-[#1A162F]">
          <Check size={16} weight="bold" className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900">Execution Completed</div>
          <div className="text-xs text-gray-500">{summary}</div>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      <AnimatedCollapsible open={expanded} className={expanded ? "mt-4" : ""} keepMounted={false}>
        <div>
          <TimelineStack
            items={node.items}
            expandedNodeIds={expandedNodeIds}
            activeRunningToolKey={activeRunningToolKey}
            onToggleExpanded={onToggleNodeExpanded}
            onRetryRun={onRetryRun}
          />
        </div>
      </AnimatedCollapsible>
    </div>
  );
});

const DividerNode = memo(function DividerNode({ node }: { node: Extract<TimelineNode, { kind: "divider" }> }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" data-ts={String(node.timestamp)}>
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{node.label}</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
});

function TimelineStack({
  items,
  expandedNodeIds,
  activeRunningToolKey,
  onToggleExpanded,
  onCopyText,
  onRetryRun,
  onPreviewImage,
  spaced = false,
}: {
  items: TimelineNode[];
  expandedNodeIds: Record<string, true>;
  activeRunningToolKey: string | null;
  onToggleExpanded: (id: string) => void;
  onCopyText?: (text: string) => void;
  onRetryRun?: (runId?: string) => void;
  onPreviewImage?: (url: string) => void;
  spaced?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {items.map((node, index) => {
        const prev = index > 0 ? items[index - 1] : null;
        const needsLooseSpacing = spaced && index > 0 && !shouldTightJoin(prev, node);
        const spacingClass = needsLooseSpacing && index < items.length - 1 ? "mt-4" : undefined;
        const item = (
          <TimelineItem
            node={node}
            expandedNodeIds={expandedNodeIds}
            activeRunningToolKey={activeRunningToolKey}
            onToggleExpanded={onToggleExpanded}
            onCopyText={onCopyText}
            onRetryRun={onRetryRun}
            onPreviewImage={onPreviewImage}
          />
        );
        if (node.kind === "streamFold") {
          return (
            <div key={node.key} className={cx(spacingClass)}>
              {item}
            </div>
          );
        }
        return (
          <TimelineReveal key={node.key} className={cx(spacingClass)}>
            {item}
          </TimelineReveal>
        );
      })}
    </div>
  );
}

const TimelineItem = memo(function TimelineItem({
  node,
  expandedNodeIds,
  activeRunningToolKey,
  onToggleExpanded,
  onCopyText,
  onRetryRun,
  onPreviewImage,
}: {
  node: TimelineNode;
  expandedNodeIds: Record<string, true>;
  activeRunningToolKey: string | null;
  onToggleExpanded: (id: string) => void;
  onCopyText?: (text: string) => void;
  onRetryRun?: (runId?: string) => void;
  onPreviewImage?: (url: string) => void;
}) {
  switch (node.kind) {
    case "text":
      return <TextNode node={node} onCopyText={onCopyText} onPreviewImage={onPreviewImage} />;
    case "tool":
      return (
        <ToolNode
          node={node}
          expanded={Boolean(expandedNodeIds[resolveExpandableNodeId(node)])}
          activeRunningToolKey={activeRunningToolKey}
          onToggleExpanded={() => onToggleExpanded(resolveExpandableNodeId(node))}
        />
      );
    case "processed":
      return (
        <ProcessedNode
          node={node}
          expanded={Boolean(expandedNodeIds[resolveExpandableNodeId(node)])}
          expandedNodeIds={expandedNodeIds}
          activeRunningToolKey={activeRunningToolKey}
          onToggleExpanded={() => onToggleExpanded(resolveExpandableNodeId(node))}
          onToggleNodeExpanded={onToggleExpanded}
          onRetryRun={onRetryRun}
        />
      );
    case "errorState":
      return <ErrorStateNode node={node} onRetryRun={onRetryRun} />;
    case "streamFold":
      return (
        <StreamFoldNode
          node={node}
          expanded={Boolean(expandedNodeIds[resolveExpandableNodeId(node)])}
          expandedNodeIds={expandedNodeIds}
          activeRunningToolKey={activeRunningToolKey}
          onToggleExpanded={() => onToggleExpanded(resolveExpandableNodeId(node))}
          onToggleNodeExpanded={onToggleExpanded}
          onCopyText={onCopyText}
          onRetryRun={onRetryRun}
          onPreviewImage={onPreviewImage}
        />
      );
    case "divider":
      return <DividerNode node={node} />;
    default:
      return null;
  }
});

function WaitingLiveIndicator({
  label,
  visible = true,
}: {
  label?: string | null;
  visible?: boolean;
}) {
  return (
    <div className="min-h-[28px] pl-3">
      <div
        className={cx(
          "flex items-center gap-1.5",
          visible ? "animate-in fade-in duration-500" : "invisible",
        )}
      >
        <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden text-gray-500">
          <Lottie animationData={loadingAnimation} loop style={{ width: 20, height: 20 }} className="scale-[0.8]" />
        </div>
        <span className="text-[14px] font-medium tracking-tight text-gray-500">{label ?? ""}</span>
      </div>
    </div>
  );
}

export const ChatTimeline = memo(function ChatTimeline({
  timeline,
  activeRunningToolKey,
  liveIndicatorLabel,
  liveIndicatorVisible = false,
  onCopyText,
  onRetryRun,
  onPreviewImage,
}: ChatTimelineProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, true>>({});
  const latestUserTurnKey = useMemo(() => {
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      const node = timeline[index];
      if (node.kind === "text" && node.tone === "user") {
        return node.key;
      }
    }
    return null;
  }, [timeline]);

  useEffect(() => {
    setExpandedNodeIds({});
  }, [latestUserTurnKey]);

  const handleToggleExpanded = (id: string) => {
    setExpandedNodeIds((current) => {
      if (current[id]) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: true };
    });
  };

  return (
    <div className="flex flex-col">
      <TimelineStack
        items={timeline}
        expandedNodeIds={expandedNodeIds}
        activeRunningToolKey={activeRunningToolKey}
        onToggleExpanded={handleToggleExpanded}
        onCopyText={onCopyText}
        onRetryRun={onRetryRun}
        onPreviewImage={onPreviewImage}
        spaced
      />
      {liveIndicatorVisible ? (
        <div className="pt-2">
          <WaitingLiveIndicator label={liveIndicatorLabel} visible={liveIndicatorVisible} />
        </div>
      ) : null}
    </div>
  );
});
