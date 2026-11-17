import { useEffect, useRef, useState } from "react";

// Counts up from the previous value; prefers-reduced-motion jumps straight to it.
export function CountUp({
	value,
	durationMs = 600,
	className,
}: {
	value: number;
	durationMs?: number;
	className?: string;
}) {
	const [display, setDisplay] = useState(0);
	const fromRef = useRef(0);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		const reduce = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const from = fromRef.current;
		const to = value;
		if (reduce || from === to) {
			fromRef.current = to;
			setDisplay(to);
			return;
		}
		const start = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / durationMs);
			const eased = 1 - (1 - t) ** 3; // easeOutCubic
			setDisplay(Math.round(from + (to - from) * eased));
			if (t < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				fromRef.current = to;
			}
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [value, durationMs]);

	return <span className={className}>{display}</span>;
}
