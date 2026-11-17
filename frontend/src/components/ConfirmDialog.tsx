import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
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
	return (
		<Modal
			role="alertdialog"
			labelledBy="confirm-title"
			describedBy={description ? "confirm-desc" : undefined}
			onClose={onCancel}
			initialFocus={confirmRef}
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
		</Modal>
	);
}
