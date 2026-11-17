import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, type Toast, type ToastVariant } from "@/store/toast";

const AUTO_DISMISS_MS = 3000;

// How many toasts behind the front one peek out to signal "there are more".
const MAX_PEEK = 3;

const VARIANTS: Record<
	ToastVariant,
	{ peek: string; front: string; Icon: typeof AlertTriangle }
> = {
	error: {
		peek: "border-destructive/40 bg-destructive/10",
		front:
			"border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
		Icon: AlertTriangle,
	},
	info: {
		peek: "border-border bg-card/90",
		front: "border-border bg-card/95 text-foreground hover:bg-muted",
		Icon: Info,
	},
};

function FrontToast({ toast }: { toast: Toast }) {
	const dismiss = useToastStore((s) => s.dismissToast);
	const [paused, setPaused] = useState(false);
	const { front, Icon } = VARIANTS[toast.variant];

	useEffect(() => {
		if (paused) return;
		const t = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
		return () => clearTimeout(t);
	}, [toast.id, dismiss, paused]);

	return (
		<button
			type="button"
			onClick={() => dismiss(toast.id)}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
			title="Schließen"
			className={`pointer-events-auto relative flex w-full items-start gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm shadow-lg backdrop-blur transition-colors animate-toast-in ${front}`}
		>
			<Icon className="mt-0.5 h-4 w-4 shrink-0" />
			<span className="flex-1">{toast.message}</span>
			<span
				aria-hidden="true"
				style={{
					animationDuration: `${AUTO_DISMISS_MS}ms`,
					animationPlayState: paused ? "paused" : "running",
				}}
				className="toast-progress absolute inset-x-0 bottom-0 h-0.5 bg-current opacity-30"
			/>
		</button>
	);
}

export function Toaster() {
	const toasts = useToastStore((s) => s.toasts);
	const clearToasts = useToastStore((s) => s.clearToasts);

	const front = toasts.at(-1);
	const behind = toasts
		.slice(Math.max(0, toasts.length - 1 - MAX_PEEK), toasts.length - 1)
		.reverse();

	return (
		// Only the front toast is read out. The region stays mounted while empty: one that appears with its first toast is often not announced.
		<div
			aria-live={front?.variant === "error" ? "assertive" : "polite"}
			className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex w-full max-w-sm flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
		>
			{toasts.length > 1 && (
				<button
					type="button"
					onClick={clearToasts}
					className="pointer-events-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
				>
					Alle schließen ({toasts.length}) <X className="h-3 w-3" />
				</button>
			)}

			{front && (
				<div className="relative w-full">
					{behind.map((t, i) => {
						const depth = i + 1;
						return (
							<div
								key={t.id}
								aria-hidden="true"
								className={`absolute inset-0 rounded-lg border shadow-lg backdrop-blur ${VARIANTS[t.variant].peek}`}
								style={{
									transform: `translateY(${depth * 7}px) scale(${1 - depth * 0.05})`,
									transformOrigin: "top center",
									opacity: 1 - depth * 0.2,
									zIndex: -depth,
								}}
							/>
						);
					})}
					<FrontToast key={front.id} toast={front} />
				</div>
			)}
		</div>
	);
}
