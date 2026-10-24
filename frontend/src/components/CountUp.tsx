import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";

// Animates a number counting up to `value` with an ease-out, restarting from the
// previous value whenever it changes. First mount counts up from 0. Honours
// prefers-reduced-motion by jumping straight to the target. `rattle` clicks
// along while the number climbs.
export function CountUp({
	value,
	durationMs = 600,
	rattle = false,
	className,
}: {
	value: number;
	durationMs?: number;
	rattle?: boolean;
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
		let shown = from;
		let clicked = 0;
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / durationMs);
			const eased = 1 - (1 - t) ** 3; // easeOutCubic
			const n = Math.round(from + (to - from) * eased);
			if (rattle && n > shown && now - clicked > 45) {
				sound.count(t);
				clicked = now;
			}
			shown = n;
			fromRef.current = n;
			setDisplay(n);
			if (t < 1) rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [value, durationMs, rattle]);

	return <span className={className}>{display}</span>;
}
