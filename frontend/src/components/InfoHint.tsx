import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

// A small "?" icon that reveals an explanatory hint. On desktop it opens on
// hover/focus; on touch it toggles on tap. Escape, an outside tap or blur close
// it again. Kept dependency-free (no positioning lib): the panel is anchored
// centred under the icon with a viewport-capped width so it never overflows.
export function InfoHint({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover is mouse-only sugar; keyboard uses focus/blur and touch uses click on the button below
    <span
      ref={wrapRef}
      className="relative inline-flex"
      // Hover keeps it open across the whole wrapper (icon + panel), so moving
      // onto the panel doesn't dismiss it on desktop.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-md border border-border bg-card p-3 text-xs font-normal leading-relaxed text-muted-foreground shadow-md"
        >
          {children}
        </span>
      )}
    </span>
  );
}
