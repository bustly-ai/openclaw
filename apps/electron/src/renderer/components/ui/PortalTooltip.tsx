import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

type PortalTooltipProps = {
  content: ReactNode;
  children?: ReactNode;
  side?: "top" | "right" | "bottom";
  className?: string;
  triggerClassName?: string;
  open?: boolean;
  anchor?: HTMLElement | null;
  disabled?: boolean;
};

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function resolveTooltipPosition(anchor: DOMRect, side: "top" | "right" | "bottom") {
  if (side === "right") {
    return {
      top: anchor.top + anchor.height / 2,
      left: anchor.right + 12,
      transform: "translateY(-50%)",
      arrowClassName: "top-1/2 -left-1 -translate-y-1/2",
    };
  }
  if (side === "bottom") {
    return {
      top: anchor.bottom + 8,
      left: anchor.left + anchor.width / 2,
      transform: "translateX(-50%)",
      arrowClassName: "-top-1 left-1/2 -translate-x-1/2",
    };
  }
  return {
    top: anchor.top - 8,
    left: anchor.left + anchor.width / 2,
    transform: "translate(-50%, -100%)",
    arrowClassName: "top-full left-1/2 -mt-1.5 -translate-x-1/2",
  };
}

export default function PortalTooltip(props: PortalTooltipProps) {
  const side = props.side ?? "top";
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    transform: string;
    arrowClassName: string;
  } | null>(null);

  const open = props.anchor ? props.open === true : !props.disabled && hovered;

  useEffect(() => {
    if (!open) {
      return;
    }
    const updatePosition = () => {
      const anchor = props.anchor ?? triggerRef.current;
      if (!anchor) {
        return;
      }
      setCoords(resolveTooltipPosition(anchor.getBoundingClientRect(), side));
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, props.anchor, side]);

  const tooltip =
    open && coords
      ? createPortal(
          <div
            className={joinClassNames(
              "fixed z-[20000] rounded-lg bg-[#1A162F] px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white shadow-lg pointer-events-none animate-in fade-in zoom-in-95 duration-200",
              props.className,
            )}
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.transform,
            }}
          >
            {props.content}
            <div className={joinClassNames("absolute h-2 w-2 rotate-45 bg-[#1A162F]", coords.arrowClassName)} />
          </div>,
          document.body,
        )
      : null;

  if (props.anchor) {
    return tooltip;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={props.triggerClassName}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {props.children}
      </span>
      {tooltip}
    </>
  );
}
