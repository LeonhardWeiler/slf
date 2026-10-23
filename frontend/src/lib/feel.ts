import { fx } from "./fx";
import { prefs } from "./prefs";
import { sound } from "./sound";

export const WORLDS = ["candy", "wood", "rubber", "paper"] as const;
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
	wood: [
		[
			["#d9663a", "#c9a227", "#5f9e4b", "#3d7fb8", "#a64d79"],
			"#f7dcae",
			"#d9a066",
		],
		[
			["#c4552d", "#e0b340", "#4f8f6f", "#6a5acd", "#d17a22"],
			"#d7ecc4",
			"#8fbf6a",
		],
		[
			["#b8432e", "#d9a21b", "#2f7f8f", "#8a5a9e", "#5f9e4b"],
			"#ffe0c2",
			"#e8935a",
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
	paper: [
		[
			["#ef6f6c", "#f4a259", "#5b8e7d", "#7d8cc4", "#bc4b51"],
			"#fdf3e1",
			"#f2d7b6",
		],
		[
			["#e76f51", "#2a9d8f", "#e9c46a", "#6d6875", "#f4a261"],
			"#e3f1fb",
			"#a9cfee",
		],
		[
			["#5b8e7d", "#ef6f6c", "#7d8cc4", "#f4a259", "#bc4b51"],
			"#fde2e4",
			"#f5a3b0",
		],
	],
};

let world: World = "candy";
let palette = 0;

function paint() {
	const [tiles, bg1, bg2] = PALETTES[world][palette];
	const st = document.documentElement.style;
	for (const [k, c] of tiles.entries()) st.setProperty(`--t${k + 1}`, c);
	st.setProperty("--bg1", bg1);
	st.setProperty("--bg2", bg2);
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", bg2);
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
