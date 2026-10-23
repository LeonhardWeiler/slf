import {
	type ButtonHTMLAttributes,
	type ComponentProps,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { fx } from "@/lib/fx";
import { bounce, haptic } from "@/lib/feel";
import { sound } from "@/lib/sound";
import { mapCase } from "@/lib/answerValidation";

type BtnProps = ComponentProps<"button"> & {
	kind?: "primary" | "ghost" | "danger" | "stop" | "next" | "";
};

export function Btn({ kind = "", className = "", ...p }: BtnProps) {
	return <button type="button" className={`btn ${kind} ${className}`} {...p} />;
}

// IconBtn carries its meaning only in `tip`: aria-label and the hover/long-press
// tooltip of the Shell.
export function IconBtn({
	tip,
	className = "",
	...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { tip: string }) {
	return (
		<button
			type="button"
			className={`icon-btn ${className}`}
			aria-label={tip}
			data-tip={tip}
			{...p}
		/>
	);
}

export function Toggle({
	on,
	tip,
	onChange,
	children,
	disabled,
}: {
	on: boolean;
	tip: string;
	onChange: (on: boolean) => void;
	children: ReactNode;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className="toggle"
			aria-pressed={on}
			aria-label={tip}
			data-tip={tip}
			disabled={disabled}
			onClick={(e) => {
				onChange(!on);
				bounce(e.currentTarget, 1.15);
				if (!on) sound.pop();
				haptic(on ? 8 : [10, 30, 10]);
			}}
		>
			{children}
		</button>
	);
}

// Slider snaps to `steps` and gives a tick, a bubble pop and a haptic per step;
// hitting either end wiggles.
export function Slider<T>({
	steps,
	value,
	onChange,
	format,
	label,
	disabled,
}: {
	steps: readonly T[];
	value: T;
	onChange: (v: T) => void;
	format: (v: T) => string;
	label: string;
	disabled?: boolean;
}) {
	const found = steps.indexOf(value);
	const [idx, setIdx] = useState(found < 0 ? 0 : found);
	const [hit, setHit] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const dragging = useRef(false);
	useEffect(() => {
		if (!dragging.current && found >= 0) setIdx(found);
	}, [found]);
	const last = steps.length - 1;
	function move(i: number) {
		if (i === idx) return;
		setIdx(i);
		sound.tick(i);
		haptic(6);
		setHit(true);
		setTimeout(() => setHit(false), 120);
		if (i === 0 || i === last)
			bounce(box.current?.querySelector("output"), 1.4);
	}
	function commit() {
		dragging.current = false;
		if (steps[idx] !== value) onChange(steps[idx]);
	}
	return (
		<div
			ref={box}
			className={`slider${hit ? " hit" : ""}`}
			style={{ "--f": last ? idx / last : 0 } as React.CSSProperties}
		>
			<output aria-hidden="true">{format(steps[idx])}</output>
			<input
				type="range"
				min={0}
				max={last}
				step={1}
				value={idx}
				disabled={disabled}
				aria-label={label}
				aria-valuetext={format(steps[idx])}
				onPointerDown={() => {
					dragging.current = true;
				}}
				onChange={(e) => move(Number(e.target.value))}
				onPointerUp={commit}
				onKeyUp={commit}
				onBlur={commit}
			/>
			<div className="ticks" aria-hidden="true">
				{steps.map((s, i) => (
					<i key={String(s)} className={i <= idx ? "on" : ""} />
				))}
			</div>
		</div>
	);
}

export function Seg<T extends string | number>({
	options,
	value,
	onChange,
	label,
}: {
	options: { v: T; label: ReactNode; tip: string }[];
	value: T;
	onChange: (v: T) => void;
	label: string;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons
		<div className="seg" role="group" aria-label={label}>
			{options.map((o) => (
				<button
					key={o.v}
					type="button"
					aria-pressed={o.v === value}
					aria-label={o.tip}
					data-tip={o.tip}
					onClick={(e) => {
						onChange(o.v);
						bounce(e.currentTarget, 1.12);
					}}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

const MOODS = [
	"idle",
	"happy",
	"cheer",
	"wow",
	"worried",
	"sad",
	"blink",
	"sleep",
] as const;
export type Mood = (typeof MOODS)[number];

let moodTimer = 0;
// mood sets every mascot's face for `ms`, then each falls back to its own base.
export function mood(m: Mood, ms = 1100) {
	clearTimeout(moodTimer);
	const all = document.querySelectorAll<HTMLElement>(".mascot");
	for (const el of all) el.dataset.mood = m;
	if (ms)
		moodTimer = window.setTimeout(() => {
			for (const el of all) el.dataset.mood = el.dataset.base;
		}, ms);
}

export function hop(el: Element | null | undefined, h = 18) {
	el?.animate(
		[
			{ transform: "translateY(0) scale(1)" },
			{ transform: "translateY(4px) scale(1.12,.86)", offset: 0.15 },
			{ transform: `translateY(${-h}px) scale(.94,1.08)`, offset: 0.5 },
			{ transform: "translateY(2px) scale(1.08,.92)", offset: 0.85 },
			{ transform: "translateY(0) scale(1)" },
		],
		{ duration: 520, easing: "ease-out" },
	);
}

export function Mascot({
	letter = "",
	size = "",
	base = "idle",
	onPoke,
}: {
	letter?: ReactNode;
	size?: "" | "big" | "huge" | "letter";
	base?: Mood;
	onPoke?: () => void;
}) {
	return (
		<div
			className={`mascot ${size}`}
			data-mood={base}
			data-base={base}
			aria-hidden="true"
			onPointerDown={(e) => {
				hop(e.currentTarget, 26);
				mood("happy", 900);
				sound.pop();
				haptic(10);
				fx.at(e.currentTarget, { n: 12, speed: 6 });
				onPoke?.();
			}}
		>
			<div className="m-body">
				<span className="m-eyes">
					<i>
						<b />
					</i>
					<i>
						<b />
					</i>
				</span>
				<span className="m-mouth" />
				<span className="m-letter">{letter}</span>
				<span className="m-drop" />
			</div>
			<span className="m-shadow" />
		</div>
	);
}

// Tiles renders a word as game pieces; the lead tile (first, or last in
// last-letter mode) turns gold when it matches the round letter, grey when not.
export function Tiles({
	value,
	letter = "",
	last = false,
	max = 36,
	live = false,
	ghost,
	className = "",
}: {
	value: string;
	letter?: string;
	last?: boolean;
	max?: number;
	live?: boolean;
	ghost?: string;
	className?: string;
}) {
	const box = useRef<HTMLDivElement>(null);
	const chars = [...value];
	const prev = useRef<string[]>([]);
	const [size, setSize] = useState(max);
	useLayoutEffect(() => {
		const w = box.current?.clientWidth || 260;
		const n = Math.max(1, chars.length);
		setSize(Math.max(13, Math.min(max, Math.floor((w - 4 * (n - 1)) / n))));
	}, [chars.length, max]);
	useEffect(() => {
		if (live && chars.length < prev.current.length) {
			const tiles = box.current?.querySelectorAll(".tile:not(.ghost)");
			const lastTile = tiles?.[tiles.length - 1];
			if (lastTile) {
				const r = lastTile.getBoundingClientRect();
				fx.burst(r.right + size / 2, r.top + r.height / 2, {
					n: 5,
					speed: 3,
					size: 5,
				});
			}
			sound.poof();
		}
		prev.current = chars;
	});
	const lead = last ? chars.length - 1 : 0;
	const nonSpace = chars.findIndex((c) => c !== " ");
	return (
		<div
			ref={box}
			className={`tiles ${chars.length ? "" : "empty"} ${className}`}
			style={{ "--s": `${size}px` } as React.CSSProperties}
		>
			{ghost !== undefined && <span className="tile ghost">{ghost}</span>}
			{chars.map((c, i) => {
				const isLead = letter !== "" && i === (last ? lead : nonSpace);
				const hit = isLead && mapCase(c, true) === letter;
				const fresh = live && i >= prev.current.length;
				return (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: a tile is its position
						key={i}
						className={`tile${c === " " ? " space" : ""}${fresh ? " in" : ""}${hit ? " lead" : ""}${isLead && !hit ? " bad" : ""}`}
						style={
							{
								"--c": `var(--t${(i % 5) + 1})`,
								"--rot": `${((i * 37) % 9) - 4}deg`,
							} as React.CSSProperties
						}
					>
						{isLead && !last ? mapCase(c, true) : c}
					</span>
				);
			})}
			{live && <span className="caret" />}
		</div>
	);
}

const COLORS = [
	"#ff5a5f",
	"#1cb0f6",
	"#58cc02",
	"#ff9600",
	"#a560ff",
	"#ff4b8b",
	"#00c2a8",
	"#ffb100",
];

export function playerColor(id: string) {
	let h = 0;
	for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
	return COLORS[Math.abs(h) % COLORS.length];
}

export function Av({
	id,
	name,
	size = "",
	children,
	className = "",
}: {
	id: string;
	name: string;
	size?: "" | "sm" | "big";
	children?: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={`av ${size} ${className}`}
			style={{ "--pc": playerColor(id) } as React.CSSProperties}
			data-tip={name}
		>
			{children ?? [...name][0]}
		</span>
	);
}

export function CodeTiles({ code, small }: { code: string; small?: boolean }) {
	return (
		<span
			className={`code${small ? " small" : ""}`}
			role="img"
			aria-label={`Code ${code}`}
		>
			{[...code].map((c, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: a code letter is its position
					key={i}
					style={{ "--c": `var(--t${(i % 5) + 1})` } as React.CSSProperties}
				>
					{c}
				</span>
			))}
		</span>
	);
}

// useIdle is true after `ms` without pointer, key or touch input.
export function useIdle(ms: number) {
	const [idle, setIdle] = useState(false);
	useEffect(() => {
		let t = 0;
		const wake = () => {
			setIdle(false);
			clearTimeout(t);
			t = window.setTimeout(() => setIdle(true), ms);
		};
		wake();
		const evs = ["pointermove", "pointerdown", "keydown", "scroll"] as const;
		for (const e of evs) addEventListener(e, wake, { passive: true });
		return () => {
			clearTimeout(t);
			for (const e of evs) removeEventListener(e, wake);
		};
	}, [ms]);
	return idle;
}
