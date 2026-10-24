import { fx } from "./fx";
import { prefs } from "./prefs";
import { sound } from "./sound";

export const WORLDS = ["candy", "rubber"] as const;
export type World = (typeof WORLDS)[number];

// [tile colours, background top, background bottom]
type Palette = [string[], string, string];
const PALETTES: Record<World, Palette[]> = {
	candy: [
		[
			["#ff5a5f", "#ff9600", "#ffc800", "#58cc02", "#a560ff"],
			"#8fd8ff",
			"#46a8f2",
		],
		[
			["#1cb0f6", "#58cc02", "#ffb100", "#ff7a1a", "#8f5bff"],
			"#ffc0da",
			"#ff80b3",
		],
		[
			["#ff4b6e", "#ff9600", "#1cb0f6", "#a560ff", "#ffb100"],
			"#9af2cf",
			"#33cc98",
		],
		[
			["#ff5a5f", "#ffb100", "#58cc02", "#1cb0f6", "#ff7a1a"],
			"#cdb3ff",
			"#9370ff",
		],
	],
	rubber: [
		[
			["#ff3d71", "#ffaa00", "#00c48c", "#0095ff", "#8c4bff"],
			"#7ee8fa",
			"#1cb0f6",
		],
		[
			["#0095ff", "#ff3d71", "#00c48c", "#8c4bff", "#ff6b00"],
			"#ffe066",
			"#ffb100",
		],
		[
			["#00c48c", "#0095ff", "#ffaa00", "#ff3d71", "#8c4bff"],
			"#ff9ecb",
			"#ff4b8b",
		],
	],
};

let world: World = "candy";
let palette = 0;

// drift is ease-in-out cut into n flat steps of a third of a pixel each; a
// background blob needs a new frame per step, not per display refresh.
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
const driftRule = document.createElement("style");
driftRule.textContent = `.bg i{animation-timing-function:${drift(240)}}`;
document.head.append(driftRule);

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
	if (next === world && document.documentElement.dataset.world) return;
	world = next;
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

export function worldFor(seed: string, round: number): World {
	let h = 0;
	for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
	return WORLDS[(Math.abs(h) + round) % WORLDS.length];
}

let iosSwitch: HTMLLabelElement | null = null;

// haptic vibrates on Android; on iOS a click on a hidden switch input gives a
// short tick, the only haptic Safari exposes.
export function haptic(pattern: number | number[] = 10) {
	if (!prefs.get().haptics) return;
	if ("vibrate" in navigator) {
		navigator.vibrate(pattern);
		return;
	}
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

// slam shows a big stamped word across the screen.
export function slam(text: string, cls = "") {
	const el = document.createElement("div");
	el.className = `slam ${cls}`;
	el.ariaHidden = "true";
	el.innerHTML = "<b></b>";
	(el.firstChild as HTMLElement).textContent = text;
	document.body.append(el);
	sound.slam();
	haptic([30, 40, 60]);
	setTimeout(() => el.remove(), 1100);
}
