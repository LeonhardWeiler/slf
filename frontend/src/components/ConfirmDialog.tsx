import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
}

// useConfirm resolves true on confirm, false on cancel (Escape, backdrop or the cancel button).
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
	const focusRef = useRef<HTMLButtonElement>(null);
	return (
		<Modal
			role="alertdialog"
			labelledBy="confirm-title"
			describedBy={description ? "confirm-desc" : undefined}
			onClose={onCancel}
			initialFocus={focusRef}
		>
			<h2 id="confirm-title" className="text-lg font-semibold">
				{title}
			</h2>
			{description && (
				<p id="confirm-desc" className="mt-1.5 text-sm text-muted-foreground">
					{description}
				</p>
			)}
			<div className="mt-5 flex gap-2">
				<Button
					ref={destructive ? focusRef : undefined}
					variant="outline"
					className="flex-1"
					onClick={onCancel}
				>
					{cancelLabel}
				</Button>
				<Button
					ref={destructive ? undefined : focusRef}
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
