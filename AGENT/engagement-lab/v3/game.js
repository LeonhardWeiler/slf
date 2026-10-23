const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};
const esc = (s) =>
	String(s).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
const upper = (c) => c.toLocaleUpperCase("de-DE");
const norm = (w) =>
	w
		.trim()
		.toLocaleLowerCase("de-DE")
		.replace(/[^\p{L}]/gu, "");
const ruleValid = (w, letter) => {
	const chars = [...w.trim()];
	return chars.length >= 2 && upper(chars[0]) === letter;
};
const reduced = () => document.body.classList.contains("reduced");

const ICONS = {
	city: '<path d="M3 21h18M5 21V9l5-3v15M10 21V3l9 4v14M13.5 10h2.5M13.5 14h2.5M13.5 18h2.5M7 12h1M7 16h1"/>',
	globe:
		'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"/>',
	river:
		'<path d="M3 7.5c3-2 5 2 9 0s6-2 9 0M3 12.5c3-2 5 2 9 0s6-2 9 0M3 17.5c3-2 5 2 9 0s6-2 9 0"/>',
	paw: '<path d="M7.5 15c0-2 2-3.8 4.5-3.8s4.5 1.8 4.5 3.8c0 2.4-2 3.5-4.5 3.5s-4.5-1.1-4.5-3.5z"/><circle cx="5.8" cy="10.2" r="1.7"/><circle cx="9.3" cy="6.4" r="1.7"/><circle cx="14.7" cy="6.4" r="1.7"/><circle cx="18.2" cy="10.2" r="1.7"/>',
	hand: '<path d="M7 12.5V6.5a1.5 1.5 0 0 1 3 0V11M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-5-2.7L4 14.6a1.6 1.6 0 0 1 2.6-1.8L7 13.4"/>',
	sound:
		'<path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
	mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5"/>',
	rate: '<path d="M4 20h16M7 16v-5M12 16V5M17 16v-8"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	x: '<path d="M6 6l12 12M18 6L6 18"/>',
	crown: '<path d="M4 18.5h16M5 16l-1.5-9 5 4L12 5l3.5 6 5-4-1.5 9z"/>',
	flame:
		'<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.7 2 1.6 3 2.9 3.6C12 7.6 13 5 15 3c.4 3.6 3.5 6 3.5 11.2C18.5 18.4 16 21 12 21z"/>',
	bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
	skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
	grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
	down: '<path d="M10 14H5.5A2.5 2.5 0 0 1 3 11.2l1-6A2.5 2.5 0 0 1 6.5 3H15v10l-3.5 7.5A2 2 0 0 1 9 18.5zM15 3h4v10h-4"/>',
	arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
	star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
	equal: '<path d="M5 9h14M5 15h14"/>',
};
const icon = (name) =>
	`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const CATS = [
	{ name: "Stadt", icon: "city" },
	{ name: "Land", icon: "globe" },
	{ name: "Fluss", icon: "river" },
	{ name: "Tier", icon: "paw" },
];
const BANK = {
	M: [
		"München Madrid Mailand Mainz",
		"Mexiko Marokko Malta Mali",
		"Main Mosel Mississippi Mur",
		"Maus Marder Möwe Maulwurf",
		[1, "Mallorca"],
	],
	B: [
		"Berlin Bremen Basel Bonn",
		"Belgien Brasilien Bulgarien",
		"Bode Brahmaputra Bober",
		"Bär Biber Biene Büffel",
		[1, "Bayern"],
	],
	S: [
		"Salzburg Stuttgart Sevilla",
		"Schweden Spanien Syrien",
		"Spree Saale Seine Salzach",
		"Schaf Schlange Specht",
		[1, "Sahara"],
	],
	K: [
		"Köln Kiel Kairo Klagenfurt",
		"Kanada Kenia Kroatien",
		"Kongo Kocher Kinzig",
		"Katze Kuh Krokodil Kamel",
		[1, "Kärnten"],
	],
	R: [
		"Rom Rostock Riga",
		"Russland Rumänien Ruanda",
		"Rhein Rhône Ruhr",
		"Rabe Reh Robbe",
		[1, "Rügen"],
	],
	L: [
		"Linz Lissabon London Leipzig",
		"Lettland Litauen Luxemburg",
		"Lech Loire Lahn",
		"Löwe Luchs Lama",
		[1, "Lappland"],
	],
	H: [
		"Hamburg Hannover Helsinki",
		"Haiti Honduras Hongkong",
		"Havel Hudson Hase",
		"Hund Hase Hirsch",
		[1, "Holland"],
	],
	D: [
		"Dresden Dublin Düsseldorf",
		"Dänemark Deutschland Dominica",
		"Donau Drau Dnepr",
		"Dachs Delfin Dohle",
		[3, "Drache"],
	],
	W: [
		"Wien Warschau Weimar",
		"Weißrussland Wales",
		"Weser Wolga Werra",
		"Wolf Wal Wiesel",
		[3, "Wolpertinger"],
	],
	T: [
		"Tokio Trier Toronto",
		"Türkei Tschechien Tunesien",
		"Themse Tiber Tajo",
		"Tiger Taube Thunfisch",
		[1, "Tirol"],
	],
	G: [
		"Graz Genf Göttingen",
		"Griechenland Georgien Ghana",
		"Ganges Garonne Gail",
		"Gans Giraffe Gorilla",
		[1, "Grönland"],
	],
	E: [
		"Essen Erfurt Edinburgh",
		"Estland Ecuador Eritrea",
		"Elbe Ems Euphrat",
		"Esel Elch Eule",
		[1, "England"],
	],
	P: [
		"Paris Prag Potsdam",
		"Polen Peru Portugal",
		"Po Pegnitz Pripjat",
		"Pinguin Pferd Puma",
		[3, "Pegasus"],
	],
	N: [
		"Nürnberg Neapel Nizza",
		"Norwegen Nepal Niger",
		"Neckar Nil Nahe",
		"Nashorn Nilpferd Nerz",
		[1, "Nordpol"],
	],
};
const LETTERS = Object.keys(BANK);
const PEOPLE = [
	{ id: "you", name: "Du", color: "var(--you)" },
	{ id: "mia", name: "Mia", color: "#ff5c8a", skill: 0.92 },
	{ id: "jonas", name: "Jonas", color: "#ffb020", skill: 1.05 },
	{ id: "lea", name: "Lea", color: "#2ec4a6", skill: 1.2 },
];
const BOTS = PEOPLE.slice(1);
const PALETTES = {
	block: [
		[
			["#ff4f64", "#ffa133", "#ffd93b", "#3fd47c", "#37a6ff"],
			"#3340a8",
			"#161b5c",
		],
		[
			["#ff6fb5", "#b76bff", "#5c7cff", "#2fe0d0", "#9dff5c"],
			"#4a2384",
			"#1a0d3a",
		],
		[
			["#ffcf3f", "#ff7a2f", "#ff3f5f", "#c83fff", "#ff8fc8"],
			"#7f2248",
			"#2d0e1d",
		],
		[
			["#4dffb8", "#2fd0ff", "#7a8cff", "#ff8fc8", "#ffe15c"],
			"#12666c",
			"#06272b",
		],
	],
	paper: [
		[
			["#ff6b6b", "#ffb347", "#ffe156", "#7bd389", "#6bb8ff"],
			"#f7f1e3",
			"#ece2c9",
		],
		[
			["#f78fb3", "#c39bff", "#8fb8ff", "#7ee0d3", "#ffd58f"],
			"#f4eefb",
			"#e3d9f0",
		],
		[
			["#ff8c5a", "#ffd166", "#a7e08a", "#5ec8e5", "#ff7aa8"],
			"#fbf3e6",
			"#f0dfc4",
		],
		[
			["#5aa9e6", "#7fc8a9", "#f9c74f", "#f9844a", "#e56b9a"],
			"#eef6f1",
			"#d9ebe1",
		],
	],
	pop: [
		[
			["#ff5ca8", "#ffd400", "#4d7cff", "#b8f400", "#ff8a1f"],
			"#fff3d6",
			"#ffe2a0",
		],
		[
			["#00d4a6", "#ff6b3d", "#a07bff", "#ffe14d", "#ff4f8b"],
			"#e6f6ff",
			"#c4e9ff",
		],
		[
			["#ff3d3d", "#ffcc00", "#00b3ff", "#ff7ae0", "#7dff6b"],
			"#fbefff",
			"#efd3ff",
		],
		[
			["#2b2bff", "#ff9900", "#00e07a", "#ff2e7e", "#ffee00"],
			"#f0ffe4",
			"#d6ffbe",
		],
	],
};

const STORE = "slf-engagement-lab-v3";
const db = (() => {
	try {
		return JSON.parse(localStorage.getItem(STORE)) || {};
	} catch {
		return {};
	}
})();
db.records ??= [];
db.events ??= [];
db.best ??= 0;
db.participant ??= crypto.randomUUID?.() || String(Date.now());
const save = () => {
	try {
		db.events = db.events.slice(-4000);
		localStorage.setItem(STORE, JSON.stringify(db));
	} catch {}
};
const sessionId = crypto.randomUUID?.() || String(Date.now());
function log(type, data = {}) {
	db.events.push({
		type,
		at: new Date().toISOString(),
		sessionId,
		look: S.look,
		mode: S.mode,
		round: S.round + 1,
		...data,
	});
	save();
}

const S = {
	look: db.look || "block",
	mode: "classic",
	phase: "lobby",
	palette: 0,
	round: 0,
	rounds: 3,
	letters: [],
	letter: "M",
	totals: {},
	answers: {},
	locked: new Set(),
	elapsed: 0,
	limit: 80000,
	stopper: null,
	stopAt: 0,
	plan: {},
	pips: {},
	streak: 0,
	words: [],
	joined: false,
	skip: false,
	sprint: null,
	matchStart: 0,
};

// ---------- audio ----------
const VOICES = {
	block: {
		lead: "square",
		cut: 2600,
		bass: "square",
		bassCut: 650,
		gain: 0.55,
	},
	paper: {
		lead: "sine",
		cut: 5000,
		bass: "triangle",
		bassCut: 900,
		gain: 1.25,
	},
	pop: {
		lead: "sawtooth",
		cut: 2100,
		bass: "sawtooth",
		bassCut: 480,
		gain: 0.5,
	},
};
const SCENES = {
	lobby: { bpm: 96, kick: 0, hat: 1, bass: 1, pad: 1, arp: 0 },
	play: { bpm: 112, kick: 1, hat: 1, bass: 1, pad: 0, arp: 1 },
	final: { bpm: 132, kick: 2, hat: 2, bass: 1, pad: 0, arp: 2 },
	review: { bpm: 100, kick: 1, hat: 1, bass: 1, pad: 1, arp: 0 },
	result: { bpm: 104, kick: 1, hat: 1, bass: 1, pad: 1, arp: 1 },
	sprint: { bpm: 122, kick: 2, hat: 1, bass: 1, pad: 0, arp: 1 },
};
const PROG = [
	[57, [0, 3, 7]],
	[53, [0, 4, 7]],
	[48, [0, 4, 7]],
	[55, [0, 4, 7]],
];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
class Sound {
	constructor() {
		this.on = db.sound ?? true;
		this.volume = db.volume ?? 0.6;
		this.ctx = null;
		this.scene = "lobby";
		this.layer = 0;
		this.step = 0;
		this.next = 0;
	}
	start() {
		if (!this.on) return;
		if (!this.ctx) {
			const A = window.AudioContext || window.webkitAudioContext;
			if (!A) return;
			const ctx = new A();
			this.ctx = ctx;
			this.master = ctx.createGain();
			this.master.gain.value = this.volume * 0.5;
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = -16;
			comp.ratio.value = 4;
			this.music = ctx.createGain();
			this.music.gain.value = 0.62;
			this.sfx = ctx.createGain();
			this.music.connect(this.master);
			this.sfx.connect(this.master);
			this.master.connect(comp);
			comp.connect(ctx.destination);
			const len = ctx.sampleRate;
			this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
			const d = this.noiseBuf.getChannelData(0);
			for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
			this.next = ctx.currentTime + 0.05;
		}
		this.ctx.resume().catch(() => {});
	}
	get ok() {
		return this.on && this.ctx && this.ctx.state === "running";
	}
	get voice() {
		return VOICES[S.look];
	}
	tone(
		f,
		dur,
		gain,
		{ t = 0, type = "sine", bus = "sfx", glide = 0, cut = 6000 } = {},
	) {
		if (!this.ok) return;
		const ctx = this.ctx,
			at = t || ctx.currentTime;
		const o = ctx.createOscillator(),
			g = ctx.createGain(),
			flt = ctx.createBiquadFilter();
		o.type = type;
		o.frequency.setValueAtTime(f, at);
		if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur * 0.8);
		flt.type = "lowpass";
		flt.frequency.value = cut;
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.006);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		o.connect(flt)
			.connect(g)
			.connect(bus === "music" ? this.music : this.sfx);
		o.start(at);
		o.stop(at + dur + 0.03);
	}
	noise(
		dur,
		gain,
		{ t = 0, type = "highpass", f = 6000, to = 0, q = 0.8, bus = "sfx" } = {},
	) {
		if (!this.ok) return;
		const ctx = this.ctx,
			at = t || ctx.currentTime;
		const src = ctx.createBufferSource(),
			flt = ctx.createBiquadFilter(),
			g = ctx.createGain();
		src.buffer = this.noiseBuf;
		flt.type = type;
		flt.frequency.setValueAtTime(f, at);
		if (to) flt.frequency.exponentialRampToValueAtTime(to, at + dur);
		flt.Q.value = q;
		g.gain.setValueAtTime(gain, at);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		src
			.connect(flt)
			.connect(g)
			.connect(bus === "music" ? this.music : this.sfx);
		src.start(at, Math.random() * 0.5);
		src.stop(at + dur + 0.02);
	}
	lead(m, dur, gain, t = 0, bus = "sfx") {
		const v = this.voice;
		this.tone(hz(m), dur, gain * v.gain, { t, type: v.lead, bus, cut: v.cut });
	}
	kick(t, g = 0.5) {
		this.tone(150, 0.16, g, { t, glide: 42, bus: "music" });
	}
	schedule() {
		if (!this.ok) return;
		const sc = SCENES[this.scene];
		const sixteenth = 60 / sc.bpm / 4;
		const ctx = this.ctx;
		if (this.next < ctx.currentTime - 0.25) this.next = ctx.currentTime + 0.02;
		while (this.next < ctx.currentTime + 0.12) {
			const t = this.next,
				s = this.step % 16,
				[root, chord] = PROG[Math.floor(this.step / 16) % 4],
				L = this.layer,
				v = this.voice;
			if (sc.kick >= 1 && s % 8 === 0) this.kick(t, 0.42);
			if (sc.kick >= 2 && s % 8 === 4) this.kick(t, 0.32);
			if (sc.kick >= 1 && (s === 4 || s === 12))
				this.noise(0.12, 0.13, { t, type: "bandpass", f: 1900, bus: "music" });
			if (sc.hat >= 1 && s % 4 === 2)
				this.noise(0.04, 0.07, { t, bus: "music" });
			if (sc.hat >= 2 && s % 2 === 1)
				this.noise(0.03, 0.045, { t, bus: "music" });
			if (sc.bass && [0, 6, 8, 11, 14].includes(s))
				this.tone(hz(root - 24 + (s === 14 ? 12 : 0)), sixteenth * 1.7, 0.2, {
					t,
					type: v.bass,
					bus: "music",
					cut: v.bassCut,
				});
			if (sc.pad && s === 0)
				chord.forEach((c) =>
					this.tone(hz(root + c), sixteenth * 14, 0.035, {
						t,
						type: "triangle",
						bus: "music",
						cut: 1600,
					}),
				);
			const arp = [0, 1, 2, 3, 2, 1, 2, 3];
			const notes = [...chord, 12];
			const arpOn =
				(sc.arp >= 1 && L >= 1 && s % 2 === 0) ||
				(sc.arp >= 1 && L >= 2) ||
				(sc.arp === 0 && s % 4 === 0 && this.scene === "lobby") ||
				sc.arp >= 2;
			if (arpOn)
				this.lead(
					root + 12 + notes[arp[s % 8]],
					sixteenth * 1.4,
					0.05 + L * 0.008,
					t,
					"music",
				);
			if (L >= 3 && s % 4 === 3)
				this.lead(root + 24 + notes[(s >> 2) % 4], 0.12, 0.03, t, "music");
			if (L >= 4 && s % 8 === 0)
				chord.forEach((c) =>
					this.tone(hz(root + 12 + c), sixteenth * 7, 0.03, {
						t,
						type: "triangle",
						bus: "music",
						cut: 2500,
					}),
				);
			this.step++;
			this.next += sixteenth;
		}
	}
	key(n) {
		const penta = [0, 2, 4, 7, 9];
		this.lead(
			72 + penta[n % 5] + 12 * Math.min(2, Math.floor(n / 5)),
			0.12,
			0.07,
		);
		this.noise(0.02, 0.05, { f: 7000 });
	}
	poof() {
		this.noise(0.08, 0.06, { type: "bandpass", f: 2500, to: 600 });
	}
	word(k) {
		const t = this.ctx?.currentTime || 0;
		[0, 4, 7, 12].forEach((c, i) =>
			this.lead(72 + k * 2 + c, 0.18, 0.07, t + i * 0.045),
		);
		this.tone(90, 0.14, 0.3, { t, glide: 45 });
	}
	clear() {
		const t = this.ctx?.currentTime || 0;
		[0, 4, 7, 12, 16, 19, 24, 28].forEach((c, i) =>
			this.lead(67 + c, 0.3, 0.07, t + i * 0.04),
		);
		this.noise(0.7, 0.18, { t, type: "bandpass", f: 400, to: 7000 });
		this.tone(70, 0.5, 0.45, { t, glide: 35 });
	}
	slot(i) {
		this.tone(900 + i * 40, 0.03, 0.08, { type: "square", cut: 3000 });
	}
	land() {
		this.tone(120, 0.35, 0.6, { glide: 38 });
		this.noise(0.25, 0.15, { type: "lowpass", f: 900 });
		[0, 4, 7].forEach((c) => this.lead(60 + c, 0.5, 0.05));
	}
	slam() {
		this.noise(0.35, 0.35, { type: "bandpass", f: 500, q: 0.6 });
		this.tone(80, 0.45, 0.6, { glide: 32 });
	}
	flip() {
		this.noise(0.05, 0.12, { type: "bandpass", f: 3200, q: 1.5 });
	}
	stamp(pts) {
		this.tone(110, 0.12, 0.4, { glide: 50 });
		this.noise(0.06, 0.1, { type: "lowpass", f: 1200 });
		if (pts) {
			const base = pts >= 20 ? 79 : pts >= 10 ? 74 : 69;
			this.lead(base, 0.22, 0.07);
			if (pts >= 20)
				this.lead(base + 7, 0.3, 0.06, (this.ctx?.currentTime || 0) + 0.06);
		}
	}
	clack() {
		const t = this.ctx?.currentTime || 0;
		this.noise(0.03, 0.18, { t, type: "bandpass", f: 2200, q: 3 });
		this.noise(0.03, 0.14, { t: t + 0.07, type: "bandpass", f: 2600, q: 3 });
	}
	crunch() {
		this.noise(0.35, 0.25, { type: "lowpass", f: 2500, to: 200 });
		this.tone(200, 0.3, 0.2, { type: "sawtooth", glide: 60, cut: 900 });
	}
	whoosh() {
		this.noise(0.45, 0.16, { type: "bandpass", f: 300, to: 4000, q: 1.2 });
	}
	pop() {
		this.tone(400, 0.12, 0.15, { glide: 900 });
	}
	tick() {
		this.tone(1500, 0.03, 0.09, { type: "triangle" });
	}
	combo(n) {
		const t = this.ctx?.currentTime || 0;
		[0, 7, 12].forEach((c, i) =>
			this.lead(72 + n * 2 + c, 0.16, 0.07, t + i * 0.05),
		);
	}
	fanfare() {
		const t = this.ctx?.currentTime || 0;
		[
			[60, 64, 67],
			[65, 69, 72],
			[67, 71, 74],
			[72, 76, 79, 84],
		].forEach((ch, i) =>
			ch.forEach((m) => this.lead(m, i === 3 ? 0.9 : 0.2, 0.05, t + i * 0.16)),
		);
		this.noise(1.2, 0.08, { t: t + 0.48, type: "highpass", f: 5000 });
	}
	setOn(value) {
		this.on = value;
		db.sound = value;
		save();
		if (value) this.start();
		else this.ctx?.suspend().catch(() => {});
		paintSoundButton();
	}
	setVolume(v) {
		this.volume = v;
		db.volume = v;
		save();
		if (this.master)
			this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.05);
	}
}
const sound = new Sound();

// ---------- particles ----------
const fx = {
	canvas: $("#fx"),
	parts: [],
	colors: [],
	resize() {
		const r = Math.min(devicePixelRatio || 1, 2);
		this.canvas.width = innerWidth * r;
		this.canvas.height = innerHeight * r;
		this.ctx = this.canvas.getContext("2d");
		this.ctx.setTransform(r, 0, 0, r, 0, 0);
	},
	burst(x, y, { n = 18, speed = 7, size = 9, up = 0, life = 1, colors } = {}) {
		if (reduced()) n = Math.min(n, 4);
		const cs = colors || this.colors;
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2,
				v = rand(0.35, 1) * speed;
			this.parts.push({
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - up,
				s: rand(0.5, 1) * size,
				r: rand(0, 6),
				vr: rand(-0.3, 0.3),
				c: pick(cs),
				life,
				shape: Math.random() < 0.25 ? "dot" : "sq",
			});
		}
	},
	rain(n = 90) {
		if (reduced()) return;
		for (let i = 0; i < n; i++)
			this.parts.push({
				x: rand(0, innerWidth),
				y: rand(-innerHeight * 0.6, -10),
				vx: rand(-1.5, 1.5),
				vy: rand(1, 4),
				s: rand(6, 12),
				r: rand(0, 6),
				vr: rand(-0.2, 0.2),
				c: pick(this.colors),
				life: 2.4,
				shape: "sq",
				flutter: true,
			});
	},
	at(el, opts) {
		const r = el.getBoundingClientRect();
		this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
	},
	draw() {
		const ctx = this.ctx;
		if (!ctx) return;
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		const look = S.look;
		this.parts = this.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
		for (const p of this.parts) {
			p.vy += p.flutter ? 0.04 : 0.32;
			p.vx *= p.flutter ? 0.995 : 0.985;
			if (p.flutter) p.vx += Math.sin(p.y / 30 + p.r) * 0.08;
			p.x += p.vx;
			p.y += p.vy;
			p.r += p.vr;
			p.life -= 0.016;
			ctx.save();
			ctx.globalAlpha = Math.min(1, p.life * 2);
			ctx.translate(p.x, p.y);
			ctx.rotate(p.r);
			const s = p.s;
			if (p.shape === "dot") {
				ctx.beginPath();
				ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
				ctx.fillStyle = p.c;
				ctx.fill();
				if (look === "pop") {
					ctx.lineWidth = 1.6;
					ctx.strokeStyle = "#16131c";
					ctx.stroke();
				}
			} else if (look === "paper") {
				ctx.fillStyle = p.c;
				ctx.fillRect(-s / 2, -s / 5, s, (s * 2) / 5);
			} else {
				ctx.fillStyle = p.c;
				ctx.fillRect(-s / 2, -s / 2, s, s);
				if (look === "block") {
					ctx.fillStyle = "rgba(255,255,255,.45)";
					ctx.fillRect(-s / 2, -s / 2, s, s / 4);
					ctx.fillStyle = "rgba(0,0,0,.22)";
					ctx.fillRect(-s / 2, s / 4, s, s / 4);
				} else {
					ctx.lineWidth = 1.6;
					ctx.strokeStyle = "#16131c";
					ctx.strokeRect(-s / 2, -s / 2, s, s);
				}
			}
			ctx.restore();
		}
	},
};
fx.resize();
addEventListener("resize", () => fx.resize());

// ---------- helpers ----------
let gen = 0;
const STALE = Symbol("stale");
const timers = new Set();
function after(ms, fn) {
	const id = setTimeout(() => {
		timers.delete(id);
		fn();
	}, ms);
	timers.add(id);
	return id;
}
function sleep(ms) {
	const g = gen;
	const d = S.skip ? 25 : reduced() ? Math.min(ms, 200) : ms;
	return new Promise((res, rej) =>
		after(d, () => (g === gen ? res() : rej(STALE))),
	);
}
const run = (fn) =>
	fn().catch((e) => {
		if (e !== STALE) throw e;
	});
function screen(phase, html) {
	gen++;
	timers.forEach(clearTimeout);
	timers.clear();
	S.skip = false;
	S.phase = phase;
	document.body.dataset.phase = phase;
	const stage = $("#stage");
	stage.innerHTML = `<section class="screen ${phase}">${html}</section>`;
	log("screen", { phase });
	return stage.firstElementChild;
}
function anim(el, frames, opts = {}) {
	if (!el || reduced()) return null;
	return el.animate(frames, {
		duration: 300,
		easing: "cubic-bezier(.2,.9,.3,1.25)",
		...opts,
	});
}
function shake(power = 1) {
	anim(
		$("#app"),
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
function slam(html, cls = "") {
	const el = $("#slam");
	el.className = `show ${cls}`;
	el.innerHTML = `<div class="slam-inner">${html}</div>`;
	void el.offsetWidth;
	el.classList.add("go");
	shake(1.4);
	after(1100, () => (el.className = ""));
	setTimeout(() => {
		if (!el.classList.contains("go")) el.innerHTML = "";
	}, 1300);
}
function floatText(text, x, y, cls = "") {
	const el = document.createElement("div");
	el.className = `float ${cls}`;
	el.textContent = text;
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
	document.body.append(el);
	setTimeout(() => el.remove(), 1000);
}
const announce = (t) => ($("#live").textContent = t);
const avatar = (p, cls = "") =>
	`<span class="av ${cls}" style="--pc:${p.color}" data-av="${p.id}">${p.id === "you" ? icon("star") : p.name[0]}</span>`;

function setLook(look) {
	S.look = look;
	db.look = look;
	save();
	document.body.dataset.look = look;
	$$(".looks button").forEach((b) =>
		b.setAttribute("aria-pressed", String(b.dataset.look === look)),
	);
	setPalette(S.palette);
	$$(".tiles").forEach((box) => fitTiles(box));
}
function setPalette(i) {
	S.palette = i;
	const [tiles, bg1, bg2] = PALETTES[S.look][i % 4];
	const st = document.body.style;
	tiles.forEach((c, k) => st.setProperty(`--t${k + 1}`, c));
	st.setProperty("--bg1", bg1);
	st.setProperty("--bg2", bg2);
	fx.colors = tiles;
}

// ---------- tiles ----------
function fitTiles(box) {
	const n = Math.max(1, box._chars?.length || 0);
	const max = Number(box.dataset.max || 38),
		gap = 3;
	const w = box.clientWidth || 280;
	const s = Math.max(13, Math.min(max, Math.floor((w - gap * (n - 1)) / n)));
	box.style.setProperty("--s", `${s}px`);
}
function paintTiles(box, value, letter, live = true) {
	const chars = [...value];
	const prev = box._chars || [];
	let k = 0;
	while (k < prev.length && k < chars.length && prev[k] === chars[k]) k++;
	const tiles = $$(".tile:not(.ghost)", box);
	for (let i = tiles.length - 1; i >= k; i--) {
		if (live) {
			fx.at(tiles[i], { n: 5, speed: 3, size: 5 });
			sound.poof();
		}
		tiles[i].remove();
	}
	const caret = $(".caret", box);
	for (let i = k; i < chars.length; i++) {
		const t = document.createElement("span");
		const lead = i === 0;
		t.className = `tile${lead ? (upper(chars[0]) === letter ? " lead" : " bad") : ""}${chars[i] === " " ? " space" : ""}${live ? " in" : ""}`;
		if (!lead) t.style.setProperty("--c", `var(--t${(i % 5) + 1})`);
		t.textContent = lead ? upper(chars[i]) : chars[i];
		box.insertBefore(t, caret);
	}
	box._chars = chars;
	fitTiles(box);
}
const tilesHTML = (cls = "", max = 38, letter = "") =>
	`<div class="tiles ${cls}" data-max="${max}" data-letter="${letter}"><span class="tile lead ghost">${letter}</span><span class="caret"></span></div>`;
function miniWord(letter, max = 30) {
	const box = document.createElement("div");
	box.className = "tiles mini";
	box.dataset.max = max;
	box.dataset.letter = letter;
	box.innerHTML = '<span class="caret"></span>';
	return box;
}

// ---------- lobby ----------
function lobby() {
	sound.scene = "lobby";
	sound.layer = 0;
	const el = screen(
		"lobby",
		`<h1 class="logo" aria-label="Stadt Land Fluss">${["S", "L", "F"]
			.map(
				(c, i) =>
					`<button type="button" class="logo-tile" style="--c:var(--t${[1, 4, 5][i]});--i:${i}" tabindex="-1" aria-hidden="true">${c}</button>`,
			)
			.join("")}</h1>
		<p class="wordmark">Stadt · Land · Fluss</p>
		<div class="seats">${PEOPLE.map((p) => `<div class="seat ${p.id === "you" || S.joined ? "in" : ""}" data-seat="${p.id}">${avatar(p)}<span>${p.name}</span></div>`).join("")}</div>
		<div class="mode-pick" role="radiogroup" aria-label="Modus">
			<button type="button" role="radio" data-mode="classic" aria-checked="${S.mode === "classic"}">${icon("grid")}<span>Klassisch</span></button>
			<button type="button" role="radio" data-mode="sprint" aria-checked="${S.mode === "sprint"}">${icon("bolt")}<span>Sprint</span>${db.best ? `<small>${db.best}</small>` : ""}</button>
		</div>
		<button type="button" class="btn primary go" id="go">Los ${icon("arrow")}</button>`,
	);
	$$(".logo-tile", el).forEach((b, i) =>
		b.addEventListener("pointerdown", () => {
			sound.start();
			sound.key(i * 2 + 3);
			anim(
				b,
				[
					{ transform: "translateY(0) scale(1)" },
					{ transform: "translateY(-18px) scale(1.12) rotate(-6deg)" },
					{ transform: "translateY(0) scale(1)" },
				],
				{ duration: 420 },
			);
			fx.at(b, { n: 10, speed: 5 });
		}),
	);
	$$("[data-mode]", el).forEach((b) =>
		b.addEventListener("click", () => {
			S.mode = b.dataset.mode;
			$$("[data-mode]", el).forEach((x) =>
				x.setAttribute("aria-checked", String(x === b)),
			);
			sound.start();
			sound.pop();
			anim(b, [{ transform: "scale(.92)" }, { transform: "scale(1)" }]);
		}),
	);
	$("#go", el).addEventListener("click", () => {
		sound.start();
		S.mode === "sprint" ? startSprint() : startMatch();
	});
	if (!S.joined)
		run(async () => {
			for (const p of BOTS) {
				await sleep(rand(450, 900));
				const seat = $(`[data-seat="${p.id}"]`);
				seat.classList.add("in");
				sound.pop();
				fx.at(seat, { n: 8, speed: 4, colors: [p.color] });
			}
			S.joined = true;
		});
}

// ---------- slot ----------
async function slotReveal(letter, { quick = false } = {}) {
	const host = $(".slot-host") || $("#stage");
	const box = document.createElement("div");
	box.className = "slot";
	box.innerHTML = `<div class="slot-tile"><span>?</span></div>`;
	host.append(box);
	const span = $(".slot-tile span", box);
	const steps = quick ? 7 : 15;
	for (let i = 0; i < steps; i++) {
		span.textContent = i === steps - 1 ? letter : pick(LETTERS);
		sound.slot(i);
		anim(
			span,
			[
				{ transform: "translateY(-40%)", opacity: 0.3 },
				{ transform: "translateY(0)", opacity: 1 },
			],
			{ duration: 90, easing: "ease-out" },
		);
		await sleep(quick ? 30 + i * 12 : 35 + i * i * 1.1);
	}
	box.classList.add("landed");
	sound.land();
	shake(1.2);
	fx.at($(".slot-tile", box), { n: 34, speed: 11, size: 12 });
	announce(`Buchstabe ${letter}`);
	await sleep(quick ? 380 : 650);
	box.classList.add("leave");
	await sleep(220);
	box.remove();
}

// ---------- classic ----------
function startMatch() {
	S.round = 0;
	S.letters = shuffle(LETTERS).slice(0, S.rounds);
	S.totals = Object.fromEntries(PEOPLE.map((p) => [p.id, 0]));
	S.streak = 0;
	S.words = [];
	S.matchStart = performance.now();
	log("match_started");
	startRound();
}
function planBots() {
	const bank = BANK[S.letter];
	const speed = 1 - S.round * 0.09;
	const plan = {};
	const dubiousBot = pick(BOTS).id;
	for (const b of BOTS) {
		const words = bank
			.slice(0, 4)
			.map((list) => (Math.random() < 0.1 ? "" : pick(list.split(" "))));
		if (b.id === dubiousBot) words[bank[4][0]] = bank[4][1];
		const base = [8, 15, 23, 31].map(
			(s) => (s * b.skill * speed + rand(-1.5, 2.5)) * 1000,
		);
		const filled = words.map((w, i) =>
			w ? base[i] : Number.POSITIVE_INFINITY,
		);
		plan[b.id] = {
			words,
			times: filled,
			dubious: b.id === dubiousBot ? bank[4][0] : -1,
		};
	}
	const done = BOTS.filter((b) => plan[b.id].words.every(Boolean)).map(
		(b) => Math.max(...plan[b.id].times) + 1500,
	);
	S.buzzAt = done.length ? Math.min(...done) : Number.POSITIVE_INFINITY;
	S.plan = plan;
}
function startRound() {
	S.letter = S.letters[S.round];
	S.answers = { you: ["", "", "", ""] };
	S.locked = new Set();
	S.elapsed = 0;
	S.stopper = null;
	S.stopAt = 0;
	S.pips = Object.fromEntries(BOTS.map((b) => [b.id, 0]));
	planBots();
	const el = screen(
		"play",
		`<div class="hud">
			<div class="letter-tile" id="letter">${S.letter}</div>
			<div class="hud-mid">
				<div class="rounds">${Array.from({ length: S.rounds }, (_, i) => `<i class="${i < S.round ? "done" : i === S.round ? "now" : ""}"></i>`).join("")}</div>
				<div class="fuse" id="fuse"><i></i><b></b></div>
			</div>
		</div>
		<div class="friends">${BOTS.map((b) => `<div class="friend" data-friend="${b.id}">${avatar(b)}<span class="pips">${"<i></i>".repeat(4)}</span></div>`).join("")}</div>
		<div class="cards">${CATS.map(
			(c, i) => `<label class="card" data-card="${i}" style="--ci:${i}">
				<span class="cat">${icon(c.icon)}<span>${c.name}</span></span>
				${tilesHTML("", 38, S.letter)}
				<input class="answer" data-i="${i}" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="24" enterkeyhint="${i === 3 ? "done" : "next"}" aria-label="${c.name} mit ${S.letter}" disabled>
				<span class="lock">${icon("check")}</span>
			</label>`,
		).join("")}</div>
		<button type="button" class="btn stop" id="stop" disabled>${icon("hand")}<span>STOPP</span></button>
		<div class="slot-host"></div>`,
	);
	$$(".answer", el).forEach(bindAnswer);
	$("#stop", el).addEventListener("click", () => {
		if (S.locked.size === 4 && !S.ending) playerStop();
	});
	S.ending = false;
	sound.scene = "lobby";
	sound.layer = 0;
	run(async () => {
		await slotReveal(S.letter);
		S.playing = true;
		sound.scene = "play";
		sound.step = 0;
		anim(
			$("#letter"),
			[
				{ transform: "scale(2.4) rotate(-8deg)", opacity: 0 },
				{ transform: "scale(1)", opacity: 1 },
			],
			{ duration: 500 },
		);
		$$(".answer").forEach((i) => (i.disabled = false));
		$(".answer").focus();
		log("round_started", { letter: S.letter });
	});
}
function bindAnswer(input) {
	const i = Number(input.dataset.i);
	const card = input.closest(".card");
	const box = $(".tiles", card);
	input.addEventListener("input", () => {
		if (!S.playing || S.ending) return;
		const v = input.value;
		const grew = [...v].length > [...S.answers.you[i]].length;
		S.answers.you[i] = v;
		paintTiles(box, v, S.letter);
		if (grew) {
			sound.key([...v].length - 1);
			const last = $$(".tile", box).at(-1);
			if (last) fx.at(last, { n: 3, speed: 2.4, size: 4 });
			anim(
				$("#letter"),
				[{ transform: "translateY(3px) scale(.97)" }, { transform: "none" }],
				{ duration: 160 },
			);
		}
		if (S.locked.has(i) && !ruleValid(v, S.letter)) unlock(i);
	});
	input.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		e.preventDefault();
		if (commit(i)) focusNext(i);
		else if (input.value.trim()) wrong(card);
	});
	input.addEventListener("blur", () => commit(i));
}
function focusNext(i) {
	const next = [1, 2, 3, 0]
		.map((d) => (i + d) % 4)
		.find((k) => !S.locked.has(k));
	if (next !== undefined && next !== i) $(`.answer[data-i="${next}"]`)?.focus();
	else if (S.locked.size === 4) $("#stop")?.focus();
}
function wrong(card) {
	card.classList.remove("wrong");
	void card.offsetWidth;
	card.classList.add("wrong");
	sound.crunch();
}
function commit(i) {
	if (!S.playing || S.ending) return false;
	const v = S.answers.you[i].trim();
	if (!ruleValid(v, S.letter)) return false;
	if (S.locked.has(i)) return true;
	S.locked.add(i);
	const card = $(`[data-card="${i}"]`);
	card.classList.add("locked");
	$$(".tile", card).forEach((t, k) =>
		anim(
			t,
			[
				{ transform: "translateY(0)" },
				{ transform: "translateY(-12px) scale(1.12)" },
				{ transform: "translateY(0)" },
			],
			{
				duration: 380,
				delay: k * 35,
			},
		),
	);
	fx.at($(".tiles", card), { n: 16, speed: 6 });
	sound.word(S.locked.size);
	sound.layer = S.locked.size;
	paintProgress();
	log("word", { cat: i, len: [...v].length });
	if (S.locked.size === 4) allClear();
	return true;
}
function unlock(i) {
	S.locked.delete(i);
	$(`[data-card="${i}"]`).classList.remove("locked");
	sound.layer = S.locked.size;
	paintProgress();
	$("#stop").disabled = true;
	$("#stop").classList.remove("armed");
}
function paintProgress() {
	$$(".card").forEach((c, i) => c.classList.toggle("locked", S.locked.has(i)));
}
function allClear() {
	setPalette(S.palette + 1);
	sound.clear();
	shake(1.6);
	$$(".card").forEach((c, k) => {
		after(k * 60, () => fx.at(c, { n: 22, speed: 10, size: 11 }));
		anim(
			c,
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.05)" },
				{ transform: "scale(1)" },
			],
			{ duration: 420, delay: k * 60 },
		);
	});
	const stop = $("#stop");
	stop.disabled = false;
	stop.classList.add("armed");
	slam(`<b class="slam-num">4/4</b>`, "clear");
	log("all_clear");
}
function playerStop() {
	S.stopper = "you";
	slam(`${avatar(PEOPLE[0])}<b>STOPP</b>`);
	sound.slam();
	log("stop", { by: "you", ms: Math.round(S.elapsed) });
	endRound();
}
function botStop(id) {
	S.stopper = id;
	S.stopAt = S.elapsed + 5000;
	const b = PEOPLE.find((p) => p.id === id);
	slam(`${avatar(b)}<b>STOPP</b>`, "bot");
	sound.slam();
	sound.scene = "final";
	$("#fuse")?.classList.add("hot");
	document.body.classList.add("urgent");
	log("stop", { by: id, ms: Math.round(S.elapsed) });
}
function endRound() {
	if (S.ending) return;
	S.ending = true;
	S.playing = false;
	document.body.classList.remove("urgent");
	$$(".answer").forEach((i) => {
		i.disabled = true;
		i.blur();
	});
	sound.layer = 0;
	run(async () => {
		await sleep(S.stopper === "you" ? 700 : 300);
		$$(".card").forEach((c, k) =>
			anim(
				c,
				[
					{ transform: "none", opacity: 1 },
					{
						transform: `translateY(-30px) rotate(${k % 2 ? 3 : -3}deg)`,
						opacity: 0,
					},
				],
				{
					duration: 320,
					delay: k * 50,
					fill: "forwards",
					easing: "ease-in",
				},
			),
		);
		sound.whoosh();
		await sleep(520);
		review();
	});
}
function tickBots() {
	if (!S.playing) return;
	for (const b of BOTS) {
		const plan = S.plan[b.id];
		const n = plan.times.filter((t) => t <= S.elapsed).length;
		if (n > S.pips[b.id]) {
			S.pips[b.id] = n;
			const f = $(`[data-friend="${b.id}"]`);
			if (f) {
				const pip = $$(".pips i", f)[n - 1];
				pip?.classList.add("on");
				anim(
					$(".av", f),
					[
						{ transform: "translateY(0)" },
						{ transform: "translateY(-6px) scale(1.12)" },
						{ transform: "none" },
					],
					{ duration: 300 },
				);
				if (pip) fx.at(pip, { n: 4, speed: 2.5, size: 4, colors: [b.color] });
			}
			sound.tone(hz(84 + n * 2), 0.05, 0.035, { type: "triangle" });
		}
	}
	if (!S.stopper && S.elapsed >= S.buzzAt) {
		const winner = BOTS.filter((b) => S.plan[b.id].words.every(Boolean)).sort(
			(a, b) =>
				Math.max(...S.plan[a.id].times) - Math.max(...S.plan[b.id].times),
		)[0];
		botStop(winner.id);
	}
	const fuse = $("#fuse");
	if (fuse) {
		const frac = S.stopper
			? Math.max(0, (S.stopAt - S.elapsed) / 5000)
			: Math.max(0, 1 - S.elapsed / S.limit);
		fuse.style.setProperty("--f", frac.toFixed(4));
		if (S.stopper) {
			const sec = Math.ceil((S.stopAt - S.elapsed) / 1000);
			if (sec !== S.lastSec) {
				S.lastSec = sec;
				sound.tick();
				if (sec > 0) floatOnFuse(sec);
			}
		}
	}
	if ((S.stopper && S.elapsed >= S.stopAt) || S.elapsed >= S.limit) {
		if (!S.stopper) S.stopper = "time";
		endRound();
	}
}
function floatOnFuse(sec) {
	const l = $("#letter");
	if (!l) return;
	const r = l.getBoundingClientRect();
	floatText(String(sec), r.right + 40, r.top + r.height / 2, "count");
}

// ---------- review ----------
function scoreCategory(ci) {
	const entries = PEOPLE.map((p) => {
		const word = (
			p.id === "you" ? S.answers.you[ci] : S.plan[p.id].words[ci]
		).trim();
		return { p, word, ok: ruleValid(word, S.letter), accepted: true };
	});
	return entries;
}
function points(entries) {
	const valid = entries.filter((e) => e.ok && e.accepted);
	for (const e of entries) {
		if (!(e.ok && e.accepted)) e.pts = 0;
		else if (valid.length === 1) e.pts = 20;
		else
			e.pts =
				valid.filter((x) => norm(x.word) === norm(e.word)).length > 1 ? 5 : 10;
	}
}
function review() {
	sound.scene = "review";
	sound.step = 0;
	S.roundPts = Object.fromEntries(PEOPLE.map((p) => [p.id, 0]));
	S.roundRows = [];
	screen(
		"review",
		`<div class="scoreboard">${PEOPLE.map((p) => `<div class="sb" data-sb="${p.id}">${avatar(p)}<b>0</b></div>`).join("")}</div>
		<div class="review-head"><span class="letter-tile small">${S.letter}</span><span class="cat-big" id="cat-big"></span><span class="steps">${"<i></i>".repeat(4)}</span></div>
		<div class="answers" id="answers"></div>
		<button type="button" class="btn next" id="next"><span>Weiter</span>${icon("arrow")}<i class="fill"></i></button>`,
	);
	$("#next").addEventListener("click", () => {
		S.skip = true;
		S.nextNow?.();
	});
	run(async () => {
		for (let ci = 0; ci < 4; ci++) await reviewCategory(ci);
		roundResult();
	});
}
async function reviewCategory(ci) {
	S.skip = false;
	const cat = CATS[ci];
	const big = $("#cat-big");
	big.innerHTML = `${icon(cat.icon)}<span>${cat.name}</span>`;
	anim(
		big,
		[
			{ transform: "translateX(40px)", opacity: 0 },
			{ transform: "none", opacity: 1 },
		],
		{ duration: 320 },
	);
	$$(".steps i").forEach((s, k) => s.classList.toggle("on", k <= ci));
	const entries = scoreCategory(ci);
	const order = [...entries.filter((e) => e.p.id !== "you"), entries[0]];
	const list = $("#answers");
	list.innerHTML = entries
		.map(
			(e) => `<div class="ans" data-ans="${e.p.id}" style="--pc:${e.p.color}">
				<div class="ans-card"><div class="ans-back">${icon(cat.icon)}</div>
				<div class="ans-front">${avatar(e.p)}<div class="ans-word"></div><span class="pts"></span></div></div></div>`,
		)
		.join("");
	for (const e of entries) {
		const host = $(`[data-ans="${e.p.id}"] .ans-word`);
		if (e.word) {
			const box = miniWord(S.letter);
			host.append(box);
			e.box = box;
		} else host.innerHTML = '<span class="empty">—</span>';
	}
	for (const [k, e] of entries.entries()) {
		await sleep(70);
		$(`[data-ans="${e.p.id}"]`).classList.add("dealt");
		sound.flip();
		if (k === 3) await sleep(160);
	}
	for (const e of order) {
		await sleep(e.p.id === "you" ? 420 : 200);
		const el = $(`[data-ans="${e.p.id}"]`);
		el.classList.add("open");
		sound.flip();
		if (e.box) after(60, () => paintTiles(e.box, e.word, S.letter, false));
		if (e.word && !e.ok) {
			await sleep(260);
			el.classList.add("cracked");
			sound.crunch();
		}
	}
	const doubt = entries.find(
		(e) => e.p.id !== "you" && S.plan[e.p.id].dubious === ci && e.ok,
	);
	if (doubt) await vote(doubt);
	points(entries);
	const groups = {};
	for (const e of entries)
		if (e.pts === 5) (groups[norm(e.word)] ??= []).push(e);
	for (const g of Object.values(groups)) {
		await sleep(260);
		g.forEach((e) => {
			const el = $(`[data-ans="${e.p.id}"]`);
			el.classList.add("twin");
			anim(
				el,
				[
					{ transform: "scale(1)" },
					{ transform: "scale(.94)" },
					{ transform: "scale(1)" },
				],
				{ duration: 260 },
			);
		});
		sound.clack();
	}
	for (const e of order) {
		await sleep(e.p.id === "you" ? 380 : 230);
		stamp(e);
	}
	const you = entries[0];
	if (you.pts === 20 && entries.filter((e) => e.pts > 0).length === 1) {
		const el = $('[data-ans="you"]');
		el.classList.add("solo");
		fx.at(el, { n: 40, speed: 12, size: 12 });
		sound.clear();
	}
	if (you.pts)
		S.words.push({ word: you.word, pts: you.pts, cat: ci, letter: S.letter });
	S.roundRows.push(entries);
	await waitNext(ci === 3 ? 1800 : 1500);
}
async function vote(e) {
	const el = $(`[data-ans="${e.p.id}"]`);
	const others = BOTS.filter((b) => b.id !== e.p.id);
	el.classList.add("doubt");
	el.insertAdjacentHTML(
		"beforeend",
		`<div class="votes"></div><div class="decide"><button type="button" class="yes" aria-label="Gilt">${icon("check")}</button><button type="button" class="no" aria-label="Gilt nicht">${icon("x")}</button></div>`,
	);
	const votes = $(".votes", el);
	const downs = [];
	await sleep(300);
	for (const [k, b] of others.entries()) {
		const down = k === 0 || Math.random() < 0.4;
		downs.push(down);
		votes.insertAdjacentHTML(
			"beforeend",
			`<span class="vote ${down ? "down" : "up"}" style="--pc:${b.color}">${icon(down ? "down" : "check")}</span>`,
		);
		sound.tone(down ? 220 : 660, 0.08, 0.1, { type: "triangle" });
		await sleep(380);
	}
	sound.tick();
	const choice = await new Promise((res) => {
		const g = gen;
		const auto = after(7000, () => res(null));
		$(".yes", el).onclick = () => res(true);
		$(".no", el).onclick = () => res(false);
		S.nextNow = () => {
			clearTimeout(auto);
			res(null);
		};
		if (g !== gen) res(null);
	});
	S.skip = false;
	S.nextNow = null;
	const accepted = choice ?? downs.filter(Boolean).length < 2;
	e.accepted = accepted;
	log("vote", { word: e.word, choice, accepted });
	$(".decide", el).remove();
	el.classList.remove("doubt");
	if (!accepted) {
		el.classList.add("cracked");
		sound.crunch();
		shake(0.6);
	} else {
		sound.word(2);
		fx.at(el, { n: 10, speed: 5 });
	}
	await sleep(380);
}
function stamp(e) {
	const el = $(`[data-ans="${e.p.id}"]`);
	const pts = $(".pts", el);
	pts.textContent = e.pts;
	pts.className = `pts p${e.pts} on`;
	sound.stamp(e.pts);
	if (e.pts >= 10)
		fx.at(pts, {
			n: e.pts >= 20 ? 14 : 7,
			speed: e.pts >= 20 ? 7 : 4,
			size: 7,
		});
	if (!e.pts) return;
	S.roundPts[e.p.id] += e.pts;
	const target = $(`[data-sb="${e.p.id}"]`);
	const a = pts.getBoundingClientRect(),
		b = target.getBoundingClientRect();
	const fly = document.createElement("div");
	fly.className = "fly";
	fly.textContent = `+${e.pts}`;
	fly.style.left = `${a.left}px`;
	fly.style.top = `${a.top}px`;
	document.body.append(fly);
	const m = fly.animate(
		[
			{ transform: "translate(0,0) scale(1)", opacity: 1 },
			{
				transform: `translate(${(b.left - a.left) * 0.5}px,${(b.top - a.top) * 0.5 - 30}px) scale(1.2)`,
				opacity: 1,
				offset: 0.5,
			},
			{
				transform: `translate(${b.left - a.left + 10}px,${b.top - a.top}px) scale(.6)`,
				opacity: 0.4,
			},
		],
		{ duration: reduced() ? 1 : 520, easing: "cubic-bezier(.4,0,.2,1)" },
	);
	m.onfinish = () => {
		fly.remove();
		const n = $("b", target);
		if (!n) return;
		n.textContent = S.roundPts[e.p.id];
		anim(
			target,
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.25)" },
				{ transform: "scale(1)" },
			],
			{ duration: 260 },
		);
		sound.tone(hz(84), 0.05, 0.04, { type: "triangle" });
	};
}
function waitNext(ms) {
	const btn = $("#next");
	btn.classList.remove("filling");
	void btn.offsetWidth;
	btn.style.setProperty("--ms", `${S.skip ? 1 : ms}ms`);
	btn.classList.add("filling");
	return new Promise((res, rej) => {
		const g = gen;
		const done = () => {
			S.nextNow = null;
			btn.classList.remove("filling");
			g === gen ? res() : rej(STALE);
		};
		const id = after(S.skip ? 30 : ms, done);
		S.nextNow = () => {
			clearTimeout(id);
			done();
		};
	});
}

// ---------- round result ----------
function roundResult() {
	sound.scene = "result";
	const prev = { ...S.totals };
	for (const p of PEOPLE) S.totals[p.id] += S.roundPts[p.id];
	const youValid = S.roundRows.filter((r) => r[0].pts > 0).length;
	S.streak = youValid === 4 ? S.streak + 1 : 0;
	const before = [...PEOPLE].sort((a, b) => prev[b.id] - prev[a.id]);
	const max = Math.max(1, ...Object.values(S.totals));
	const last = S.round === S.rounds - 1;
	screen(
		"result",
		`<div class="result-head"><span class="letter-tile small">${S.letter}</span><div class="rounds big">${Array.from({ length: S.rounds }, (_, i) => `<i class="${i <= S.round ? "done" : ""}"></i>`).join("")}</div></div>
		<ol class="ranking" id="ranking">${before
			.map(
				(
					p,
				) => `<li class="rank ${p.id === "you" ? "me" : ""}" data-rank="${p.id}" style="--pc:${p.color};--w:${prev[p.id] / max}">
					<span class="pos"></span>${avatar(p)}<span class="name">${p.name}</span>
					${p.id === "you" && S.streak >= 1 ? `<span class="streak" title="Alle 4 gültig">${icon("flame")}<b>${S.streak}</b></span>` : ""}
					<span class="bar"><i></i></span><span class="gain">+${S.roundPts[p.id]}</span><b class="total">${prev[p.id]}</b><span class="ready">${icon("check")}</span></li>`,
			)
			.join("")}</ol>
		<button type="button" class="btn primary" id="cont">${last ? icon("crown") : `<span>Runde ${S.round + 2}</span>`}${icon("arrow")}</button>`,
	);
	const rows = () => $$("#ranking .rank");
	const setPos = () =>
		rows().forEach(
			(r, i) =>
				($(".pos", r).innerHTML = i === 0 ? icon("crown") : String(i + 1)),
		);
	setPos();
	$("#cont").addEventListener("click", () => {
		if (last) podium();
		else {
			S.round++;
			startRound();
		}
	});
	run(async () => {
		await sleep(350);
		for (const r of rows()) {
			const id = r.dataset.rank;
			r.classList.add("gaining");
			r.style.setProperty("--w", S.totals[id] / max);
			countUp($(".total", r), prev[id], S.totals[id], 700);
			if (S.roundPts[id])
				sound.tone(hz(76 + (id === "you" ? 7 : 0)), 0.1, 0.05, {
					type: "triangle",
				});
			await sleep(140);
		}
		await sleep(800);
		const list = $("#ranking");
		const first = new Map(
			rows().map((r) => [r, r.getBoundingClientRect().top]),
		);
		const sorted = [...rows()].sort(
			(a, b) => S.totals[b.dataset.rank] - S.totals[a.dataset.rank],
		);
		const oldYou = before.findIndex((p) => p.id === "you");
		const newYou = sorted.findIndex((r) => r.dataset.rank === "you");
		sorted.forEach((r) => list.append(r));
		let moved = false;
		for (const r of sorted) {
			const dy = first.get(r) - r.getBoundingClientRect().top;
			if (Math.abs(dy) > 2) {
				moved = true;
				anim(r, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
					duration: 650,
					easing: "cubic-bezier(.5,0,.2,1.2)",
				});
			}
		}
		setPos();
		if (moved) sound.whoosh();
		if (newYou < oldYou) {
			await sleep(500);
			const me = $('[data-rank="you"]');
			me.classList.add("up");
			fx.at(me, { n: 30, speed: 9 });
			sound.combo(4 - newYou);
		}
		if (S.streak >= 2) {
			const st = $(".streak");
			anim(
				st,
				[
					{ transform: "scale(1)" },
					{ transform: "scale(1.6) rotate(-10deg)" },
					{ transform: "scale(1)" },
				],
				{ duration: 500 },
			);
			fx.at(st, { n: 14, speed: 6, colors: ["#ff7a2f", "#ffd93b", "#ff3f5f"] });
		}
		log("round_result", {
			you: S.roundPts.you,
			total: S.totals.you,
			rank: newYou + 1,
		});
		for (const b of shuffle(BOTS)) {
			await sleep(rand(500, 1100));
			const r = $(`[data-rank="${b.id}"]`);
			r.classList.add("is-ready");
			sound.pop();
		}
		$("#cont").classList.add("nudge");
	});
}
function countUp(el, from, to, ms) {
	if (!el) return;
	const t0 = performance.now();
	const stepFn = (now) => {
		const k = Math.min(1, (now - t0) / ms);
		el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
		if (k < 1 && el.isConnected) requestAnimationFrame(stepFn);
	};
	requestAnimationFrame(stepFn);
}

// ---------- podium ----------
function podium() {
	sound.scene = "lobby";
	const ranked = [...PEOPLE].sort((a, b) => S.totals[b.id] - S.totals[a.id]);
	const place = ranked.findIndex((p) => p.id === "you") + 1;
	const best = [...S.words].sort(
		(a, b) => b.pts - a.pts || b.word.length - a.word.length,
	)[0];
	const slots = [ranked[1], ranked[0], ranked[2]];
	screen(
		"podium",
		`<div class="podium-row">${slots
			.map(
				(
					p,
					i,
				) => `<div class="step s${[2, 1, 3][i]} ${p.id === "you" ? "me" : ""}" data-step="${p.id}">
					<div class="step-av">${[2, 1, 3][i] === 1 ? `<span class="crown">${icon("crown")}</span>` : ""}${avatar(p, "big")}<b>${S.totals[p.id]}</b></div>
					<div class="block"><span>${[2, 1, 3][i]}</span></div></div>`,
			)
			.join("")}</div>
		${place === 4 ? `<div class="fourth">${avatar(PEOPLE[0])}<b>${S.totals.you}</b><span>4</span></div>` : ""}
		${best ? `<div class="best-word"><span class="cat">${icon(CATS[best.cat].icon)}</span><div class="tiles mini" id="best" data-max="30" data-letter="${best.letter}"><span class="caret"></span></div><span class="pts p${best.pts} on">${best.pts}</span></div>` : ""}
		<div class="end-actions"><button type="button" class="btn primary" id="again">${icon("arrow")}<span>Nochmal</span></button><button type="button" class="btn ghost" id="to-sprint">${icon("bolt")}<span>Sprint</span></button></div>`,
	);
	if (best) paintTiles($("#best"), best.word, best.letter, false);
	$("#again").addEventListener("click", startMatch);
	$("#to-sprint").addEventListener("click", () => {
		S.mode = "sprint";
		startSprint();
	});
	log("match_over", {
		place,
		total: S.totals.you,
		ms: Math.round(performance.now() - S.matchStart),
	});
	run(async () => {
		for (const id of [ranked[2].id, ranked[1].id, ranked[0].id]) {
			await sleep(420);
			const st = $(`[data-step="${id}"]`);
			st.classList.add("up");
			sound.stamp(id === ranked[0].id ? 20 : 10);
		}
		await sleep(400);
		sound.fanfare();
		fx.rain(place === 1 ? 160 : 70);
		if (place === 1) slam(`${avatar(PEOPLE[0])}<b>1</b>`, "win");
		$("#rate").classList.add("nudge");
	});
}

// ---------- sprint ----------
const SPRINT_MS = 45000;
function startSprint() {
	const letters = shuffle(LETTERS);
	S.sprint = {
		letters,
		li: 0,
		cat: 0,
		words: [],
		batch: new Set(),
		combo: 0,
		lastAt: -1e9,
		score: 0,
		maxCombo: 0,
		t: 0,
		record: false,
	};
	S.letter = letters[0];
	S.playing = false;
	S.ending = false;
	log("sprint_started");
	screen(
		"sprint",
		`<div class="hud">
			<div class="letter-tile" id="letter">${S.letter}</div>
			<div class="hud-mid"><div class="sprint-score"><b id="sp-score">0</b>${db.best ? `<small>${icon("crown")}${db.best}</small>` : ""}</div><div class="fuse" id="fuse"><i></i><b></b></div></div>
		</div>
		<div class="combo" id="combo"><b>×1</b><i></i></div>
		<div class="sprint-cats">${CATS.map((c, i) => `<span data-sc="${i}">${icon(c.icon)}</span>`).join("")}</div>
		<label class="card big" id="sp-card"><span class="cat" id="sp-cat"></span>${tilesHTML("", 46, S.letter)}<input class="answer" id="sp-input" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="24" enterkeyhint="next" disabled><span class="lock">${icon("check")}</span></label>
		<div class="sprint-actions"><button type="button" class="btn ghost" id="sp-skip" aria-label="Überspringen">${icon("skip")}</button></div>
		<div class="chain" id="chain"></div>
		<div class="slot-host"></div>`,
	);
	paintSprintCat();
	const input = $("#sp-input");
	const box = $("#sp-card .tiles");
	input.addEventListener("input", () => {
		if (!S.playing) return;
		const grew = [...input.value].length > (box._chars?.length || 0);
		paintTiles(box, input.value, S.letter);
		if (grew) {
			sound.key([...input.value].length - 1 + S.sprint.combo);
			const last = $$(".tile", box).at(-1);
			if (last) fx.at(last, { n: 3, speed: 2.4, size: 4 });
		}
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			sprintCommit();
		}
	});
	$("#sp-skip").addEventListener("click", () => {
		sprintSkip();
		input.focus();
	});
	sound.scene = "lobby";
	run(async () => {
		await slotReveal(S.letter);
		S.playing = true;
		sound.scene = "sprint";
		sound.step = 0;
		input.disabled = false;
		input.focus();
	});
}
function paintSprintCat() {
	const sp = S.sprint;
	const c = CATS[sp.cat];
	$("#sp-cat").innerHTML = `${icon(c.icon)}<span>${c.name}</span>`;
	$("#sp-input").setAttribute("aria-label", `${c.name} mit ${S.letter}`);
	$$("[data-sc]").forEach((el, i) => {
		el.classList.toggle("now", i === sp.cat);
		el.classList.toggle("done", sp.batch.has(i));
	});
	$("#sp-card .tiles").dataset.letter = S.letter;
	$("#sp-card .ghost").textContent = S.letter;
}
function sprintCommit() {
	const sp = S.sprint;
	if (!S.playing) return;
	const input = $("#sp-input");
	const word = input.value.trim();
	const card = $("#sp-card");
	if (
		!ruleValid(word, S.letter) ||
		sp.words.some(
			(w) =>
				w.letter === S.letter &&
				w.cat === sp.cat &&
				norm(w.word) === norm(word),
		)
	) {
		if (word) wrong(card);
		return;
	}
	const now = sp.t;
	sp.combo = now - sp.lastAt <= 6000 ? Math.min(5, sp.combo + 1) : 1;
	sp.lastAt = now;
	sp.maxCombo = Math.max(sp.maxCombo, sp.combo);
	const pts = 10 * sp.combo;
	sp.score += pts;
	sp.words.push({ word, letter: S.letter, cat: sp.cat, pts, valid: true });
	sp.batch.add(sp.cat);
	log("sprint_word", { cat: sp.cat, combo: sp.combo });
	const box = $(".tiles", card);
	const r = box.getBoundingClientRect();
	floatText(`+${pts}`, r.left + r.width / 2, r.top, `pts-float c${sp.combo}`);
	fx.at(box, { n: 10 + sp.combo * 4, speed: 5 + sp.combo });
	sound.word(sp.combo);
	sound.layer = sp.combo;
	if (sp.combo >= 2) {
		sound.combo(sp.combo);
		const c = $("#combo");
		$("b", c).textContent = `×${sp.combo}`;
		anim(
			c,
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.5) rotate(-6deg)" },
				{ transform: "scale(1)" },
			],
			{ duration: 380 },
		);
	}
	if (!sp.record && db.best && sp.score > db.best) {
		sp.record = true;
		slam(`${icon("crown")}<b>${sp.score}</b>`, "win");
		sound.fanfare();
	}
	const chip = document.createElement("span");
	chip.className = "chip";
	chip.style.setProperty("--c", `var(--t${(sp.words.length % 5) + 1})`);
	chip.innerHTML = `${icon(CATS[sp.cat].icon)}${esc(word)}`;
	$("#chain").prepend(chip);
	countUp($("#sp-score"), sp.score - pts, sp.score, 300);
	input.value = "";
	paintTiles(box, "", S.letter, false);
	if (sp.batch.size === 4) return nextSprintLetter(true);
	sp.cat = (sp.cat + 1) % 4;
	paintSprintCat();
}
function sprintSkip() {
	const sp = S.sprint;
	if (!S.playing) return;
	sp.combo = 0;
	paintCombo();
	sound.poof();
	$("#sp-input").value = "";
	paintTiles($("#sp-card .tiles"), "", S.letter, false);
	sp.cat = (sp.cat + 1) % 4;
	if (sp.cat === 0) return nextSprintLetter(false);
	paintSprintCat();
}
function paintCombo() {
	const c = $("#combo");
	if (c) $("b", c).textContent = `×${Math.max(1, S.sprint.combo)}`;
}
function nextSprintLetter(clear) {
	const sp = S.sprint;
	S.playing = false;
	if (clear) {
		setPalette(S.palette + 1);
		sound.clear();
		slam(`<b class="slam-num">4/4</b>`, "clear");
		const pts = 20 * Math.max(1, sp.combo);
		sp.score += pts;
		countUp($("#sp-score"), sp.score - pts, sp.score, 400);
		fx.rain(40);
	}
	sp.li++;
	sp.cat = 0;
	sp.batch = new Set();
	S.letter = sp.letters[sp.li % sp.letters.length];
	run(async () => {
		await sleep(clear ? 500 : 100);
		await slotReveal(S.letter, { quick: true });
		$("#letter").textContent = S.letter;
		anim(
			$("#letter"),
			[
				{ transform: "scale(1.8)", opacity: 0 },
				{ transform: "none", opacity: 1 },
			],
			{ duration: 350 },
		);
		paintSprintCat();
		S.playing = true;
		sp.lastAt = sp.t;
		$("#sp-input").focus();
	});
}
function tickSprint(dt) {
	const sp = S.sprint;
	if (!sp || S.ending) return;
	if (S.playing) sp.t += dt;
	const left = SPRINT_MS - sp.t;
	const fuse = $("#fuse");
	if (fuse) {
		fuse.style.setProperty("--f", Math.max(0, left / SPRINT_MS).toFixed(4));
		fuse.classList.toggle("hot", left < 10000);
	}
	document.body.classList.toggle("urgent", left < 10000);
	if (left < 10000 && sound.scene === "sprint") sound.scene = "final";
	const sec = Math.ceil(left / 1000);
	if (left < 5000 && sec !== S.lastSec) {
		S.lastSec = sec;
		sound.tick();
		floatOnFuse(sec);
	}
	const c = $("#combo i");
	if (c) {
		const k = sp.combo ? Math.max(0, 1 - (sp.t - sp.lastAt) / 6000) : 0;
		c.style.setProperty("--k", k.toFixed(3));
		if (k === 0 && sp.combo > 1 && S.playing) {
			sp.combo = 0;
			paintCombo();
		}
	}
	if (left <= 0) endSprint();
}
function endSprint() {
	S.ending = true;
	S.playing = false;
	document.body.classList.remove("urgent");
	$("#sp-input").disabled = true;
	slam("<b>ZEIT</b>");
	sound.slam();
	sound.layer = 0;
	log("sprint_ended", { words: S.sprint.words.length, score: S.sprint.score });
	run(async () => {
		await sleep(1000);
		sprintReview();
	});
}
function sprintReview() {
	sound.scene = "review";
	const sp = S.sprint;
	const byLetter = {};
	for (const [i, w] of sp.words.entries())
		(byLetter[w.letter] ??= []).push([i, w]);
	screen(
		"sprint-review",
		`<div class="sr-head"><b id="sr-score">${sp.score}</b><span>${icon("check")} ${sp.words.length}</span></div>
		<div class="sr-list">${Object.entries(byLetter)
			.map(
				([L, ws]) =>
					`<div class="sr-group"><span class="letter-tile small">${L}</span><div class="sr-words">${ws
						.map(
							([i, w]) =>
								`<button type="button" class="chip" data-w="${i}" aria-pressed="true" style="--c:var(--t${(i % 5) + 1})">${icon(CATS[w.cat].icon)}${esc(w.word)}<small>${w.pts}</small></button>`,
						)
						.join("")}</div></div>`,
			)
			.join("")}</div>
		<button type="button" class="btn primary" id="sr-done">${icon("arrow")}</button>`,
	);
	$$("[data-w]").forEach((b) =>
		b.addEventListener("click", () => {
			const w = sp.words[Number(b.dataset.w)];
			w.valid = !w.valid;
			b.setAttribute("aria-pressed", String(w.valid));
			b.classList.toggle("struck", !w.valid);
			w.valid ? sound.word(1) : sound.crunch();
			const score =
				sp.score -
				sp.words.filter((x) => !x.valid).reduce((a, x) => a + x.pts, 0);
			$("#sr-score").textContent = score;
		}),
	);
	$("#sr-done").addEventListener("click", sprintResult);
	run(async () => {
		for (const b of $$("[data-w]")) {
			b.classList.add("in");
			sound.tone(hz(80 + (Number(b.dataset.w) % 8)), 0.05, 0.04, {
				type: "triangle",
			});
			await sleep(60);
		}
	});
}
function sprintResult() {
	sound.scene = "result";
	const sp = S.sprint;
	const score =
		sp.score - sp.words.filter((x) => !x.valid).reduce((a, x) => a + x.pts, 0);
	const record = score > db.best;
	const oldBest = db.best;
	if (record) {
		db.best = score;
		save();
	}
	screen(
		"sprint-result",
		`<div class="big-score"><b id="final">0</b>${record ? `<span class="badge">${icon("crown")}</span>` : `<small>${icon("crown")} ${oldBest}</small>`}</div>
		<div class="stats"><span>${icon("check")}<b>${sp.words.filter((w) => w.valid).length}</b></span><span>${icon("bolt")}<b>×${sp.maxCombo}</b></span><span>${icon("grid")}<b>${sp.li}</b></span></div>
		<div class="end-actions"><button type="button" class="btn primary" id="again">${icon("arrow")}<span>Nochmal</span></button><button type="button" class="btn ghost" id="to-classic">${icon("grid")}<span>Klassisch</span></button></div>`,
	);
	countUp($("#final"), 0, score, 1100);
	$("#again").addEventListener("click", startSprint);
	$("#to-classic").addEventListener("click", () => {
		S.mode = "classic";
		startMatch();
	});
	log("sprint_result", { score, record });
	run(async () => {
		for (let i = 0; i < 8; i++) {
			await sleep(130);
			sound.slot(i * 3);
		}
		sound.fanfare();
		if (record) {
			fx.rain(150);
			slam(`${icon("crown")}<b>${score}</b>`, "win");
		}
		$("#rate").classList.add("nudge");
	});
}

// ---------- loop ----------
let lastT = performance.now();
function frame(now) {
	const dt = Math.min(100, now - lastT);
	lastT = now;
	if (!document.hidden) {
		if (S.phase === "play" && S.playing) {
			S.elapsed += dt;
			tickBots();
		}
		if (S.phase === "sprint") tickSprint(dt);
		sound.schedule();
	}
	fx.draw();
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- chrome ----------
function paintSoundButton() {
	const b = $("#sound");
	b.innerHTML = icon(sound.on ? "sound" : "mute");
	b.setAttribute("aria-pressed", String(sound.on));
	b.setAttribute("aria-label", sound.on ? "Ton aus" : "Ton an");
}
$("#sound").addEventListener("click", () => sound.setOn(!sound.on));
$("#rate").innerHTML = icon("rate");
$$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
$$(".looks button").forEach((b) =>
	b.addEventListener("click", () => {
		setLook(b.dataset.look);
		sound.start();
		sound.pop();
		fx.at(b, { n: 12, speed: 5 });
		log("look_changed");
	}),
);
document.addEventListener("visibilitychange", () => {
	if (!sound.ctx) return;
	document.hidden
		? sound.ctx.suspend().catch(() => {})
		: sound.on && sound.ctx.resume().catch(() => {});
});
const media = matchMedia("(prefers-reduced-motion: reduce)");
document.body.classList.toggle("reduced", db.reduced ?? media.matches);
$("#reduce-motion").checked = document.body.classList.contains("reduced");
$("#reduce-motion").addEventListener("change", (e) => {
	db.reduced = e.target.checked;
	save();
	document.body.classList.toggle("reduced", e.target.checked);
});
$("#volume").value = Math.round(sound.volume * 100);
$("#volume").addEventListener("input", (e) =>
	sound.setVolume(Number(e.target.value) / 100),
);

// ---------- rating ----------
const SCALES = [
	["fun", "Spaß"],
	["again", "Nochmal spielen"],
	["typing", "Schreiben"],
	["review", "Bewertung"],
	["result", "Rangliste & Ende"],
	["music", "Musik"],
	["design", "Aussehen"],
];
let ratings = {};
function openRate() {
	ratings = {};
	$("#rate").classList.remove("nudge");
	$("#rate-context").textContent =
		`${{ block: "Block", paper: "Papier", pop: "Pop" }[S.look]} · ${S.mode === "sprint" ? "Sprint" : "Klassisch"}`;
	$("#rate-scales").innerHTML = SCALES.map(
		([k, label]) =>
			`<div class="scale" data-scale="${k}"><span>${label}</span><div>${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" data-v="${n}" aria-pressed="false" aria-label="${label} ${n}">${n}</button>`).join("")}</div></div>`,
	).join("");
	$("#rate-notes").value = "";
	$("#rate-status").textContent = "";
	$("#rate-dialog").showModal();
}
$("#rate").addEventListener("click", openRate);
$("#rate-scales").addEventListener("click", (e) => {
	const b = e.target.closest("[data-v]");
	if (!b) return;
	const scale = b.closest("[data-scale]");
	ratings[scale.dataset.scale] = Number(b.dataset.v);
	$$("button", scale).forEach((x) =>
		x.setAttribute("aria-pressed", String(x === b)),
	);
});
$("#rate-save").addEventListener("click", () => {
	db.records.push({
		at: new Date().toISOString(),
		participant: db.participant,
		sessionId,
		look: S.look,
		mode: S.mode,
		phaseAtRating: S.phase,
		roundsPlayed: S.mode === "classic" ? S.round + 1 : null,
		sprintScore: S.sprint?.score ?? null,
		ratings: { ...ratings },
		notes: $("#rate-notes").value.trim(),
	});
	save();

	$("#rate-status").innerHTML = `${icon("check")} ${db.records.length}`;
	after(600, () => $("#rate-dialog").close());
});
$("#rate-export").addEventListener("click", () => {
	const blob = new Blob(
		[
			JSON.stringify(
				{
					schema: 3,
					labVersion: 3,
					exportedAt: new Date().toISOString(),
					...db,
				},
				null,
				2,
			),
		],
		{
			type: "application/json",
		},
	);
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = `slf-spieltest-v3-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("#rate-reset").addEventListener("click", () => {
	if (!confirm("Alle Testdaten auf diesem Gerät löschen?")) return;
	db.records = [];
	db.events = [];
	db.best = 0;
	save();
	$("#rate-status").textContent = "0";
});

setLook(S.look);
paintSoundButton();
const look = new URLSearchParams(location.search).get("look");
if (look && PALETTES[look]) setLook(look);
lobby();
