import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Brain, CaretDown, Check } from "@phosphor-icons/react";
import PortalTooltip from "../ui/PortalTooltip";

export type ChatModelOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

type ChatModelPickerProps<T extends string> = {
  value: T;
  options: readonly ChatModelOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ChatModelPicker<T extends string>(props: ChatModelPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(
    () => props.options.find((entry) => entry.id === props.value) ?? props.options[0],
    [props.options, props.value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const syncMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportPadding = 12;
      const gap = 4;
      const width = 320;
      const desiredMaxHeight = 280;
      const estimatedMenuHeight = Math.min(
        desiredMaxHeight,
        props.options.length * 78 + Math.max(0, props.options.length - 1) * 4 + 16,
      );
      let left = rect.left;

      if (left + width + viewportPadding > window.innerWidth) {
        left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
      } else {
        left = Math.max(viewportPadding, left);
      }

      const spaceBelow = window.innerHeight - (rect.bottom + gap) - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const shouldOpenUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableHeight = shouldOpenUp ? spaceAbove - gap : spaceBelow;
      const maxHeight = Math.max(180, Math.min(desiredMaxHeight, availableHeight));
      const measuredMenuHeight = menuRef.current?.scrollHeight || estimatedMenuHeight;
      const menuHeight = Math.min(measuredMenuHeight, maxHeight);
      const top = shouldOpenUp
        ? Math.max(viewportPadding, rect.top - gap - menuHeight)
        : rect.bottom + gap;

      setMenuPos({ top, left, width, maxHeight });
    };

    syncMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, props.options.length]);

  useEffect(() => {
    if (!props.disabled) {
      return;
    }
    setOpen(false);
    setTooltipOpen(false);
  }, [props.disabled]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={props.disabled}
        onClick={() => {
          setTooltipOpen(false);
          setOpen((previous) => !previous);
        }}
        onMouseEnter={() => {
          if (!props.disabled && !open) {
            setTooltipOpen(true);
          }
        }}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => {
          if (!props.disabled && !open) {
            setTooltipOpen(true);
          }
        }}
        onBlur={() => setTooltipOpen(false)}
        className={joinClassNames(
          "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1A162F] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DDE1F4]",
          props.disabled ? "cursor-not-allowed opacity-50" : open ? "bg-[#F4F5FA]" : "hover:bg-[#F4F5FA]",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Brain size={14} weight="bold" className="shrink-0 text-current" />
        <span className="max-w-[176px] truncate sm:max-w-[208px]">{selectedOption?.label}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={joinClassNames("shrink-0 text-[#666F8D] transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <PortalTooltip
        anchor={triggerRef.current}
        open={tooltipOpen}
        disabled={props.disabled}
        offset={10}
        content="Choose a model for this message."
        className="max-w-[220px] rounded-xl bg-[#1F1F23] px-3 py-2 text-xs leading-5 whitespace-normal shadow-[0_12px_32px_rgba(0,0,0,0.22)]"
        arrowClassName="bg-[#1F1F23]"
      />

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[10050] rounded-2xl border border-[#EAEAEA] bg-white p-2 shadow-[0_20px_48px_rgba(26,22,47,0.14)]"
              style={{
                top: menuPos?.top ?? -9999,
                left: menuPos?.left ?? -9999,
                width: menuPos?.width ?? 320,
                visibility: menuPos ? "visible" : "hidden",
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div
                style={{ maxHeight: menuPos?.maxHeight ?? 280 }}
                className="custom-scrollbar flex flex-col gap-1 overflow-y-auto"
              >
                {props.options.map((option) => {
                  const selected = option.id === props.value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        props.onChange(option.id);
                        setOpen(false);
                      }}
                      className={joinClassNames(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                        selected
                          ? "bg-[#F4F4F8] text-[#1A162F] shadow-sm"
                          : "text-[#666F8D] hover:bg-[#F8F8FB] hover:text-[#1A162F]",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{option.label}</span>
                          {selected ? <Check size={15} weight="bold" className="shrink-0 text-[#1A162F]" /> : null}
                        </div>
                        <p className="mt-0.5 pr-6 text-xs leading-5 text-[#666F8D]">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
