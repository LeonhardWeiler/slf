import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Renders the confirm button in the destructive (red) style.
  destructive?: boolean;
}

// useConfirm returns a promise-based `confirm(opts)` and the `dialog` element to
// render once in the component. `confirm` resolves true on confirm, false on
// cancel (Escape, backdrop click or the cancel button). Keeps destructive
// actions (kick, delete, leave) behind an explicit, accessible confirmation
// instead of firing on a single stray tap.
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(options);
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = opts ? (
    <ConfirmDialogView
      {...opts}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, dialog };
}

// Count of currently-open confirm dialogs. Global keyboard shortcuts on the game
// screens (Enter to start the next round / buzz, Ctrl/Cmd+C to copy the code)
// query this and pause while a modal is up, so confirming a dialog with Enter
// doesn't also trigger the action behind it (UX-1).
let openDialogs = 0;
export function isConfirmDialogOpen(): boolean {
  return openDialogs > 0;
}

function ConfirmDialogView({
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the confirm button on open, lock body scroll so the page behind can't
  // move while the dialog is up, mark a dialog as open (so global screen
  // shortcuts pause, UX-1), trap Tab focus inside the dialog (A11Y-1) and let
  // Escape cancel.
  useEffect(() => {
    confirmRef.current?.focus();
    openDialogs++;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      // Keep Tab focus cycling inside the modal instead of escaping to the
      // (visually obscured) content behind it.
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openDialogs--;
    };
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only backdrop-to-cancel; keyboard is fully covered by the global Escape handler and the cancel button
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is optional mouse sugar — Escape closes via the window listener above
    <div
      className="fixed inset-0 z-[60] m-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        // Cancel only on a click on the backdrop itself, not one bubbling up
        // from inside the dialog.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className="w-full max-w-sm max-h-[calc(100svh-2rem)] overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id="confirm-desc" className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {/* Both buttons share the full width 50/50; cancel carries the same
            outline border as the confirm button so the pair reads as one bar. */}
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "default"}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
