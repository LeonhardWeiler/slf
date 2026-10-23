import { useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { sound } from "@/lib/sound";
import { useToastStore, type Toast } from "@/store/toast";

const AUTO_DISMISS_MS = 3500;

function ToastView({ toast }: { toast: Toast }) {
	const dismiss = useToastStore((s) => s.dismissToast);
	useEffect(() => {
		if (toast.variant === "error") sound.nope();
		else sound.pop();
		const t = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
		return () => clearTimeout(t);
	}, [toast.id, toast.variant, dismiss]);
	const Icon = toast.variant === "error" ? AlertTriangle : Info;
	return (
		<button
			type="button"
			className={`toast ${toast.variant}`}
			onClick={() => dismiss(toast.id)}
		>
			<Icon />
			<span>{toast.message}</span>
		</button>
	);
}

// Toasts stack top-centre, newest last; a tap dismisses one.
export function Toaster() {
	const toasts = useToastStore((s) => s.toasts);
	const front = toasts.at(-1);
	return (
		<div
			className="toasts"
			aria-live={front?.variant === "error" ? "assertive" : "polite"}
		>
			{toasts.slice(-3).map((t) => (
				<ToastView key={t.id} toast={t} />
			))}
		</div>
	);
}
