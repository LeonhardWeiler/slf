import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { sound } from "@/lib/sound";

// Count of currently-open modals. Global keyboard shortcuts on the game screens
// (Enter to start the next round / buzz, Ctrl/Cmd+C to copy the code) query
// this and pause while a modal is up, so confirming a dialog with Enter doesn't
// also trigger the action behind it.
let openModals = 0;
export function isModalOpen(): boolean {
	return openModals > 0;
}

interface ModalProps {
	role: "dialog" | "alertdialog";
	labelledBy: string;
	describedBy?: string;
	onClose: () => void;
	// Receives focus on open; defaults to the first focusable element.
	initialFocus?: RefObject<HTMLElement | null>;
	children: ReactNode;
}

// Modal is the shared dialog shell: it focuses into the dialog on open, locks
// body scroll, traps Tab inside, closes on Escape and backdrop click, and on
// close returns focus to where it came from.
export function Modal({
	role,
	labelledBy,
	describedBy,
	onClose,
	initialFocus,
	children,
}: ModalProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only; onClose is read through a ref
	useEffect(() => {
		const returnFocusTo = document.activeElement as HTMLElement | null;
		const focusables = () =>
			dialogRef.current?.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			) ?? [];
		(initialFocus?.current ?? focusables()[0])?.focus();
		openModals++;
		sound.hush(true);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				onCloseRef.current();
				return;
			}
			if (e.key !== "Tab") return;
			const all = focusables();
			if (all.length === 0) return;
			const first = all[0];
			const last = all[all.length - 1];
			const active = document.activeElement;
			if (
				e.shiftKey &&
				(active === first || !dialogRef.current?.contains(active))
			) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			openModals--;
			sound.hush(openModals > 0);
			// A dialog that removed its own trigger (kicking the player whose row
			// opened it) leaves a detached node; focusing that would be worse
			// than doing nothing.
			if (returnFocusTo?.isConnected) returnFocusTo.focus();
		};
	}, []);

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: mouse-only backdrop-to-close; keyboard is covered by the Escape handler
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is optional mouse sugar - Escape closes via the window listener above
		<div
			className="modal-back"
			onClick={(e) => {
				if (e.target === e.currentTarget) onCloseRef.current();
			}}
		>
			{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is always dialog or alertdialog, which support aria-modal */}
			<div
				ref={dialogRef}
				role={role}
				aria-modal="true"
				aria-labelledby={labelledBy}
				aria-describedby={describedBy}
				className="modal"
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}
