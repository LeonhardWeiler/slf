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

  // Focus the confirm button on open and let Escape cancel.
  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only backdrop-to-cancel; keyboard is fully covered by the global Escape handler and the cancel button
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is optional mouse sugar — Escape closes via the window listener above
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        // Cancel only on a click on the backdrop itself, not one bubbling up
        // from inside the dialog.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id="confirm-desc" className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
