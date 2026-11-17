import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

// Pass `trigger` to make a visible label part of the hover/click target.
export function InfoHint({
	label,
	trigger,
	children,
}: {
	label: string;
	trigger?: React.ReactNode;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLSpanElement>(null);
	const [shift, setShift] = useState(0);
	const id = useId();

	useLayoutEffect(() => {
		if (!open) {
			setShift(0);
			return;
		}
		function fitToViewport() {
			const el = panelRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const margin = 8;
			let correction = 0;
			if (rect.left < margin) correction = margin - rect.left;
			else if (rect.right > window.innerWidth - margin)
				correction = window.innerWidth - margin - rect.right;
			// Add to the current shift (the rect already reflects any applied shift).
			if (correction !== 0) setShift((prev) => prev + correction);
		}
		fitToViewport();
		window.addEventListener("resize", fitToViewport);
		return () => window.removeEventListener("resize", fitToViewport);
	}, [open]);

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
			className="group relative inline-flex"
			// Hover keeps it open across the whole wrapper (icon + panel), so moving
			// onto the panel doesn't dismiss it on desktop.
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
		>
			<button
				type="button"
				aria-label={trigger ? undefined : label}
				aria-expanded={open}
				aria-describedby={open ? id : undefined}
				onClick={() => setOpen((v) => !v)}
				onFocus={(e) => {
					if (e.currentTarget.matches(":focus-visible")) setOpen(true);
				}}
				onBlur={() => setOpen(false)}
				className="inline-flex items-center gap-1.5 rounded text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{trigger != null && (
					<span className="text-sm font-medium text-foreground">{trigger}</span>
				)}
				<HelpCircle className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
			</button>
			{open && (
				<span
					ref={panelRef}
					role="tooltip"
					id={id}
					style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
					className="absolute left-1/2 bottom-full z-50 mb-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-card p-3 text-xs font-normal leading-relaxed text-muted-foreground shadow-md before:absolute before:inset-x-0 before:top-full before:h-2"
				>
					{children}
				</span>
			)}
		</span>
	);
}
