const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const icons = {
	city: '<path d="M3 21h18M5 21V9l6-3v15M11 21V3h7v18M7 12h1m-1 4h1m6-10h1m-1 4h1m-1 4h1m-1 4h1m3-6h3v9"/>',
	globe:
		'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
	animal:
		'<path d="M6 9 4 3l6 3h4l6-3-2 6c2 2 2 7-1 10-3 3-7 3-10 0-3-3-3-8-1-10Z"/><path d="M8 12h.01M16 12h.01M10 16l2 1 2-1M12 17v2"/>',
	job: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12c5 4 13 4 18 0M10 14h4"/>',
	arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
	check: '<path d="m5 12 4 4L19 6"/>',
	close: '<path d="m6 6 12 12M6 18 18 6"/>',
	volume:
		'<path d="M11 4 6 8H3v8h3l5 4V4ZM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>',
	muted: '<path d="M11 4 6 8H3v8h3l5 4V4ZM16 9l6 6m-6 0 6-6"/>',
	settings:
		'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
	sliders:
		'<path d="M4 7h16M4 17h16"/><rect x="7" y="4" width="4" height="6" rx="1"/><rect x="14" y="14" width="4" height="6" rx="1"/>',
	finish: '<path d="M5 21V3m0 1h13l-3 4 3 4H5"/>',
	clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6m-3 0v3"/>',
	skip: '<path d="m5 5 8 7-8 7V5ZM18 5v14"/>',
	restart: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
	link: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
};
const icon = (name) =>
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.check}</svg>`;
const paintIcons = () =>
	$$("[data-icon]").forEach((el) => {
		el.innerHTML = icon(el.dataset.icon);
	});
const escapeHTML = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(ch) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				ch
			],
	);
const uuid = () =>
	crypto.randomUUID?.() ||
	`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const CATEGORIES = ["Stadt", "Land", "Tier", "Beruf"];
const CATEGORY_ICONS = ["city", "globe", "animal", "job"];
const SETS = [
	{ letter: "M", bot: ["Madrid", "Mexiko", "Maus", "Maler"] },
	{ letter: "B", bot: ["Berlin", "Belgien", "Bär", "Bäcker"] },
	{ letter: "S", bot: ["Salzburg", "Schweden", "Schaf", "Sänger"] },
	{ letter: "K", bot: ["Köln", "Kanada", "Katze", "Koch"] },
	{ letter: "T", bot: ["Trier", "Türkei", "Tiger", "Tischler"] },
	{ letter: "W", bot: ["Wien", "Weißrussland", "Wolf", "Winzer"] },
];
const PALETTES = [
	{
		accent: "#c9ff91",
		rgb: "201,255,145",
		second: "#a68cff",
		third: "#67e1da",
	},
	{
		accent: "#8be9f5",
		rgb: "139,233,245",
		second: "#91a5ff",
		third: "#d2a5ff",
	},
	{
		accent: "#ffbb8a",
		rgb: "255,187,138",
		second: "#ee8dbe",
		third: "#b8a5ff",
	},
	{
		accent: "#c8b0ff",
		rgb: "200,176,255",
		second: "#ff9cba",
		third: "#8ee9d8",
	},
	{
		accent: "#f5df91",
		rgb: "245,223,145",
		second: "#a8ddaf",
		third: "#efa5cb",
	},
];
const MODE_NAMES = {
	classic: "Klassisch",
	duel: "Duell · Bot",
	chain: "Sprint",
};
const MATERIAL_NAMES = { light: "Licht", solid: "Prägung", pulse: "Impuls" };
const STORAGE = "slf-engagement-lab-v2";
let persistenceAvailable = true;
function readStore() {
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE) || "null");
		return raw?.schema === 2 &&
			Array.isArray(raw.records) &&
			Array.isArray(raw.events)
			? raw
			: null;
	} catch {
		return null;
	}
}
const db = readStore() || {
	schema: 2,
	participant: uuid(),
	records: [],
	events: [],
	best: {},
};
db.best ||= {};
function persist() {
	try {
		localStorage.setItem(STORAGE, JSON.stringify(db));
	} catch {
		persistenceAvailable = false;
	}
}
const state = {
	phase: "ready",
	mode: "classic",
	material: "light",
	round: 0,
	palette: 0,
	answers: ["", "", "", ""],
	valid: [true, true, true, true],
	committed: new Set(),
	botCount: 0,
	total: 0,
	botTotal: 0,
	elapsed: 0,
	duelDeadline: null,
	allClear: false,
	chain: [],
	chainCategory: 0,
	chainSet: 0,
	chainBatch: 0,
	activeMs: 0,
	startedAt: performance.now(),
	attemptId: uuid(),
	sessionId: uuid(),
	blind: null,
	ratings: {},
	saved: false,
	bestWord: "",
	bestWordPoints: 0,
	completedRounds: 0,
	endingReason: null,
	pause: new Set(),
	typingCount: 0,
};
const laterIds = new Set();
function later(callback, milliseconds) {
	const id = setTimeout(() => {
		laterIds.delete(id);
		callback();
	}, milliseconds);
	laterIds.add(id);
	return id;
}
function clearLater() {
	laterIds.forEach(clearTimeout);
	laterIds.clear();
	$("#effects").replaceChildren();
}
function log(type, data = {}) {
	db.events.push({
		type,
		at: new Date().toISOString(),
		participant: db.participant,
		attemptId: state.attemptId,
		sessionId: state.sessionId,
		comparisonId: state.blind?.id || null,
		trial: state.blind ? state.blind.index + 1 : null,
		mode: state.mode,
		material: state.material,
		phase: state.phase,
		round: state.round + 1,
		activeMs: Math.round(state.activeMs),
		...data,
	});
	persist();
}
const currentSet = () =>
	SETS[(state.mode === "chain" ? state.chainSet : state.round) % SETS.length];
const currentLetter = () => currentSet().letter;
const simpleUpper = (text) =>
	[...text]
		.map((c) => ([...c.toUpperCase()].length === 1 ? c.toUpperCase() : c))
		.join("");
const normalize = (text) =>
	text.trim().normalize("NFC").toLocaleLowerCase("de");
function ruleValid(text, letter = currentLetter()) {
	const v = text.trim();
	return (
		[...v].length >= 2 &&
		[...v].length <= 30 &&
		simpleUpper(v).startsWith(letter)
	);
}
const reduced = () =>
	$("#reduce-motion").checked ||
	matchMedia("(prefers-reduced-motion: reduce)").matches;
function announce(text) {
	$("#live-status").textContent = text;
}
function animate(el, keyframes, options = {}) {
	if (!el || reduced()) return null;
	return el.animate(keyframes, {
		duration: 350,
		easing: "cubic-bezier(.16,1,.3,1)",
		...options,
	});
}

class Sound {
	constructor() {
		this.enabled = true;
		this.ctx = null;
		this.master = null;
		this.musicBus = null;
		this.sfxBus = null;
		this.step = 0;
		this.nextNote = 0;
		this.volume = 0.55;
		this.style = "light";
		this.layer = 0;
		this.lastKey = 0;
		this.scheduled = [];
	}
	async start() {
		if (!this.enabled) return;
		try {
			if (!this.ctx) {
				const Audio = window.AudioContext || window.webkitAudioContext;
				if (!Audio) return;
				this.ctx = new Audio();
				this.master = this.ctx.createGain();
				this.musicBus = this.ctx.createGain();
				this.sfxBus = this.ctx.createGain();
				const compressor = this.ctx.createDynamicsCompressor();
				compressor.threshold.value = -18;
				compressor.ratio.value = 5;
				this.musicBus.gain.value = 0.72;
				this.sfxBus.gain.value = 0.95;
				this.musicBus.connect(this.master);
				this.sfxBus.connect(this.master);
				this.master.connect(compressor);
				compressor.connect(this.ctx.destination);
				this.master.gain.value = this.volume * 0.28;
				this.nextNote = this.ctx.currentTime;
			}
			await this.ctx.resume();
			this.nextNote = Math.max(this.nextNote, this.ctx.currentTime);
		} catch {
			this.enabled = false;
			updateAudioButton();
		}
	}
	tone(
		freq,
		duration = 0.2,
		gain = 0.1,
		when = 0,
		type = "sine",
		bus = "sfx",
		glide = 0,
	) {
		if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
		const ctx = this.ctx,
			t = when || ctx.currentTime;
		const osc = ctx.createOscillator(),
			env = ctx.createGain(),
			filter = ctx.createBiquadFilter();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (glide)
			osc.frequency.exponentialRampToValueAtTime(glide, t + duration * 0.7);
		filter.type = "lowpass";
		filter.frequency.value = bus === "music" ? 1500 : 5500;
		env.gain.setValueAtTime(0.0001, t);
		env.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.008);
		env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
		osc.connect(filter);
		filter.connect(env);
		env.connect(bus === "music" ? this.musicBus : this.sfxBus);
		osc.start(t);
		osc.stop(t + duration + 0.02);
		const entry = { osc, env, filter, t };
		this.scheduled.push(entry);
		osc.onended = () => {
			osc.disconnect();
			env.disconnect();
			filter.disconnect();
			const i = this.scheduled.indexOf(entry);
			if (i >= 0) this.scheduled.splice(i, 1);
		};
	}
	key(index, length) {
		if (!this.ctx || performance.now() - this.lastKey < 33) return;
		this.lastKey = performance.now();
		const scale = [0, 3, 5, 7, 10, 12];
		const midi = 65 + scale[(length + index) % scale.length];
		const f = 440 * 2 ** ((midi - 69) / 12);
		if (this.style === "solid") {
			this.tone(115 + index * 16, 0.055, 0.15, 0, "triangle");
			this.tone(f, 0.075, 0.03);
		} else if (this.style === "pulse") {
			this.tone(f * 0.5, 0.085, 0.12, 0, "triangle", "sfx", f * 0.49);
			this.tone(f * 2, 0.05, 0.025);
		} else {
			this.tone(f, 0.1, 0.085);
			this.tone(f * 2.005, 0.08, 0.022);
		}
	}
	word(index) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		[0, 4, 7].forEach((v, i) =>
			this.tone(
				261.63 * 2 ** ((v + index * 2) / 12),
				0.26,
				0.12,
				t + i * 0.037,
				this.style === "solid" ? "triangle" : "sine",
			),
		);
		this.tone(80, 0.13, 0.2, t, "sine", "sfx", 40);
	}
	clear() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		[0, 4, 7, 12, 16].forEach((v, i) =>
			this.tone(261.63 * 2 ** (v / 12), 0.4, 0.12, t + i * 0.05),
		);
	}
	stop() {
		this.tone(95, 0.25, 0.22, 0, "triangle", "sfx", 48);
	}
	tick() {
		this.tone(880, 0.04, 0.05);
	}
	tickMusic() {
		if (
			!this.enabled ||
			!this.ctx ||
			this.ctx.state !== "running" ||
			state.pause.size ||
			state.phase !== "playing"
		)
			return;
		const ctx = this.ctx,
			beat =
				60 /
				(state.mode === "duel" && state.duelDeadline
					? 124
					: state.mode === "chain"
						? 112
						: 100) /
				2;
		if (this.nextNote < ctx.currentTime - 0.2) this.nextNote = ctx.currentTime;
		while (this.nextNote < ctx.currentTime + 0.1) {
			const t = this.nextNote,
				step = this.step++ % 16;
			const roots = [130.81, 103.83, 155.56, 116.54],
				root = roots[Math.floor(this.step / 32) % roots.length];
			if (step % 4 === 0) this.tone(root / 2, 0.35, 0.17, t, "sine", "music");
			if (step % 2 === 0) this.tone(50, 0.11, 0.14, t, "sine", "music", 28);
			if (step % 4 === 2) this.tone(180, 0.035, 0.05, t, "triangle", "music");
			const arp = [0, 7, 12, 15, 7, 10, 12, 19];
			if (step % 2 === 0 || this.layer >= 2)
				this.tone(
					root * 2 ** (arp[step % 8] / 12),
					0.28,
					0.045 + this.layer * 0.009,
					t,
					"triangle",
					"music",
				);
			if (this.layer >= 3 && step % 4 === 1)
				this.tone(root * 4, 0.06, 0.018, t, "sine", "music");
			this.nextNote += beat;
		}
	}
	mute(value) {
		this.enabled = !value;
		if (this.ctx)
			this.master.gain.setTargetAtTime(
				value ? 0 : this.volume * 0.28,
				this.ctx.currentTime,
				0.05,
			);
		if (!value) this.start();
		updateAudioButton();
	}
	pause(value) {
		if (!this.ctx) return;
		if (value) {
			this.ctx.suspend().catch(() => {});
		} else if (this.enabled) this.start();
	}
	setVolume(value) {
		this.volume = value;
		if (this.ctx)
			this.master.gain.setTargetAtTime(
				this.enabled ? value * 0.28 : 0,
				this.ctx.currentTime,
				0.05,
			);
	}
}
const sound = new Sound();

class World {
	constructor() {
		this.canvas = $("#world");
		this.ctx = this.canvas.getContext("2d");
		this.width = innerWidth;
		this.height = innerHeight;
		this.energy = 0;
		this.ripples = [];
		this.frame = 0;
		this.resize();
	}
	resize() {
		const ratio = Math.min(devicePixelRatio || 1, 1.75);
		this.width = innerWidth;
		this.height = innerHeight;
		this.canvas.width = this.width * ratio;
		this.canvas.height = this.height * ratio;
		this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
	}
	hit(power = 0.4, x = 0.55, y = 0.5) {
		this.energy = Math.min(1, this.energy + power);
		if (!reduced())
			this.ripples.push({
				x: x * this.width,
				y: y * this.height,
				life: 1,
				radius: 15,
			});
	}
	draw(now) {
		if (!this.ctx) return;
		if (reduced() && this.frame++ % 20 !== 0 && this.energy < 0.05) return;
		const ctx = this.ctx,
			w = this.width,
			h = this.height,
			t = reduced() ? 0 : now / 1000;
		ctx.fillStyle = "#0b0d16";
		ctx.fillRect(0, 0, w, h);
		const blobs = [
			[0.22 + Math.sin(t * 0.11) * 0.035, 0.41, "#33335b"],
			[0.69, 0.3 + Math.cos(t * 0.13) * 0.06, "#163e39"],
			[0.63 + Math.sin(t * 0.07) * 0.09, 0.9, "#332345"],
		];
		blobs.forEach(([x, y, c], i) => {
			const r = Math.max(w, h) * (0.39 + this.energy * 0.035);
			const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, r);
			g.addColorStop(0, c + (i === 1 ? "60" : "70"));
			g.addColorStop(1, c + "00");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
		});
		ctx.save();
		ctx.globalAlpha = 0.065 + this.energy * 0.045;
		ctx.strokeStyle = PALETTES[state.palette % PALETTES.length].accent;
		ctx.lineWidth = 1;
		for (let j = 0; j < 5; j++) {
			ctx.beginPath();
			for (let x = 0; x < w + 20; x += 18) {
				const y =
					h * 0.76 +
					Math.sin((x / w) * 5 + t * 0.24 + j * 0.21) *
						(40 + this.energy * 45) +
					j * 18;
				x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
		ctx.restore();
		if (!reduced()) {
			for (let i = 0; i < 22; i++) {
				const x = ((i * 0.618033 + t * 0.0015) % 1) * w,
					y = ((i * 0.381966 + 0.15 + Math.sin(t * 0.08 + i) * 0.017) % 1) * h;
				ctx.globalAlpha = 0.1 + Math.sin(t * 0.8 + i * 2) ** 2 * 0.12;
				ctx.fillStyle =
					i % 3 ? "#afa0d0" : PALETTES[state.palette % PALETTES.length].accent;
				ctx.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
			}
			ctx.globalAlpha = 1;
			this.ripples = this.ripples.filter((r) => r.life > 0.02);
			this.ripples.forEach((r) => {
				ctx.beginPath();
				ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
				ctx.strokeStyle = `rgba(${PALETTES[state.palette % PALETTES.length].rgb},${r.life * 0.11})`;
				ctx.stroke();
				r.radius += 3.6;
				r.life *= 0.94;
			});
		}
		this.energy *= 0.95;
	}
}
const world = new World();

function setPalette(index) {
	state.palette = index % PALETTES.length;
	const p = PALETTES[state.palette];
	Object.entries({
		"--accent": p.accent,
		"--accent-rgb": p.rgb,
		"--second": p.second,
		"--third": p.third,
	}).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
}
function updateAudioButton() {
	$("#audio-toggle").setAttribute("aria-pressed", String(sound.enabled));
	$("#audio-toggle").setAttribute(
		"aria-label",
		sound.enabled ? "Ton ausschalten" : "Ton einschalten",
	);
	$("#audio-toggle").innerHTML = icon(sound.enabled ? "volume" : "muted");
	document.body.classList.toggle(
		"music-on",
		sound.enabled && state.phase === "playing" && !state.pause.size,
	);
}
function setPhase(phase) {
	state.phase = phase;
	document.body.dataset.phase = phase;
	updateAudioButton();
}
function updateHeader() {
	const chain = state.mode === "chain",
		playing = state.phase === "playing";
	$("#main-letter").textContent = currentLetter();
	$(".letter-shadow").textContent = currentLetter();
	$("#letter-object").setAttribute(
		"aria-label",
		"Buchstabe " + currentLetter(),
	);
	$("#round-track").innerHTML = chain
		? '<i class="active"></i><i></i><i></i><i></i>'
		: Array.from(
				{ length: 3 },
				(_, i) =>
					`<i class="${i < state.round ? "done" : i === state.round ? "active" : ""}"></i>`,
			).join("");
	$("#round-track").setAttribute(
		"aria-label",
		chain ? "Sprint" : `Runde ${state.round + 1} von 3`,
	);
	$("#round-label").innerHTML = chain
		? `${state.chain.length.toString().padStart(2, "0")} <i>WÖRTER</i>`
		: `${String(Math.min(state.round + 1, 3)).padStart(2, "0")} <i>/ 03</i>`;
	$("#total-score").innerHTML = `${state.total} <i>PTS</i>`;
	$("#race").hidden = state.mode !== "duel" || state.phase === "end";
	$("#clock-wrap").hidden =
		!(chain && (state.phase === "ready" || playing)) &&
		!(state.mode === "duel" && state.duelDeadline && playing);
	$("#phase-label").textContent =
		state.phase === "review"
			? currentLetter()
			: state.phase === "end"
				? state.mode === "duel"
					? "DU / BOT"
					: "GESAMT"
				: currentLetter();
	const count = chain
		? state.chainBatch
		: state.answers.filter((v) => ruleValid(v)).length;
	$("#board-progress").innerHTML = Array.from(
		{ length: 4 },
		(_, i) => `<i class="${i < count ? "filled" : ""}"></i>`,
	).join("");
	$("#board-progress").setAttribute(
		"aria-label",
		`${count} von 4 Feldern ausgefüllt`,
	);
	$("#orbit-progress").style.strokeDashoffset = String(
		993 * (1 - Math.min(count, 4) / 4),
	);
	$("#you-progress").style.width = `${count * 25}%`;
	$("#you-count").textContent = count;
	$("#bot-progress").style.width = `${state.botCount * 25}%`;
	$("#bot-count").textContent = state.botCount;
	$("#finish-early").hidden = state.phase !== "playing";
	if (chain && !playing)
		$("#clock").textContent = Number($("#duration").value) || "∞";
}
function glyphText(input) {
	const display = input.parentElement.querySelector(".word-display");
	const old = display.dataset.value || "",
		value = input.value;
	let shared = 0;
	while (
		shared < old.length &&
		shared < value.length &&
		old[shared] === value[shared]
	)
		shared++;
	const fragment = document.createDocumentFragment();
	[...value].forEach((ch, i) => {
		const span = document.createElement("span");
		span.className =
			"glyph" + (i >= shared && !input.__composing ? " new" : "");
		span.textContent = ch;
		fragment.append(span);
	});
	display.replaceChildren(fragment);
	display.dataset.value = value;
	requestAnimationFrame(() => {
		if (input.isConnected)
			display.style.transform = `translateX(${-input.scrollLeft}px)`;
	});
}
function fieldHTML(index, { chain = false, disabled = false } = {}) {
	const value = chain ? "" : state.answers[index];
	return `<div class="field ${chain ? "chain-field" : ""} ${ruleValid(value) ? "completed" : ""}" data-field="${index}"><div class="field-icon">${icon(CATEGORY_ICONS[index])}</div><div class="field-content"><label for="word-${index}">${CATEGORIES[index]}</label><div class="input-line"><input id="word-${index}" class="answer" value="${escapeHTML(value)}" placeholder="${currentLetter()}…" maxlength="30" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="${chain ? "next" : index === 3 ? "done" : "next"}" ${disabled ? "disabled" : ""} data-index="${index}"><div class="word-display" aria-hidden="true"></div><div class="field-underline" aria-hidden="true"></div></div></div><span class="field-check" aria-hidden="true">${icon("check")}</span><div class="sweep" aria-hidden="true"></div><span class="field-error" id="error-${index}"></span></div>`;
}
function renderInputs() {
	if (state.mode === "chain") {
		$("#board").innerHTML =
			`<div class="chain-prompt"><div class="chain-category">${icon(CATEGORY_ICONS[state.chainCategory])}${CATEGORIES[state.chainCategory]}</div>${fieldHTML(state.chainCategory, { chain: true, disabled: state.phase === "ready" })}<div class="chain-count"><span>${icon("link")}</span><b id="chain-number">${state.chain.length}</b></div><div class="chain-history" id="chain-history">${state.chain
				.slice(-7)
				.reverse()
				.map((x) => `<span class="word-chip">${escapeHTML(x.value)}</span>`)
				.join("")}</div></div>`;
		$("#board .chain-count svg").style.cssText = "width:16px;height:16px";
	} else
		$("#board").innerHTML = CATEGORIES.map((_, i) =>
			fieldHTML(i, { disabled: state.phase === "ready" }),
		).join("");
	$$(".answer").forEach(bindInput);
	updateHeader();
	updateActions();
}
function updateActions() {
	const chain = state.mode === "chain";
	$("#actions").innerHTML =
		'<button type="button" class="primary" id="primary"><span id="primary-label"></span>' +
		icon("arrow") +
		"</button>";
	const btn = $("#primary");
	if (state.phase === "ready") {
		$("#primary-label").textContent = "Spielen";
		btn.onclick = startGame;
	} else if (state.phase === "playing") {
		$("#primary-label").textContent = chain ? "Weiter" : "STOPP";
		btn.disabled = chain
			? !ruleValid($(".answer")?.value || "")
			: state.mode === "duel" && state.answers.some((x) => !ruleValid(x));
		btn.onclick = chain ? commitChain : finishRound;
		if (chain) {
			const skip = document.createElement("button");
			skip.type = "button";
			skip.className = "chain-skip";
			skip.innerHTML = icon("skip");
			skip.setAttribute("aria-label", "Kategorie überspringen");
			skip.title = "Überspringen";
			skip.onclick = skipChain;
			$("#actions").append(skip);
		}
	} else if (state.phase === "review") {
		$("#primary-label").textContent =
			state.mode === "chain" || state.round === 2 ? "Ergebnis" : "Weiter";
		btn.onclick = confirmReview;
	} else if (state.phase === "end") {
		$("#primary-label").textContent = "Nochmal";
		btn.onclick = () => {
			log("free_choice", { choice: "continue" });
			resetGame({ reason: "rematch" });
			startGame();
		};
		const end = document.createElement("button");
		end.type = "button";
		end.className = "finish-button";
		end.innerHTML = icon("close");
		end.title = "Für heute fertig";
		end.setAttribute("aria-label", "Für heute fertig");
		end.onclick = () => {
			log("free_choice", { choice: "finish" });
			setPhase("finished");
			$("#board").innerHTML =
				'<div class="end-board"><span class="finished-state">Bis zum nächsten Mal.</span></div>';
			$("#actions").replaceChildren();
			$("#key-hint").hidden = true;
		};
		$("#actions").append(end);
	}
	$("#key-hint").hidden = state.phase === "end" || state.phase === "finished";
	$("#key-label").textContent =
		state.phase === "ready"
			? "start"
			: state.phase === "review"
				? "weiter"
				: chain
					? "weiter"
					: "weiter / stopp";
}
function inputError(input) {
	const text = input.value.trim(),
		row = input.closest(".field"),
		el = row.querySelector(".field-error");
	const invalid = Boolean(text) && !ruleValid(text);
	row.classList.toggle("wrong", invalid);
	input.setAttribute("aria-invalid", String(invalid));
	el.textContent = invalid
		? [...text].length < 2
			? "2–30 Zeichen"
			: `Beginnt mit ${currentLetter()}`
		: "";
}
function bindInput(input) {
	glyphText(input);
	input.addEventListener("compositionstart", () => {
		input.__composing = true;
	});
	input.addEventListener("compositionend", () => {
		input.__composing = false;
		onInput(input, true);
	});
	input.addEventListener("input", (event) =>
		onInput(input, !event.isComposing && !input.__composing),
	);
	input.addEventListener("scroll", () => {
		input.parentElement.querySelector(".word-display").style.transform =
			`translateX(${-input.scrollLeft}px)`;
	});
	input.addEventListener("blur", () => {
		if (state.phase !== "playing") return;
		inputError(input);
		if (state.mode !== "chain") commitField(Number(input.dataset.index));
	});
	input.addEventListener("keydown", (event) => {
		if (
			event.key !== "Enter" ||
			event.isComposing ||
			input.__composing ||
			event.repeat
		)
			return;
		event.preventDefault();
		if (state.phase !== "playing") return;
		if (state.mode === "chain") {
			commitChain();
			return;
		}
		const index = Number(input.dataset.index);
		inputError(input);
		commitField(index);
		if (state.answers.every((a) => ruleValid(a))) finishRound();
		else {
			const candidates = [1, 2, 3, 4].map((n) => (index + n) % 4);
			const next = candidates.find((n) => !ruleValid(state.answers[n]));
			$(`#word-${next ?? (index + 1) % 4}`)?.focus();
		}
	});
}
function onInput(input, feedback) {
	if (state.phase !== "playing") return;
	const index = Number(input.dataset.index);
	if (state.mode !== "chain") state.answers[index] = input.value;
	glyphText(input);
	input.closest(".field").classList.toggle("completed", ruleValid(input.value));
	input.closest(".field").classList.remove("wrong");
	input.setAttribute("aria-invalid", "false");
	input.closest(".field").querySelector(".field-error").textContent = "";
	if (feedback) {
		state.typingCount++;
		sound.key(index, [...input.value].length);
		const rect = input.getBoundingClientRect();
		world.hit(0.09, rect.x / innerWidth, (rect.y + 20) / innerHeight);
		const force =
			state.material === "solid" ? 1.3 : state.material === "pulse" ? 2.1 : 0.7;
		animate(
			$("#main-letter"),
			[
				{ transform: `translateY(${force}px) scale(.996)` },
				{ transform: "translateY(0) scale(1)" },
			],
			{ duration: 180 },
		);
	}
	sound.layer =
		state.mode === "chain"
			? state.chainBatch
			: state.answers.filter((x) => ruleValid(x)).length;
	updateHeader();
	const btn = $("#primary");
	if (btn)
		btn.disabled =
			state.mode === "chain"
				? !ruleValid(input.value)
				: state.mode === "duel" && state.answers.some((x) => !ruleValid(x));
}
function strikeField(row, value) {
	if (!row) return;
	row.classList.remove("strike");
	void row.offsetWidth;
	row.classList.add("strike");
	later(() => row.classList.remove("strike"), 800);
	const rect =
		row.querySelector(".input-line")?.getBoundingClientRect() ||
		row.getBoundingClientRect();
	const target = $("#main-letter").getBoundingClientRect();
	world.hit(
		0.45,
		(target.x + target.width / 2) / innerWidth,
		(target.y + target.height / 2) / innerHeight,
	);
	if (!reduced()) {
		const word = document.createElement("span");
		word.className = "word-flight";
		word.textContent = value;
		word.style.left = rect.x + "px";
		word.style.top = rect.y + "px";
		$("#effects").append(word);
		const tx = target.x + target.width / 2 - rect.x - rect.width / 4,
			ty = target.y + target.height / 2 - rect.y;
		const motion = word.animate(
			[
				{ transform: "translate(0,0) scale(1)", opacity: 0.8 },
				{
					transform: `translate(${tx * 0.3}px,${ty * 0.35 - 20}px) scale(.9)`,
					opacity: 0.6,
					offset: 0.45,
				},
				{ transform: `translate(${tx}px,${ty}px) scale(.15)`, opacity: 0 },
			],
			{ duration: 540, easing: "cubic-bezier(.35,0,.25,1)" },
		);
		motion.onfinish = () => word.remove();
		later(() => word.remove(), 700);
		const ring = document.createElement("span");
		ring.className = "letter-ring";
		ring.style.left = target.x + target.width / 2 + "px";
		ring.style.top = target.y + target.height / 2 + "px";
		$("#effects").append(ring);
		later(() => ring.remove(), 750);
	}
}
function commitField(index) {
	if (
		state.phase !== "playing" ||
		!ruleValid(state.answers[index]) ||
		state.committed.has(index)
	)
		return;
	state.committed.add(index);
	strikeField($(`[data-field="${index}"]`), state.answers[index]);
	sound.word(index);
	log("field_completed", { categoryIndex: index });
	if (
		state.committed.size === 4 &&
		!state.allClear &&
		state.answers.every((x) => ruleValid(x))
	)
		allClear();
}
function allClear() {
	state.allClear = true;
	$("#letter-object").classList.add("all-clear");
	sound.clear();
	world.hit(1);
	setPalette(state.palette + 1);
	later(() => $("#letter-object").classList.remove("all-clear"), 1000);
	log(state.mode === "chain" ? "chain_batch" : "all_filled");
	announce(
		state.mode === "chain"
			? "Vier Wörter gespielt."
			: "Alle vier Kategorien ausgefüllt.",
	);
}
function startGame() {
	if (state.phase !== "ready") return;
	sound.start();
	sound.nextNote = sound.ctx?.currentTime || 0;
	sound.step = 0;
	setPhase("playing");
	state.elapsed = 0;
	state.endingReason = null;
	log("play_started", {
		sound: sound.enabled,
		volume: sound.volume,
		reducedMotion: reduced(),
		sprintSeconds: Number($("#duration").value),
		viewport: { width: innerWidth, height: innerHeight },
	});
	renderInputs();
	$(".answer")?.focus();
	animate($("#letter-object"), [
		{ transform: "scale(.95)", opacity: 0.7 },
		{ transform: "scale(1)", opacity: 1 },
	]);
}
function finishRound(reason = "stop") {
	if (state.phase !== "playing" || state.mode === "chain") return;
	const actualReason = typeof reason === "string" ? reason : "stop";
	if (
		actualReason === "stop" &&
		state.mode === "duel" &&
		state.answers.some((x) => !ruleValid(x))
	)
		return;
	state.answers.forEach((_, i) => commitField(i));
	state.valid = state.answers.map((x) => ruleValid(x));
	state.endingReason = actualReason;
	log("round_ended", {
		reason: actualReason,
		filled: state.answers.filter((x) => ruleValid(x)).length,
		botCount: state.botCount,
	});
	setPhase("review");
	sound.stop();
	renderReview();
	announce("Auswertung. Antworten antippen, um die Bewertung zu ändern.");
}
function categoryPoints(index) {
	if (!state.valid[index] || !state.answers[index]?.trim()) return 0;
	if (state.mode !== "duel") return 20;
	if (index >= state.botCount) return 20;
	return normalize(state.answers[index]) === normalize(currentSet().bot[index])
		? 5
		: 10;
}
function botCategoryPoints(index) {
	if (index >= state.botCount) return 0;
	if (!state.valid[index] || !state.answers[index]?.trim()) return 20;
	return normalize(state.answers[index]) === normalize(currentSet().bot[index])
		? 5
		: 10;
}
function provisionalPoints() {
	return state.mode === "chain"
		? state.chain.reduce((n, x) => n + (x.valid ? 20 : 0), 0)
		: state.answers.reduce((n, _, i) => n + categoryPoints(i), 0);
}
function renderReview() {
	const duel = state.mode === "duel",
		chain = state.mode === "chain";
	const entries = chain
		? state.chain
		: state.answers.map((value, index) => ({
				value,
				category: index,
				letter: currentLetter(),
				valid: state.valid[index],
			}));
	const rows = entries
		.map((entry, index) => {
			const cat = entry.category,
				points = chain ? (entry.valid ? 20 : 0) : categoryPoints(index);
			const other =
				duel && index < state.botCount ? currentSet().bot[index] : "—";
			const shared =
				duel && normalize(entry.value) === normalize(other) && other !== "—";
			return `<div class="review-row ${duel ? "" : "solo"} ${entry.valid ? "" : "invalid"} ${shared ? "shared" : ""}" style="--delay:${Math.min(index * 70, 280)}ms"><button type="button" class="review-own" data-review="${index}" aria-pressed="${entry.valid}" aria-label="${escapeHTML(entry.value || "Leere Antwort")}, ${entry.valid ? "gültig" : "ungültig"}. Bewertung ändern" ${!entry.value?.trim() ? "disabled" : ""}><small>${chain ? entry.letter + " · " : ""}${CATEGORIES[cat]}</small><strong>${escapeHTML(entry.value || "—")}</strong></button>${duel ? `<div><small>BOT</small><strong class="other">${escapeHTML(other)}</strong></div>` : ""}<span class="points">${points}</span>${shared ? '<span class="connection" aria-label="gleiche Antwort">↔</span>' : ""}</div>`;
		})
		.join("");
	$("#board").innerHTML =
		`<div class="review-heading ${duel ? "" : "solo"}"><span>DU</span>${duel ? "<span>BOT</span>" : ""}<span>PTS</span></div><div class="review-board ${chain ? "chain-review" : ""}">${rows || '<div class="end-board">0</div>'}</div><div class="review-total"><span id="round-points">+${provisionalPoints()}</span><small>PTS</small></div><p class="review-toggle-hint">${chain ? "Wörter" : "Antworten"} antippen · ✓ / ×</p>`;
	$$("[data-review]").forEach(
		(button) =>
			(button.onclick = () => {
				const index = Number(button.dataset.review),
					row = button.closest(".review-row");
				if (chain) state.chain[index].valid = !state.chain[index].valid;
				else state.valid[index] = !state.valid[index];
				const valid = chain ? state.chain[index].valid : state.valid[index];
				row.classList.toggle("invalid", !valid);
				row.querySelector(".points").textContent = chain
					? valid
						? 20
						: 0
					: categoryPoints(index);
				button.setAttribute("aria-pressed", String(valid));
				button.setAttribute(
					"aria-label",
					`${entries[index].value}, ${valid ? "gültig" : "ungültig"}. Bewertung ändern`,
				);
				$("#round-points").textContent = "+" + provisionalPoints();
				sound.key(index % 4, valid ? 5 : 2);
				animate(row.querySelector(".points"), [
					{ transform: "scale(.85)" },
					{ transform: "scale(1)" },
				]);
				log("review_correction", {
					categoryIndex: chain ? state.chain[index].category : index,
					entryIndex: index,
					valid,
				});
			}),
	);
	updateHeader();
	updateActions();
}
function confirmReview() {
	if (state.phase !== "review") return;
	setPhase("transition");
	const gain = provisionalPoints();
	state.total += gain;
	if (state.mode === "duel")
		state.botTotal += state.answers.reduce(
			(n, _, i) => n + botCategoryPoints(i),
			0,
		);
	const candidates =
		state.mode === "chain"
			? state.chain
					.filter((x) => x.valid)
					.map((x) => ({ value: x.value, points: 20 }))
			: state.answers.map((value, i) => ({ value, points: categoryPoints(i) }));
	candidates.forEach((x) => {
		if (x.points > state.bestWordPoints) {
			state.bestWord = x.value;
			state.bestWordPoints = x.points;
		}
	});
	state.completedRounds++;
	log("review_confirmed", {
		gain,
		total: state.total,
		botTotal: state.botTotal,
	});
	updateHeader();
	sound.clear();
	animate($("#total-score"), [
		{ transform: "scale(1.15)" },
		{ transform: "scale(1)" },
	]);
	$("#primary").disabled = true;
	if (state.mode === "chain" || state.round === 2) {
		later(showEnd, reduced() ? 0 : 360);
		return;
	}
	later(
		() => {
			state.round++;
			state.answers = ["", "", "", ""];
			state.valid = [true, true, true, true];
			state.committed.clear();
			state.allClear = false;
			state.botCount = 0;
			state.duelDeadline = null;
			state.elapsed = 0;
			sound.layer = 0;
			setPhase("playing");
			renderInputs();
			$("#word-0")?.focus();
			announce("Runde " + (state.round + 1) + ", Buchstabe " + currentLetter());
			animate(
				$("#letter-object"),
				[
					{ transform: "translateY(10px) scale(.9)", opacity: 0.2 },
					{ transform: "translateY(0) scale(1)", opacity: 1 },
				],
				{ duration: 450 },
			);
			log("next_round");
		},
		reduced() ? 0 : 330,
	);
}
function showEnd() {
	setPhase("end");
	updateHeader();
	const key =
		state.mode + (state.mode === "chain" ? ":" + $("#duration").value : "");
	const previous = db.best[key] || 0;
	if (state.total > previous) {
		db.best[key] = state.total;
		persist();
	}
	const words =
		state.mode === "chain" ? state.chain.filter((x) => x.valid).length : null;
	$("#board").innerHTML =
		`<div class="end-board"><div class="end-score">${state.total}<small>PTS</small></div><div class="end-summary">${state.mode === "duel" ? `<span><b>${state.botTotal}</b>BOT</span><span><b>${state.total > state.botTotal ? "↑" : state.total === state.botTotal ? "=" : "↓"}</b>DU</span>` : `<span><b>${state.mode === "chain" ? words : "3"}</b>${state.mode === "chain" ? "WÖRTER" : "RUNDEN"}</span>`}<span><b>${Math.max(previous, state.total)}</b>BESTE</span></div>${state.bestWord ? `<div class="end-word"><small>DEIN WORT</small>${escapeHTML(state.bestWord)}</div>` : ""}</div>`;
	updateActions();
	world.hit(0.9);
	log("session_completed", {
		score: state.total,
		botScore: state.mode === "duel" ? state.botTotal : null,
		words,
		sound: sound.enabled,
	});
	announce(`${state.total} Punkte. Nochmal oder für heute fertig.`);
}
function commitChain() {
	if (state.phase !== "playing" || state.mode !== "chain") return;
	const input = $(".answer");
	if (!input) return;
	inputError(input);
	if (!ruleValid(input.value)) return;
	const value = input.value.trim(),
		category = state.chainCategory,
		letter = currentLetter();
	if (
		state.chain.some(
			(x) =>
				x.category === category &&
				x.letter === letter &&
				normalize(x.value) === normalize(value),
		)
	) {
		input.closest(".field").querySelector(".field-error").textContent =
			"Schon gespielt";
		return;
	}
	state.chain.push({ value, category, letter, valid: true });
	state.chainBatch++;
	strikeField(input.closest(".field"), value);
	sound.word(category);
	log("chain_word", { categoryIndex: category, wordCount: state.chain.length });
	if (state.chainBatch === 4) {
		allClear();
		state.chainBatch = 0;
		state.chainSet++;
	}
	state.chainCategory = (state.chainCategory + 1) % 4;
	sound.layer = Math.min(4, state.chainBatch + 1);
	renderInputs();
	$(".answer")?.focus();
}
function skipChain() {
	if (state.phase !== "playing" || state.mode !== "chain") return;
	log("category_skipped", { categoryIndex: state.chainCategory });
	state.chainCategory = (state.chainCategory + 1) % 4;
	if (state.chainCategory === 0) {
		state.chainSet++;
		state.chainBatch = 0;
		setPalette(state.palette + 1);
	}
	sound.key(0, 1);
	renderInputs();
	$(".answer")?.focus();
}
function finishChain(reason = "finish") {
	if (state.phase !== "playing" || state.mode !== "chain") return;
	state.endingReason = reason;
	log("sprint_ended", { reason, words: state.chain.length });
	setPhase("review");
	sound.stop();
	renderReview();
	announce("Sprint beendet. Wörter antippen, um die Bewertung zu ändern.");
}
function resetGame({ reason = "reset", preserveAttempt = false } = {}) {
	if (state.phase !== "ready") log("attempt_left", { reason });
	clearLater();
	sound.layer = 0;
	sound.step = 0;
	Object.assign(state, {
		phase: "ready",
		round: 0,
		answers: ["", "", "", ""],
		valid: [true, true, true, true],
		committed: new Set(),
		botCount: 0,
		total: 0,
		botTotal: 0,
		elapsed: 0,
		duelDeadline: null,
		allClear: false,
		chain: [],
		chainCategory: 0,
		chainSet: 0,
		chainBatch: 0,
		activeMs: 0,
		startedAt: performance.now(),
		attemptId: preserveAttempt ? state.attemptId : uuid(),
		saved: false,
		ratings: {},
		bestWord: "",
		bestWordPoints: 0,
		completedRounds: 0,
		endingReason: null,
		typingCount: 0,
	});
	document.body.dataset.mode = state.mode;
	document.body.dataset.phase = "ready";
	$("#letter-object").classList.remove("all-clear");
	setPalette(0);
	updateAudioButton();
	renderInputs();
	log("attempt_started", {
		sound: sound.enabled,
		reducedMotion: reduced(),
		duration: Number($("#duration").value),
		viewport: { width: innerWidth, height: innerHeight },
	});
}

let lastFrame = performance.now(),
	lastSecond = -1;
function frame(now) {
	const delta = Math.min(100, now - lastFrame);
	lastFrame = now;
	if (!state.pause.size) {
		if (state.phase === "playing") {
			state.elapsed += delta;
			state.activeMs += delta;
			if (state.mode === "duel") {
				const schedule = [4200, 8200, 12600, 18000].map(
					(n) => n - state.round * 900,
				);
				const count = schedule.filter((n) => state.elapsed >= n).length;
				if (count !== state.botCount) {
					state.botCount = count;
					updateHeader();
					world.hit(0.12);
					log("bot_progress", { count });
					if (count === 4) {
						state.duelDeadline = state.elapsed + 5000;
						updateHeader();
					}
				}
				if (state.duelDeadline) {
					const left = Math.max(
						0,
						Math.ceil((state.duelDeadline - state.elapsed) / 1000),
					);
					$("#clock").textContent = left;
					$("#clock-wrap").classList.add("urgent");
					if (left !== lastSecond) {
						lastSecond = left;
						sound.tick();
					}
					if (left === 0) finishRound("bot_timeout");
				}
			} else if (state.mode === "chain") {
				const duration = Number($("#duration").value);
				const left = duration
					? Math.max(0, Math.ceil(duration - state.elapsed / 1000))
					: null;
				$("#clock").textContent = left ?? "∞";
				$("#clock-wrap").classList.toggle("urgent", left !== null && left <= 8);
				if (left !== null && left <= 5 && left !== lastSecond) sound.tick();
				lastSecond = left;
				if (duration && left === 0) finishChain("timeout");
			}
		}
		sound.tickMusic();
		world.draw(now);
	}
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function pause(key, value) {
	if (value) state.pause.add(key);
	else state.pause.delete(key);
	sound.pause(Boolean(state.pause.size));
	updateAudioButton();
	lastFrame = performance.now();
	log(value ? "paused" : "resumed", { reason: key });
}
function openDialog(dialog) {
	if (dialog.open) return;
	pause("dialog", true);
	dialog.showModal();
}
$$("dialog").forEach((dialog) => {
	dialog.addEventListener("close", () => pause("dialog", false));
	dialog.querySelector("[data-close]").onclick = () => dialog.close();
	dialog.addEventListener("click", (e) => {
		if (e.target === dialog) {
			const r = dialog.getBoundingClientRect();
			if (
				e.clientX < r.left ||
				e.clientX > r.right ||
				e.clientY < r.top ||
				e.clientY > r.bottom
			)
				dialog.close();
		}
	});
});
$("#open-settings").onclick = () => openDialog($("#settings-dialog"));
$("#reset-game").onclick = () => {
	resetGame();
	$("#settings-dialog").close();
};
$("#audio-toggle").onclick = () => {
	if (state.blind) return;
	sound.mute(sound.enabled);
	log("audio_changed", { enabled: sound.enabled });
};
$("#volume").oninput = () => {
	sound.setVolume(Number($("#volume").value) / 100);
};
$("#reduce-motion").checked = matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;
$("#reduce-motion").onchange = () => {
	document.body.classList.toggle("reduced", reduced());
	world.ripples = [];
	$("#effects").replaceChildren();
	log("motion_changed", { reduced: reduced() });
};
document.body.classList.toggle("reduced", reduced());
$("#contrast").onchange = () => {
	document.body.classList.toggle("high-contrast", $("#contrast").checked);
};
$("#duration").onchange = () => {
	if (state.blind) return;
	if (state.mode === "chain") resetGame({ reason: "duration_changed" });
};
$("#finish-early").onclick = () =>
	state.mode === "chain" ? finishChain() : finishRound("manual_end");
$$(".modes [data-mode]").forEach(
	(button) =>
		(button.onclick = () => {
			if (state.blind || button.dataset.mode === state.mode) return;
			state.mode = button.dataset.mode;
			$$(".modes button").forEach((b) =>
				b.setAttribute("aria-pressed", String(b === button)),
			);
			resetGame({ reason: "mode_changed" });
		}),
);
$$("[data-material]")
	.filter((el) => el.tagName === "BUTTON")
	.forEach(
		(button) =>
			(button.onclick = () => {
				if (state.blind) return;
				setMaterial(button.dataset.material);
				log("material_changed");
			}),
	);
function setMaterial(value) {
	state.material = value;
	sound.style = value;
	document.body.dataset.material = value;
	$$(".material-picker button").forEach((button) =>
		button.setAttribute(
			"aria-pressed",
			String(button.dataset.material === value),
		),
	);
}
document.addEventListener("keydown", (event) => {
	if (
		event.key !== "Enter" ||
		event.repeat ||
		event.defaultPrevented ||
		event.isComposing ||
		$$("dialog[open]").length ||
		/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement?.tagName)
	)
		return;
	if (state.phase === "ready") {
		event.preventDefault();
		startGame();
	} else if (state.phase === "review") {
		event.preventDefault();
		confirmReview();
	}
});
document.addEventListener("visibilitychange", () =>
	pause("hidden", document.hidden),
);
window.addEventListener("resize", () => world.resize());
window.addEventListener("pagehide", () => {
	sound.pause(true);
	clearLater();
});

function ratingControls() {
	$("#rating-controls").innerHTML = Object.entries({
		fun: "Spielspaß",
		typing: "Schreibgefühl",
		again: "Nochmal spielen",
		overload: "Zu viel",
	})
		.map(
			([key, label]) =>
				`<div class="rating"><span>${label}</span><div class="scale" role="group" aria-label="${label}">${Array.from({ length: 7 }, (_, i) => `<button type="button" data-rating="${key}" data-value="${i + 1}" aria-pressed="${state.ratings[key] === i + 1}" aria-label="${i + 1} von 7">${i + 1}</button>`).join("")}</div></div>`,
		)
		.join("");
}
$("#rating-controls").onclick = (event) => {
	const b = event.target.closest("[data-rating]");
	if (!b) return;
	state.ratings[b.dataset.rating] = Number(b.dataset.value);
	ratingControls();
};
function openFeedback() {
	$("#test-context").textContent = state.blind
		? `${MODE_NAMES[state.mode]} · Versuch ${state.blind.index + 1} / 3`
		: `${MODE_NAMES[state.mode]} · ${MATERIAL_NAMES[state.material]}`;
	ratingControls();
	$("#cancel-blind").hidden = !state.blind;
	$("#feedback-status").textContent = "";
	$("#notes").value = "";
	$("#start-blind").hidden = Boolean(state.blind);
	openDialog($("#feedback-dialog"));
}
$("#open-feedback").onclick = openFeedback;
$("#save-feedback").onclick = () => {
	if (!state.typingCount) {
		$("#feedback-status").textContent =
			"Bitte erst spielen und ein paar Zeichen eingeben.";
		return;
	}
	if (Object.keys(state.ratings).length < 4) {
		$("#feedback-status").textContent = "Bitte alle vier Skalen bewerten.";
		return;
	}
	if (state.saved) {
		$("#feedback-status").textContent =
			"Dieser Versuch ist bereits gespeichert.";
		return;
	}
	db.records.push({
		schema: 2,
		at: new Date().toISOString(),
		participant: db.participant,
		sessionId: state.sessionId,
		attemptId: state.attemptId,
		comparisonId: state.blind?.id || null,
		trial: state.blind ? state.blind.index + 1 : null,
		mode: state.mode,
		material: state.material,
		phaseAtRating: state.phase,
		completedRounds: state.completedRounds,
		sound: sound.enabled,
		volume: sound.volume,
		reducedMotion: reduced(),
		sprintSeconds: Number($("#duration").value),
		activeMs: Math.round(state.activeMs),
		ratings: { ...state.ratings },
		notes: $("#notes").value.trim(),
	});
	state.saved = true;
	persist();
	log("rating_saved");
	if (state.blind) {
		const comparison = state.blind;
		if (comparison.index < 2) {
			comparison.index++;
			setMaterial(comparison.order[comparison.index]);
			resetGame({ reason: "next_blind_trial" });
			$(".material-picker").dataset.trial =
				`VERSUCH ${comparison.index + 1} / 3`;
			$("#feedback-dialog").close();
			announce("Nächster Vergleich. Spielen drücken.");
		} else {
			log("comparison_completed");
			state.blind = null;
			document.body.classList.remove("blind");
			lockBlindControls(false);
			$("#feedback-status").textContent =
				"Drei Versuche gespeichert. Reihenfolge: " +
				comparison.order.map((x) => MATERIAL_NAMES[x]).join(" → ");
			$("#start-blind").hidden = false;
		}
	} else
		$("#feedback-status").textContent = persistenceAvailable
			? "Gespeichert."
			: "Nur im Arbeitsspeicher. Bitte jetzt exportieren.";
};
function lockBlindControls(value) {
	$$("#settings-dialog input,#settings-dialog select,#new-person").forEach(
		(input) => {
			input.disabled = value;
		},
	);
}
$("#start-blind").onclick = () => {
	const order = ["light", "solid", "pulse"];
	for (let i = 2; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	state.blind = { id: uuid(), order, index: 0 };
	setMaterial(order[0]);
	document.body.classList.add("blind");
	$(".material-picker").dataset.trial = "VERSUCH 1 / 3";
	lockBlindControls(true);
	resetGame({ reason: "blind_started" });
	$("#feedback-dialog").close();
	log("comparison_started");
};
$("#new-person").onclick = () => {
	if (state.blind) return;
	db.participant = uuid();
	persist();
	resetGame({ reason: "new_participant" });
	$("#feedback-status").textContent =
		"Neue Testperson. Vorherige Ergebnisse bleiben im Export.";
};
$("#export").onclick = () => {
	const data = {
		...db,
		exportedAt: new Date().toISOString(),
		labVersion: "2026-10-23.2",
		opponent: "scripted_bot_in_duel",
		answerTextsStored: false,
	};
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
	);
	const a = document.createElement("a");
	a.href = url;
	a.download = `slf-spieltest-v2-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};
paintIcons();
updateAudioButton();
const params = new URLSearchParams(location.search);
if (["classic", "duel", "chain"].includes(params.get("mode"))) {
	state.mode = params.get("mode");
	$$(".modes button").forEach((button) =>
		button.setAttribute(
			"aria-pressed",
			String(button.dataset.mode === state.mode),
		),
	);
}
if (["light", "solid", "pulse"].includes(params.get("material")))
	setMaterial(params.get("material"));
resetGame({ reason: "initial" });

$("#cancel-blind").onclick = () => {
	if (!state.blind) return;
	log("comparison_abandoned");
	state.blind = null;
	document.body.classList.remove("blind");
	lockBlindControls(false);
	$("#cancel-blind").hidden = true;
	$("#start-blind").hidden = false;
	$("#test-context").textContent =
		MODE_NAMES[state.mode] + " · " + MATERIAL_NAMES[state.material];
};
