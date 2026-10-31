import { fx } from "./fx";
import { prefs } from "./prefs";
import { sound } from "./sound";

const WORLDS = ["candy", "rubber"] as const;
export type World = (typeof WORLDS)[number];

// [tile colours, background top, background bottom]
type Palette = [string[], string, string];
export const PALETTES: Record<World, Palette[]> = {
	candy: [
		[
			["#ff5a5f", "#ff9600", "#ffc800", "#58cc02", "#a560ff"],
			"#5fbdf0",
			"#3a8fd6",
		],
		[
			["#1cb0f6", "#58cc02", "#ffb100", "#ff7a1a", "#8f5bff"],
			"#f08cb8",
			"#d95a92",
		],
		[
			["#ff4b6e", "#ff9600", "#1cb0f6", "#a560ff", "#ffb100"],
			"#5cc49c",
			"#239e74",
		],
		[
			["#ff5a5f", "#ffb100", "#58cc02", "#1cb0f6", "#ff7a1a"],
			"#a990f0",
			"#7a56e0",
		],
	],
	rubber: [
		[
			["#ff3d71", "#ffaa00", "#00c48c", "#0095ff", "#8c4bff"],
			"#4cc0dc",
			"#1590d0",
		],
		[
			["#0095ff", "#ff3d71", "#00c48c", "#8c4bff", "#ff6b00"],
			"#ebb93a",
			"#d98800",
		],
		[
			["#00c48c", "#0095ff", "#ffaa00", "#ff3d71", "#8c4bff"],
			"#f07cb0",
			"#d83a76",
		],
	],
};

export let world: World = "candy";
let switched = 0;
let palette = 0;

// drift is ease-in-out cut into n flat steps. The slow ambient loops step on
// one shared 20 Hz grid (durations here, start times snapped), so they need
// 20 new frames a second instead of one per display refresh.
function drift(n: number) {
	const bez = (a: number, b: number, t: number) =>
		3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
	const ease = (x: number) => {
		let lo = 0;
		let hi = 1;
		for (let k = 0; k < 30; k++) {
			const m = (lo + hi) / 2;
			if (bez(0.42, 0.58, m) < x) lo = m;
			else hi = m;
		}
		return bez(0, 1, lo);
	};
	const pts = [];
	for (let i = 0; i < n; i++) {
		const v = i === 0 ? 0 : i === n - 1 ? 1 : ease((i + 0.5) / n);
		pts.push(`${+v.toFixed(4)} ${+((i / n) * 100).toFixed(3)}%`);
		pts.push(`${+v.toFixed(4)} ${+(((i + 1) / n) * 100).toFixed(3)}%`);
	}
	return `linear(${pts})`;
}
const HZ = 20;
const driftRule = document.createElement("style");
driftRule.textContent = `.m-body{animation-timing-function:${drift(1.6 * HZ)}}`;
document.head.append(driftRule);
const STEPPED = new Set(["breathe", "shine"]);
document.addEventListener("animationstart", (e) => {
	if (!STEPPED.has(e.animationName)) return;
	for (const a of (e.target as Element).getAnimations()) {
		const t = a.startTime;
		if (
			a instanceof CSSAnimation &&
			a.animationName === e.animationName &&
			typeof t === "number"
		)
			a.startTime = Math.round((t * HZ) / 1000) * (1000 / HZ);
	}
});

// favicon is the mascot face in the body colour and corner radius of the world.
function favicon(body: string, rx: number) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="50" rx="${rx}" fill="#0004"/><rect x="6" y="10" width="52" height="50" rx="${rx}" fill="${body}" opacity=".6"/><rect x="6" y="4" width="52" height="50" rx="${rx}" fill="${body}"/><circle cx="23" cy="22" r="5" fill="#fff"/><circle cx="41" cy="22" r="5" fill="#fff"/><circle cx="24" cy="23" r="2.4" fill="#3c3c4a"/><circle cx="42" cy="23" r="2.4" fill="#3c3c4a"/><path d="M24 38q8 7 16 0" stroke="#3c3c4a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function paint() {
	const [tiles, bg1, bg2] = PALETTES[world][palette];
	const st = document.documentElement.style;
	for (const [k, c] of tiles.entries()) st.setProperty(`--t${k + 1}`, c);
	st.setProperty("--bg1", bg1);
	st.setProperty("--bg2", bg2);
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", bg2);
	document
		.querySelector('link[rel="icon"]')
		?.setAttribute("href", favicon(tiles[2], world === "rubber" ? 26 : 16));
	fx.colors = [...tiles, "#ffffff"];
}

export function setWorld(next: World) {
	world = next;
	switched = performance.now();
	document.documentElement.dataset.world = next;
	sound.timbre = next;
	fx.world = next;
	palette = Math.floor(Math.random() * PALETTES[next].length);
	paint();
}

// shiftPalette moves to the next colour set of the current world.
export function shiftPalette() {
	palette = (palette + 1) % PALETTES[world].length;
	paint();
}

let iosSwitch: HTMLLabelElement | null = null;

// haptic vibrates on Android; on iOS a click on a hidden switch input gives a
// short tick, the only haptic Safari exposes. Elsewhere that click would move
// focus out of the field being typed in.
const ios =
	navigator.maxTouchPoints > 1 &&
	/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent);

export function haptic(pattern: number | number[] = 10) {
	if (!prefs.get().haptics) return;
	if ("vibrate" in navigator) {
		navigator.vibrate(pattern);
		return;
	}
	if (!ios) return;
	if (!iosSwitch) {
		iosSwitch = document.createElement("label");
		iosSwitch.className = "haptic";
		iosSwitch.ariaHidden = "true";
		iosSwitch.innerHTML = '<input type="checkbox" switch tabindex="-1">';
		document.body.append(iosSwitch);
	}
	iosSwitch.click();
}

export function calm() {
	return (
		prefs.get().calm || matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

export function animate(
	el: Element | null | undefined,
	frames: Keyframe[],
	opts: KeyframeAnimationOptions = {},
) {
	if (!el || calm()) return;
	el.animate(frames, {
		duration: 300,
		easing: "cubic-bezier(.2,.9,.3,1.25)",
		...opts,
	});
}

export function bounce(el: Element | null | undefined, s = 1.15, ms = 320) {
	animate(
		el,
		[
			{ transform: "scale(1)" },
			{ transform: `scale(${s})` },
			{ transform: "scale(1)" },
		],
		{
			duration: ms,
		},
	);
}

export function shake(el: Element | null | undefined, power = 1) {
	animate(
		el,
		[
			{ transform: "translate(0,0)" },
			{ transform: `translate(${-6 * power}px,${3 * power}px)` },
			{ transform: `translate(${5 * power}px,${-4 * power}px)` },
			{ transform: `translate(${-3 * power}px,${2 * power}px)` },
			{ transform: "translate(0,0)" },
		],
		{ duration: 320, easing: "linear" },
	);
}

// floatText pops a short label up from a point and lets it rise and fade.
export function floatText(
	el: Element | null | undefined,
	text: string,
	cls = "",
) {
	if (!el) return;
	const r = el.getBoundingClientRect();
	const f = document.createElement("div");
	f.className = `float ${cls}`;
	f.textContent = text;
	f.style.left = `${r.left + r.width / 2}px`;
	f.style.top = `${r.top + r.height / 2}px`;
	document.body.append(f);
	setTimeout(() => f.remove(), 1000);
}

export type Mood =
	| "idle"
	| "happy"
	| "cheer"
	| "wow"
	| "worried"
	| "sad"
	| "blink"
	| "sleep";

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

// wave lifts each tile of a card in turn, slightly out of step.
export function wave(card: Element | null | undefined, big = false) {
	if (!card || calm()) return;
	for (const [i, t] of card.querySelectorAll(".tile:not(.ghost)").entries())
		t.animate(
			[
				{ translate: "0 0", scale: 1 },
				{ translate: `0 ${big ? -35 : -20}%`, scale: big ? 1.2 : 1.1 },
				{ translate: "0 0", scale: 1 },
			],
			{
				duration: 320,
				delay: i * 50 + Math.random() * 15,
				easing: "cubic-bezier(.3,1.4,.6,1)",
			},
		);
}

// fly sends a label from one element to another, then calls land.
export function fly(
	from: Element | null | undefined,
	to: Element | null | undefined,
	text: string,
	land: () => void,
) {
	if (!from || !to || calm()) return land();
	const a = from.getBoundingClientRect();
	const b = to.getBoundingClientRect();
	const f = document.createElement("div");
	f.className = "float fly";
	f.textContent = text;
	f.style.left = `${a.left + a.width / 2}px`;
	f.style.top = `${a.top + a.height / 2}px`;
	document.body.append(f);
	f.animate(
		[
			{ transform: "scale(.4)" },
			{ transform: "scale(1.2)", offset: 0.3 },
			{
				transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.6)`,
			},
		],
		{ duration: 420, easing: "cubic-bezier(.5,0,.8,.6)" },
	).onfinish = () => {
		f.remove();
		land();
	};
}

function layer(cls: string, ms: number, text = "") {
	const el = document.createElement("div");
	el.className = cls;
	el.ariaHidden = "true";
	el.style.setProperty("--n", `${Math.max(6, text.length)}`);
	if (text)
		el.append(
			Object.assign(document.createElement("b"), { textContent: text }),
		);
	document.body.append(el);
	setTimeout(() => el.remove(), ms);
}

// slam shows a big stamped word across the screen.
export function slam(text: string, cls = "") {
	layer(`slam ${cls}`, 1400, text);
	sound.slam();
	haptic([30, 40, 60]);
}

const CALLOUTS = [
	["Gut!", "Schön!", "Fein!"],
	["Stark!", "Super!", "Klasse!"],
	["Episch!", "Wahnsinn!", "Unglaublich!"],
];

// celebrate climbs the reward ladder; every level holds the one below. A burst
// announces the callout, level 2 adds the cheering mascot and a shake, level 3
// a screen-filling star with a new world at its flash. A world older than 3
// minutes also changes on any level. An afterglow ends it.
export function celebrate(
	level: 1 | 2 | 3,
	text = CALLOUTS[level - 1][Math.floor(Math.random() * 3)],
) {
	fx.burst(innerWidth / 2, innerHeight * 0.45, {
		n: 8 + level * 8,
		speed: 4 + level * 2,
		size: 12,
	});
	setTimeout(() => {
		slam(text, ["clear", "win", "win big"][level - 1]);
		fx.rain(30 * level);
		if (level > 1) {
			mood("cheer", 1600);
			shake(document.body, level - 1);
		}
		if (level > 2 && !calm()) layer("sym", 900);
		if (level > 2 || performance.now() - switched > 180_000)
			setTimeout(() => {
				const others = WORLDS.filter((w) => w !== world);
				setWorld(others[Math.floor(Math.random() * others.length)]);
			}, 250);
		if (!calm()) setTimeout(() => layer("afterglow", 900), 1200);
	}, 150);
}

setWorld(WORLDS[Math.floor(Math.random() * WORLDS.length)]);
