import {
	ALL_WORDS,
	BANK,
	BOT_POOL,
	DUBIOUS,
	icon,
	LETTERS,
	PALETTES,
	PRESET_CATS,
} from "./data.js";
import { fx } from "./fx.js";
import { Sound } from "./sound.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
const fold = (w) =>
	norm(w)
		.replace(/ä/g, "a")
		.replace(/ö/g, "o")
		.replace(/ü/g, "u")
		.replace(/ß/g, "ss");
const stripUmlauts = (w) =>
	w.replace(
		/[äöüÄÖÜ]/g,
		(c) => ({ ä: "a", ö: "o", ü: "u", Ä: "A", Ö: "O", Ü: "U" })[c],
	);
const reduced = () => document.body.classList.contains("reduced");

// ---------- state ----------
const STORE = "slf-engagement-lab-v4";
const db = (() => {
	try {
		return JSON.parse(localStorage.getItem(STORE)) || {};
	} catch {
		return {};
	}
})();
db.best ??= 0;
db.prefs = { sound: true, music: 0.8, sfx: 0.9, haptics: true, ...db.prefs };
db.cfg = {
	cats: PRESET_CATS.slice(0, 4),
	time: 90,
	rounds: 3,
	letters: [...LETTERS],
	flames: true,
	last: false,
	commentator: false,
	...db.cfg,
};
const save = () => {
	try {
		localStorage.setItem(STORE, JSON.stringify(db));
	} catch {}
};
const prefs = db.prefs;
const YOU = { id: "you", name: "Du", color: "var(--you)", status: "in" };

const S = {
	cfg: db.cfg,
	mode: "classic",
	phase: "lobby",
	palette: 0,
	people: [YOU],
	host: "mia",
	code: Array.from({ length: 6 }, () =>
		pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789"),
	).join(""),
	joined: false,
	round: 0,
	letters: [],
	letter: "S",
	totals: {},
	answers: [],
	flame: -1,
	locked: new Set(),
	elapsed: 0,
	limit: 90000,
	stopper: null,
	stopAt: 0,
	plan: {},
	pips: {},
	streak: 0,
	words: [],
	skip: false,
	sprint: null,
	tilt: { x: 0, y: 0, tx: 0, ty: 0 },
	drift: { d: 0, v: 0 },
};
const cats = () => S.cfg.cats;
const bots = () => S.people.filter((p) => p.id !== "you");
const person = (id) => S.people.find((p) => p.id === id);
const hostPerson = () => person(S.host) || YOU;
const isHost = () => S.host === "you";
const commentating = () => S.cfg.commentator && isHost() && !solo();
const players = () =>
	S.people.filter(
		(p) => p.status === "in" && !(p.id === "you" && commentating()),
	);
const activeBots = () => players().filter((p) => p.id !== "you");
const solo = () => S.people.filter((p) => p.status === "in").length === 1;
const flamesOn = () => S.cfg.flames && !solo();
const lastMode = () => S.mode === "classic" && S.cfg.last;
const ruleValid = (w, letter) => {
	const chars = [...w.trim()];
	if (chars.length < 2) return false;
	return upper(lastMode() ? chars.at(-1) : chars[0]) === letter;
};

const sound = new Sound(prefs);

// ---------- haptics ----------
const hapticSwitch = $(".haptic");
const canVibrate = typeof navigator.vibrate === "function";
function haptic(pattern = 12) {
	if (!prefs.haptics) return;
	if (canVibrate) {
		navigator.vibrate(pattern);
		return;
	}
	const active = document.activeElement;
	hapticSwitch.click();
	if (active && document.activeElement !== active)
		active.focus({ preventScroll: true });
}

// ---------- timing ----------
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

// ---------- look ----------
function setPalette(i) {
	S.palette = i % PALETTES.length;
	const [tiles, bg1, bg2] = PALETTES[S.palette];
	const st = document.body.style;
	tiles.forEach((c, k) => st.setProperty(`--t${k + 1}`, c));
	st.setProperty("--bg1", bg1);
	st.setProperty("--bg2", bg2);
	$('meta[name="theme-color"]').content = bg2;
	fx.colors = [...tiles, "#ffffff"];
}
const nextPalette = () =>
	setPalette(S.palette + 1 + (Math.random() < 0.35 ? 1 : 0));

function screen(phase, html) {
	gen++;
	timers.forEach(clearTimeout);
	timers.clear();
	S.skip = false;
	S.nextNow = null;
	S.phase = phase;
	document.body.dataset.phase = phase;
	document.body.classList.remove("urgent");
	S.baseMood = "idle";
	nextPalette();
	const stage = $("#stage");
	stage.innerHTML = `<section class="screen ${phase}">${html}</section>`;
	paintRole();
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
const bounce = (el, s = 1.15, ms = 320) =>
	anim(
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
	clearTimeout(slam.t);
	slam.t = setTimeout(() => {
		el.className = "";
		el.innerHTML = "";
	}, 1150);
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
function toast(html, ms = 2200) {
	const el = document.createElement("div");
	el.className = "toast";
	el.innerHTML = html;
	$("#toasts").append(el);
	sound.pop();
	setTimeout(() => el.classList.add("out"), ms);
	setTimeout(() => el.remove(), ms + 400);
}
const announce = (t) => {
	$("#live").textContent = t;
};
const avatar = (p, cls = "") =>
	`<span class="av ${cls}" style="--pc:${p.color}" data-av="${p.id}">${p.id === "you" ? icon("star") : p.name[0]}</span>`;

// ---------- mascot ----------
const mascotHTML = (letter, cls = "") =>
	`<div class="mascot ${cls}" data-mood="idle"><div class="m-body"><span class="m-eyes"><i><b></b></i><i><b></b></i></span><span class="m-mouth"></span><span class="m-letter">${letter}</span><span class="m-drop"></span></div><span class="m-shadow"></span></div>`;
function mood(m, ms = 1100) {
	clearTimeout(mood.t);
	for (const el of $$(".mascot")) el.dataset.mood = m;
	if (ms)
		mood.t = setTimeout(() => {
			for (const el of $$(".mascot")) el.dataset.mood = S.baseMood;
		}, ms);
}
function setBaseMood(m) {
	S.baseMood = m;
	mood(m, 0);
}
function hop(el, h = 18) {
	anim(
		el,
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
function lookAt(x, y) {
	for (const m of $$(".mascot")) {
		const r = m.getBoundingClientRect();
		const dx = x - (r.left + r.width / 2);
		const dy = y - (r.top + r.height * 0.3);
		const d = Math.max(1, Math.hypot(dx, dy));
		const k = Math.min(1, d / 160);
		m.style.setProperty("--lx", ((dx / d) * k).toFixed(3));
		m.style.setProperty("--ly", ((dy / d) * k).toFixed(3));
	}
}
const lookAtEl = (el) => {
	if (!el) return;
	const r = el.getBoundingClientRect();
	lookAt(r.left + r.width / 2, r.top + r.height / 2);
};

// ---------- tiles ----------
function fitTiles(box) {
	const n = Math.max(1, box._chars?.length || 0);
	const max = Number(box.dataset.max || 36);
	const w = box.clientWidth || 260;
	const s = Math.max(13, Math.min(max, Math.floor((w - 4 * (n - 1)) / n)));
	box.style.setProperty("--s", `${s}px`);
}
function markLead(box, letter, last) {
	const tiles = $$(".tile:not(.ghost)", box);
	const li = last ? tiles.length - 1 : 0;
	tiles.forEach((t, i) => {
		const ch = box._chars[i];
		const lead = i === li;
		const hit = lead && upper(ch) === letter;
		t.classList.toggle("lead", hit);
		t.classList.toggle("bad", lead && !hit && !last);
		t.textContent = lead && !last ? upper(ch) : ch;
	});
}
function paintTiles(box, value, letter, live = true, last = lastMode()) {
	const chars = [...value];
	const prev = box._chars || [];
	let k = 0;
	while (k < prev.length && k < chars.length && prev[k] === chars[k]) k++;
	const tiles = $$(".tile:not(.ghost)", box);
	for (let i = tiles.length - 1; i >= k; i--) {
		if (live && i >= chars.length) {
			fx.at(tiles[i], { n: 5, speed: 3, size: 5 });
			sound.poof();
		}
		tiles[i].remove();
	}
	const caret = $(".caret", box);
	for (let i = k; i < chars.length; i++) {
		const t = document.createElement("span");
		t.className = `tile${chars[i] === " " ? " space" : ""}${live && i >= prev.length ? " in" : ""}`;
		t.style.setProperty("--c", `var(--t${(i % 5) + 1})`);
		t.style.setProperty("--rot", `${rand(-5, 5).toFixed(1)}deg`);
		box.insertBefore(t, caret);
	}
	box._chars = chars;
	box.classList.toggle("empty", !chars.length);
	markLead(box, letter, last);
	fitTiles(box);
}
const tilesHTML = (letter, max = 36, last = lastMode()) =>
	`<div class="tiles empty" data-max="${max}"><span class="tile ghost">${last ? `…${letter}` : letter}</span><span class="caret"></span></div>`;
function miniWord(word, letter, last) {
	const box = document.createElement("div");
	box.className = "tiles mini";
	box.dataset.max = 28;
	box.innerHTML = '<span class="caret"></span>';
	box._paint = () => paintTiles(box, word, letter, false, last);
	return box;
}

// ---------- lobby ----------
function lobby() {
	sound.scene = "lobby";
	sound.layer = 0;
	S.mode ??= "classic";
	const host = isHost();
	const el = screen(
		"lobby",
		`<div class="hero">${mascotHTML("S", "big")}<p class="wordmark">Stadt <i>·</i> Land <i>·</i> Fluss</p></div>
		<div class="room">
			<div class="code" aria-label="Code ${S.code}">${[...S.code].map((c, i) => `<span style="--c:var(--t${(i % 5) + 1})">${c}</span>`).join("")}</div>
			<button type="button" class="icon-btn" id="copy" aria-label="Link kopieren">${icon("link")}</button>
			<button type="button" class="icon-btn" id="qr" aria-label="QR-Code">${icon("qr")}</button>
		</div>
		<div class="seats" id="seats"></div>
		<div class="mode-pick" role="radiogroup" aria-label="Modus">
			<button type="button" role="radio" data-mode="classic" aria-checked="${S.mode === "classic"}">${icon("grid")}</button>
			<button type="button" role="radio" data-mode="sprint" aria-checked="${S.mode === "sprint"}">${icon("bolt")}${db.best ? `<small>${db.best}</small>` : ""}</button>
		</div>
		<div class="panel ${host ? "" : "locked"}" id="panel" ${host ? "" : "inert"}></div>
		<button type="button" class="btn primary go" id="go">${host ? icon("arrow") : icon("hand")}</button>`,
	);
	paintSeats();
	paintPanel();
	const m = $(".mascot", el);
	let li = 0;
	m.addEventListener("pointerdown", () => {
		sound.start();
		li = (li + 1) % 3;
		$(".m-letter", m).textContent = "SLF"[li];
		sound.key(li * 2 + 3);
		hop(m, 30);
		mood("happy", 900);
		haptic(10);
		fx.at(m, { n: 12, speed: 6 });
	});
	$$("[data-mode]", el).forEach((b) =>
		b.addEventListener("click", () => {
			S.mode = b.dataset.mode;
			$$("[data-mode]", el).forEach((x) =>
				x.setAttribute("aria-checked", String(x === b)),
			);
			$("#panel").hidden = S.mode === "sprint";
			sound.start();
			sound.tap();
			haptic(8);
		}),
	);
	$("#panel").hidden = S.mode === "sprint";
	$("#copy", el).addEventListener("click", (e) => {
		navigator.clipboard
			?.writeText(`${location.origin}${location.pathname}#${S.code}`)
			.catch(() => {});
		e.currentTarget.innerHTML = icon("check");
		e.currentTarget.classList.add("done");
		sound.word(1);
		haptic(12);
		fx.at(e.currentTarget, { n: 10, speed: 4 });
	});
	$("#qr", el).addEventListener("click", showQR);
	$("#go", el).addEventListener("click", (e) => {
		sound.start();
		haptic(15);
		if (S.mode === "sprint") return startSprint();
		if (isHost()) return startMatch();
		const btn = e.currentTarget;
		if (btn.disabled) return;
		btn.disabled = true;
		btn.innerHTML = icon("check");
		$('[data-seat="you"]')?.classList.add("ready");
		sound.word(2);
		run(async () => {
			await sleep(900);
			toast(`${avatar(hostPerson())}${icon("crown")}${icon("arrow")}`);
			await sleep(600);
			startMatch();
		});
	});
	mood("happy", 900);
	if (!S.joined)
		run(async () => {
			for (const b of BOT_POOL.slice(0, 3)) {
				await sleep(rand(450, 850));
				if (!person(b.id)) S.people.push({ ...b, status: "in" });
				paintSeats(b.id);
				sound.pop();
				hop($(".mascot"), 12);
			}
			S.joined = true;
			paintRole();
		});
}
function paintSeats(fresh) {
	const box = $("#seats");
	if (!box) return;
	const host = isHost();
	box.innerHTML =
		S.people
			.map(
				(p) =>
					`<div class="seat ${p.id === fresh ? "fresh" : ""}" data-seat="${p.id}">${avatar(p)}${p.id === S.host ? `<span class="seat-crown">${icon("crown")}</span>` : ""}<span>${p.name}</span>${host && p.id !== "you" ? `<button type="button" class="kick" data-kick="${p.id}" aria-label="${p.name} entfernen">${icon("x")}</button>` : ""}</div>`,
			)
			.join("") +
		(host && S.joined && S.people.length < 5
			? `<button type="button" class="seat add" id="add" aria-label="Bot einladen">${icon("plus")}</button>`
			: "");
	if (fresh)
		fx.at($(`[data-seat="${fresh}"]`), {
			n: 10,
			speed: 4,
			colors: [person(fresh).color],
		});
	$$("[data-kick]", box).forEach((b) =>
		b.addEventListener("click", () => kick(b.dataset.kick)),
	);
	$("#add", box)?.addEventListener("click", () => {
		const b = BOT_POOL.find((x) => !person(x.id));
		S.people.push({ ...b, status: "in" });
		sound.start();
		sound.pop();
		haptic(10);
		paintSeats(b.id);
		paintRole();
	});
}
function kick(id) {
	const seat = $(`[data-seat="${id}"]`);
	fx.at(seat, { n: 16, speed: 6, colors: [person(id).color, "#ffffff"] });
	sound.start();
	sound.poof();
	sound.crunch();
	haptic([10, 30, 10]);
	mood("wow", 700);
	S.people = S.people.filter((p) => p.id !== id);
	if (S.host === id) S.host = "you";
	const done = () => {
		paintSeats();
		paintRole();
		if (solo()) toast(`${avatar(YOU)}${icon("star")}`);
	};
	const a = anim(
		seat,
		[
			{ transform: "scale(1)" },
			{ transform: "scale(0) rotate(-20deg)", opacity: 0 },
		],
		{
			duration: 260,
			easing: "ease-in",
			fill: "forwards",
		},
	);
	a ? (a.onfinish = done) : done();
}
function paintPanel() {
	const box = $("#panel");
	if (!box) return;
	const c = S.cfg;
	const seg = (key, vals, show) =>
		`<div class="seg" data-seg="${key}">${vals.map((v) => `<button type="button" aria-pressed="${c[key] === v}" data-v="${v}">${show(v)}</button>`).join("")}</div>`;
	box.innerHTML = `
		<div class="cats-edit">${c.cats
			.map(
				(cat, i) =>
					`<span class="cat-chip" data-ci="${i}">${icon(cat.icon)}<input value="${esc(cat.name)}" maxlength="14" aria-label="Kategorie ${i + 1}" spellcheck="false">${c.cats.length > 1 ? `<button type="button" class="chip-x" data-del="${i}" aria-label="Löschen">${icon("x")}</button>` : ""}</span>`,
			)
			.join(
				"",
			)}${c.cats.length < 6 ? `<button type="button" class="cat-chip add" id="cat-add" aria-label="Kategorie hinzufügen">${icon("plus")}</button>` : ""}</div>
		<div class="row">${icon("clock")}${seg("time", [60, 90, 120, 0], (v) => (v ? v : icon("infinity")))}${seg("rounds", [3, 5], (v) => `${v}×`)}</div>
		<div class="letters">${LETTERS.map((L) => `<button type="button" class="lt" aria-pressed="${c.letters.includes(L)}" data-l="${L}">${L}</button>`).join("")}</div>
		<div class="row modes">
			<button type="button" class="toggle" data-flag="flames" aria-pressed="${c.flames}" aria-label="Flammen">${icon("flame")}</button>
			<button type="button" class="toggle last" data-flag="last" aria-pressed="${c.last}" aria-label="Letzter Buchstabe"><b>…A</b></button>
			<button type="button" class="toggle" data-flag="commentator" aria-pressed="${c.commentator}" aria-label="Kommentator">${icon("mic")}</button>
		</div>`;
	const changed = () => {
		save();
		sound.start();
		sound.tap();
		haptic(8);
	};
	$$(".cat-chip input", box).forEach((inp) => {
		inp.addEventListener("input", () => {
			const i = Number(inp.closest("[data-ci]").dataset.ci);
			c.cats[i] = { ...c.cats[i], name: inp.value.trim() || c.cats[i].name };
			save();
		});
		inp.addEventListener("keydown", (e) => e.key === "Enter" && inp.blur());
	});
	$$("[data-del]", box).forEach((b) =>
		b.addEventListener("click", () => {
			fx.at(b.closest(".cat-chip"), { n: 8, speed: 4 });
			c.cats.splice(Number(b.dataset.del), 1);
			sound.poof();
			changed();
			paintPanel();
		}),
	);
	$("#cat-add", box)?.addEventListener("click", () => {
		const preset = PRESET_CATS.find((p) => !c.cats.some((x) => x.id === p.id));
		c.cats.push(preset || { id: `c${Date.now()}`, name: "Neu", icon: "tag" });
		changed();
		paintPanel();
		const chips = $$(".cat-chip[data-ci]", box);
		const chip = chips.at(-1);
		bounce(chip, 1.2);
		fx.at(chip, { n: 10, speed: 4 });
		if (!preset) $("input", chip).select();
	});
	$$("[data-seg]", box).forEach((g) =>
		g.addEventListener("click", (e) => {
			const b = e.target.closest("[data-v]");
			if (!b) return;
			c[g.dataset.seg] = Number(b.dataset.v);
			$$("button", g).forEach((x) =>
				x.setAttribute("aria-pressed", String(x === b)),
			);
			changed();
		}),
	);
	$$(".lt", box).forEach((b) =>
		b.addEventListener("click", () => {
			const L = b.dataset.l;
			const on = c.letters.includes(L);
			if (on && c.letters.length === 1) return shake(0.4);
			c.letters = on ? c.letters.filter((x) => x !== L) : [...c.letters, L];
			b.setAttribute("aria-pressed", String(!on));
			changed();
		}),
	);
	$$("[data-flag]", box).forEach((b) =>
		b.addEventListener("click", () => {
			const k = b.dataset.flag;
			c[k] = !c[k];
			b.setAttribute("aria-pressed", String(c[k]));
			if (c[k]) {
				fx.at(b, { n: 10, speed: 4 });
				if (k === "flames") sound.ignite();
			}
			changed();
		}),
	);
}
function showQR() {
	sound.start();
	sound.pop();
	haptic(10);
	let seed = [...S.code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	const N = 25;
	const finder = (x, y) =>
		[0, 1, 2].some((k) =>
			[
				[0, 0],
				[N - 7, 0],
				[0, N - 7],
			][k].every((o, j) => (j ? y : x) - o >= 0 && (j ? y : x) - o < 7),
		);
	let cells = "";
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			if (finder(x, y)) continue;
			if (rnd() < 0.48)
				cells += `<rect x="${x}" y="${y}" width="1.02" height="1.02" rx=".3"/>`;
		}
	const eye = (x, y) =>
		`<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="currentColor"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".9"/>`;
	const el = document.createElement("div");
	el.className = "qr-pop";
	el.innerHTML = `<div class="qr-card"><svg viewBox="-1 -1 ${N + 2} ${N + 2}">${cells}${eye(0, 0)}${eye(N - 7, 0)}${eye(0, N - 7)}</svg><div class="code small">${[...S.code].map((c, i) => `<span style="--c:var(--t${(i % 5) + 1})">${c}</span>`).join("")}</div></div>`;
	el.addEventListener("click", () => {
		el.classList.add("out");
		setTimeout(() => el.remove(), 250);
	});
	document.body.append(el);
}

// ---------- slot ----------
async function slotReveal(letter, { quick = false } = {}) {
	const target = $("#letter");
	const box = document.createElement("div");
	box.className = "slot";
	box.innerHTML = mascotHTML("?", "huge");
	document.body.append(box);
	const m = $(".mascot", box);
	const span = $(".m-letter", box);
	m.dataset.mood = "wow";
	const steps = quick ? 7 : 14;
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
		await sleep(quick ? 30 + i * 12 : 35 + i * i * 1.3);
	}
	m.dataset.mood = "happy";
	hop(m, 40);
	sound.land();
	haptic([20, 40, 30]);
	shake(1.2);
	fx.at(m, { n: 34, speed: 11, size: 12 });
	announce(`Buchstabe ${letter}`);
	await sleep(quick ? 380 : 620);
	if (target && !reduced()) {
		const a = m.getBoundingClientRect();
		const b = target.getBoundingClientRect();
		const s = b.width / a.width;
		const fly = m.animate(
			[
				{ transform: "none" },
				{
					transform: `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px,${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${s})`,
				},
			],
			{ duration: 320, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" },
		);
		box.classList.add("leave");
		await fly.finished.catch(() => {});
	}
	box.remove();
	if (target) {
		$(".m-letter", target).textContent = letter;
		target.classList.add("on");
		hop(target, 10);
		sound.thud();
	}
}

// ---------- classic ----------
function startMatch() {
	S.mode = "classic";
	S.round = 0;
	S.letters = [];
	const pool = shuffle(S.cfg.letters);
	for (let i = 0; i < S.cfg.rounds; i++) S.letters.push(pool[i % pool.length]);
	S.totals = Object.fromEntries(S.people.map((p) => [p.id, 0]));
	S.streak = 0;
	S.words = [];
	S.lateDone = S.people.length >= 5 || solo();
	startRound();
}
function botWord(cat, letter) {
	if (lastMode()) {
		const list = (ALL_WORDS[cat.id] || []).filter(
			(w) => upper([...w].at(-1)) === letter,
		);
		return list.length && Math.random() < 0.8 ? pick(list) : "";
	}
	if (Math.random() < 0.1) return "";
	const list = BANK[letter][cat.id];
	if (list) return pick(list);
	return Math.random() < 0.5 ? pick(Object.values(BANK[letter]).flat()) : "";
}
function planBots() {
	const cs = cats();
	const n = cs.length;
	const speed = 1 - S.round * 0.08;
	const plan = {};
	const list = activeBots();
	for (const b of list) {
		const words = cs.map((c) => botWord(c, S.letter));
		const times = words.map((w, i) =>
			w
				? ((6 + i * (26 / Math.max(1, n - 1 || 1))) * b.skill * speed +
						rand(-1.5, 2.5)) *
					1000
				: Infinity,
		);
		plan[b.id] = { words, times, dubious: -1, flame: -1 };
	}
	const [dcat, dword] = DUBIOUS[S.letter];
	const di = cs.findIndex((c) => c.id === dcat);
	if (list.length && di >= 0 && !lastMode()) {
		const b = pick(list);
		plan[b.id].words[di] = dword;
		plan[b.id].times[di] = Math.min(plan[b.id].times[di], 20000 * b.skill);
		plan[b.id].dubious = di;
	}
	if (list.length >= 2 && Math.random() < 0.75) {
		const [a, b] = shuffle(list);
		for (const ci of shuffle(cs.map((_, i) => i))) {
			if (ci === plan[a.id].dubious || ci === plan[b.id].dubious) continue;
			const pool = (BANK[S.letter][cs[ci].id] || []).filter((w) =>
				/[äöüÄÖÜ]/.test(w),
			);
			const w = /[äöüÄÖÜ]/.test(plan[a.id].words[ci])
				? plan[a.id].words[ci]
				: pool.length && !lastMode()
					? pick(pool)
					: "";
			if (!w) continue;
			plan[a.id].words[ci] = w;
			plan[b.id].words[ci] = stripUmlauts(w);
			for (const id of [a.id, b.id])
				if (plan[id].times[ci] === Infinity)
					plan[id].times[ci] = rand(9, 22) * 1000;
			break;
		}
	}
	if (flamesOn())
		for (const b of list)
			if (Math.random() < 0.35) {
				const filled = plan[b.id].words
					.map((w, i) => (w ? i : -1))
					.filter((i) => i >= 0);
				if (filled.length) plan[b.id].flame = pick(filled);
			}
	const done = list
		.filter((b) => plan[b.id].words.every(Boolean))
		.map((b) => Math.max(...plan[b.id].times) + 1500);
	S.buzzAt = done.length ? Math.min(...done) : Infinity;
	S.plan = plan;
}
function startRound() {
	const activated = S.people.filter((p) => p.status === "pending");
	for (const p of activated) {
		p.status = "in";
		S.totals[p.id] ??= 0;
	}
	S.letter = S.letters[S.round];
	S.answers = cats().map(() => "");
	S.flame = -1;
	S.locked = new Set();
	S.elapsed = 0;
	S.stopper = null;
	S.stopAt = 0;
	S.lastSec = null;
	S.limit = S.cfg.time ? S.cfg.time * 1000 : Infinity;
	S.pips = {};
	S.ending = false;
	S.playing = false;
	planBots();
	const n = cats().length;
	const comm = commentating();
	const el = screen(
		"play",
		`<div class="hud">
			${mascotHTML("", "letter")}
			<div class="hud-mid">
				<div class="rounds">${Array.from({ length: S.cfg.rounds }, (_, i) => `<i class="${i < S.round ? "done" : i === S.round ? "now" : ""}"></i>`).join("")}</div>
				<div class="fuse ${S.limit === Infinity ? "endless" : ""}" id="fuse"><i></i><b></b></div>
			</div>
			<div class="friends" id="friends"></div>
		</div>
		${
			comm
				? `<div class="board" id="board">${activeBots()
						.map(
							(b) =>
								`<div class="board-row" data-row="${b.id}">${avatar(b)}${cats()
									.map(
										(c, i) =>
											`<span class="cell" data-cell="${i}">${icon(c.icon)}</span>`,
									)
									.join("")}</div>`,
						)
						.join("")}</div>
					<button type="button" class="btn stop armed" id="end" aria-label="Runde beenden">${icon("end")}</button>`
				: `<div class="cards n${n}">${cats()
						.map(
							(c, i) => `<label class="card" data-card="${i}" style="--ci:${i}">
				<span class="cat">${icon(c.icon)}<span>${esc(c.name)}</span></span>
				${tilesHTML(S.letter)}
				<input class="answer" data-i="${i}" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="24" enterkeyhint="${i === n - 1 ? "done" : "next"}" aria-label="${esc(c.name)} mit ${S.letter}" disabled>
				${flamesOn() ? `<button type="button" class="flame-btn" data-flame="${i}" aria-label="Flamme" aria-pressed="false">${icon("flame")}</button>` : ""}
				<span class="lock">${icon("check")}</span>
			</label>`,
						)
						.join("")}</div>
		<button type="button" class="btn stop ${solo() ? "armed" : ""}" id="stop" ${solo() ? "" : "disabled"}>${icon("hand")}<span>STOPP</span></button>`
		}`,
	);
	$("#letter")?.removeAttribute("id");
	$(".hud .mascot", el).id = "letter";
	paintFriends();
	if (comm) {
		$("#end", el).addEventListener("click", () => {
			if (!S.playing || S.ending) return;
			haptic(30);
			S.stopper = "you";
			slam(`${icon("end")}`);
			sound.slam();
			endRound();
		});
	} else {
		$$(".answer", el).forEach(bindAnswer);
		$$("[data-flame]", el).forEach((b) =>
			b.addEventListener("click", () => toggleFlame(Number(b.dataset.flame))),
		);
		$("#stop", el).addEventListener("click", () => {
			if (S.ending || !S.playing) return;
			if (solo() || S.locked.size === n) playerStop();
		});
	}
	sound.scene = "quiet";
	sound.layer = 0;
	run(async () => {
		if (activated.length) {
			await sleep(250);
			for (const p of activated) {
				toast(`${avatar(p)}${icon("check")}`);
				haptic(10);
			}
		}
		await slotReveal(S.letter);
		S.playing = true;
		sound.scene = "play";
		sound.step = 0;
		if (!comm) {
			$$(".answer").forEach((i) => {
				i.disabled = false;
			});
			$(".answer").focus();
		}
	});
}
function paintFriends() {
	const box = $("#friends");
	if (!box) return;
	const n = cats().length;
	box.innerHTML = bots()
		.map(
			(b) =>
				`<div class="friend ${b.status === "pending" ? "pending" : ""}" data-friend="${b.id}">${avatar(b)}${b.status === "pending" ? `<span class="eye">${icon("eye")}</span>` : `<span class="pips">${"<i></i>".repeat(n)}</span>`}</div>`,
		)
		.join("");
	for (const b of bots()) {
		const k = S.pips[b.id] || 0;
		$$(`[data-friend="${b.id}"] .pips i`).forEach((p, i) =>
			p.classList.toggle("on", i < k),
		);
	}
}
function bindAnswer(input) {
	const i = Number(input.dataset.i);
	const card = input.closest(".card");
	const box = $(".tiles", card);
	input.addEventListener("focus", () => lookAtEl(card));
	input.addEventListener("input", () => {
		if (!S.playing || S.ending) return;
		const v = input.value;
		const grew = [...v].length > [...S.answers[i]].length;
		S.answers[i] = v;
		paintTiles(box, v, S.letter);
		if (grew) {
			sound.key([...v].length - 1);
			const last = $$(".tile:not(.ghost)", box).at(-1);
			if (last) {
				fx.at(last, { n: 3, speed: 2.4, size: 4 });
				lookAtEl(last);
			}
			if (Math.random() < 0.3) mood("blink", 160);
		}
		if (S.locked.has(i) && !ruleValid(v, S.letter)) unlock(i);
	});
	input.addEventListener("keydown", (e) => {
		if (e.key !== "Enter") return;
		e.preventDefault();
		if (commit(i)) {
			if (S.locked.size === cats().length && !S.ending) instantStop();
			else focusNext(i);
		} else if (input.value.trim()) wrong(card);
	});
	input.addEventListener("blur", () => commit(i));
}
function focusNext(i) {
	const n = cats().length;
	const next = Array.from({ length: n }, (_, d) => (i + d + 1) % n).find(
		(k) => !S.locked.has(k),
	);
	if (next !== undefined && next !== i) $(`.answer[data-i="${next}"]`)?.focus();
	else if (S.locked.size === n) $("#stop")?.focus();
}
function wrong(card) {
	card.classList.remove("wrong");
	void card.offsetWidth;
	card.classList.add("wrong");
	sound.crunch();
	haptic([30, 40, 30]);
	mood("sad", 800);
}
function commit(i) {
	if (!S.playing || S.ending) return false;
	const v = S.answers[i].trim();
	if (!ruleValid(v, S.letter)) return false;
	if (S.locked.has(i)) return true;
	S.locked.add(i);
	const card = $(`[data-card="${i}"]`);
	card.classList.add("locked");
	$$(".tile:not(.ghost)", card).forEach((t, k) =>
		anim(
			t,
			[
				{ transform: `rotate(var(--rot)) translateY(0)` },
				{ transform: "rotate(0) translateY(-12px) scale(1.12)" },
				{ transform: "rotate(0) translateY(0)" },
			],
			{ duration: 380, delay: k * 35 },
		),
	);
	fx.at($(".tiles", card), { n: 16, speed: 6 });
	sound.word(S.locked.size);
	sound.layer = S.locked.size;
	haptic(15);
	mood("happy", 700);
	hop($("#letter"), 10);
	if (S.locked.size === cats().length) allClear();
	return true;
}
function unlock(i) {
	S.locked.delete(i);
	$(`[data-card="${i}"]`).classList.remove("locked");
	sound.layer = S.locked.size;
	if (solo()) return;
	$("#stop").disabled = true;
	$("#stop").classList.remove("armed");
}
function toggleFlame(i) {
	if (!S.playing || S.ending) return;
	const prev = S.flame;
	S.flame = prev === i ? -1 : i;
	$$("[data-flame]").forEach((b) => {
		const on = Number(b.dataset.flame) === S.flame;
		b.setAttribute("aria-pressed", String(on));
		b.closest(".card").classList.toggle("flamed", on);
	});
	haptic(S.flame >= 0 ? [10, 20, 25] : 8);
	if (S.flame >= 0) {
		const b = $(`[data-flame="${i}"]`);
		sound.ignite();
		fx.at(b, {
			n: 14,
			speed: 5,
			up: 3,
			colors: ["#ff9600", "#ffc800", "#ff4b4b"],
		});
		mood("wow", 700);
	} else sound.fizzle();
	$(`.answer[data-i="${i}"]`)?.focus();
}
function allClear() {
	nextPalette();
	sound.clear();
	haptic([20, 40, 20, 40, 60]);
	shake(1.6);
	mood("cheer", 1400);
	$$(".card").forEach((c, k) => {
		after(k * 60, () => fx.at(c, { n: 22, speed: 10, size: 11 }));
		anim(
			c,
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.05)" },
				{ transform: "scale(1)" },
			],
			{
				duration: 420,
				delay: k * 60,
			},
		);
	});
	const stop = $("#stop");
	stop.disabled = false;
	stop.classList.add("armed");
	const n = cats().length;
	slam(`<b class="slam-num">${n}/${n}</b>`, "clear");
}
function instantStop() {
	S.ending = true;
	S.playing = false;
	setTimeout(() => {
		S.ending = false;
		playerStop();
	}, 420);
}
function playerStop() {
	S.stopper = "you";
	slam(`${avatar(YOU)}<b>STOPP</b>`);
	sound.slam();
	haptic([40, 30, 80]);
	endRound();
}
function botStop(id) {
	S.stopper = id;
	S.stopAt = S.elapsed + 5000;
	const b = person(id);
	slam(`${avatar(b)}<b>STOPP</b>`, "bot");
	sound.slam();
	haptic([60, 40, 60]);
	sound.scene = "final";
	$("#fuse")?.classList.add("hot");
	document.body.classList.add("urgent");
	setBaseMood("worried");
}
function endRound() {
	if (S.ending) return;
	S.ending = true;
	S.playing = false;
	S.endAt = S.elapsed;
	document.body.classList.remove("urgent");
	$$(".answer").forEach((i) => {
		i.disabled = true;
		i.blur();
	});
	sound.layer = 0;
	setBaseMood("idle");
	run(async () => {
		await sleep(S.stopper === "you" ? 700 : 300);
		$$(".card, .board-row").forEach((c, k) =>
			anim(
				c,
				[
					{ transform: "none", opacity: 1 },
					{
						transform: `translateY(-30px) rotate(${k % 2 ? 3 : -3}deg)`,
						opacity: 0,
					},
				],
				{ duration: 320, delay: k * 50, fill: "forwards", easing: "ease-in" },
			),
		);
		sound.whoosh();
		await sleep(520);
		solo() ? soloReview() : review();
	});
}
function tickBots() {
	if (!S.playing) return;
	const n = cats().length;
	for (const b of activeBots()) {
		const plan = S.plan[b.id];
		if (!plan) continue;
		const k = plan.times.filter((t) => t <= S.elapsed).length;
		if (k > (S.pips[b.id] || 0)) {
			S.pips[b.id] = k;
			const f = $(`[data-friend="${b.id}"]`);
			if (f) {
				const pip = $$(".pips i", f)[k - 1];
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
			plan.times.forEach((t, ci) => {
				const cell = $(`[data-row="${b.id}"] [data-cell="${ci}"]`);
				if (cell && t <= S.elapsed && !cell.classList.contains("on")) {
					cell.classList.add("on");
					cell.style.setProperty("--pc", b.color);
					bounce(cell, 1.3);
				}
			});
			sound.note(84 + k * 2, 0.04);
			if (k === n) mood("wow", 600);
		}
	}
	if (!S.lateDone && S.round < S.cfg.rounds - 1 && S.elapsed > 9000) {
		S.lateDone = true;
		const b = BOT_POOL.find((x) => !person(x.id));
		if (b) {
			S.people.push({ ...b, status: "pending" });
			S.totals[b.id] = 0;
			paintFriends();
			const f = $(`[data-friend="${b.id}"]`);
			bounce(f, 1.4, 450);
			fx.at(f, { n: 10, speed: 4, colors: [b.color] });
			toast(`${avatar(b)}${icon("eye")}`);
		}
	}
	if (!S.stopper && S.elapsed >= S.buzzAt) {
		const winner = activeBots()
			.filter((b) => S.plan[b.id].words.every(Boolean))
			.sort(
				(a, b) =>
					Math.max(...S.plan[a.id].times) - Math.max(...S.plan[b.id].times),
			)[0];
		if (winner) botStop(winner.id);
	}
	const fuse = $("#fuse");
	if (fuse) {
		const frac = S.stopper
			? Math.max(0, (S.stopAt - S.elapsed) / 5000)
			: S.limit === Infinity
				? 1
				: Math.max(0, 1 - S.elapsed / S.limit);
		fuse.style.setProperty("--f", frac.toFixed(4));
		const left = S.stopper ? S.stopAt - S.elapsed : S.limit - S.elapsed;
		if (!S.stopper && left < 10000 && sound.scene === "play") {
			sound.scene = "final";
			fuse.classList.add("hot");
			document.body.classList.add("urgent");
			setBaseMood("worried");
		}
		if (left < 5500) {
			const sec = Math.ceil(left / 1000);
			if (sec !== S.lastSec && sec > 0) {
				S.lastSec = sec;
				sound.tick();
				haptic(8);
				const r = $("#letter").getBoundingClientRect();
				floatText(String(sec), r.right + 30, r.top + r.height / 2, "count");
			}
		}
	}
	if ((S.stopper && S.elapsed >= S.stopAt) || S.elapsed >= S.limit) {
		if (!S.stopper) S.stopper = "time";
		endRound();
	}
}

// ---------- review ----------
function entriesFor(ci) {
	return players().map((p) => {
		const plan = S.plan[p.id];
		const raw =
			p.id === "you"
				? S.answers[ci]
				: plan.times[ci] <= S.endAt
					? plan.words[ci]
					: "";
		const word = raw.trim();
		return {
			p,
			word,
			ok: ruleValid(word, S.letter),
			accepted: true,
			key: norm(word),
			flame: (p.id === "you" ? S.flame : plan.flame) === ci && !!word,
			dubious: p.id !== "you" && plan.dubious === ci,
		};
	});
}
function points(entries) {
	const valid = entries.filter((e) => e.ok && e.accepted);
	for (const e of entries) {
		if (!(e.ok && e.accepted)) e.pts = 0;
		else if (valid.length === 1) e.pts = 20;
		else e.pts = valid.some((x) => x !== e && x.key === e.key) ? 5 : 10;
		e.flameWin = e.flame && e.pts >= 10;
		if (e.flame) e.pts = e.flameWin ? e.pts + 5 : 0;
	}
}
function review() {
	sound.scene = "review";
	sound.step = 0;
	S.roundPts = Object.fromEntries(players().map((p) => [p.id, 0]));
	S.roundRows = [];
	screen(
		"review",
		`<div class="scoreboard">${players()
			.map(
				(p) => `<div class="sb" data-sb="${p.id}">${avatar(p)}<b>0</b></div>`,
			)
			.join("")}</div>
		<div class="review-head"><span class="letter-chip">${S.letter}</span><span class="cat-big" id="cat-big"></span><span class="steps">${"<i></i>".repeat(cats().length)}</span></div>
		<div class="answers" id="answers"></div>
		<button type="button" class="btn next" id="next" aria-label="Weiter">${icon("arrow")}<i class="fill"></i></button>`,
	);
	$("#next").addEventListener("click", () => {
		S.skip = true;
		haptic(8);
		S.nextNow?.();
	});
	run(async () => {
		for (let ci = 0; ci < cats().length; ci++) await reviewCategory(ci);
		roundResult();
	});
}
const ansHTML = (
	e,
	cat,
) => `<div class="ans" data-ans="${e.p.id}" style="--pc:${e.p.color}">
	<div class="ans-card"><div class="ans-back">${icon(cat.icon)}</div>
	<div class="ans-front">${avatar(e.p)}<div class="ans-word"></div>${e.flame ? `<span class="ans-flame">${icon("flame")}</span>` : ""}<span class="pts"></span></div></div></div>`;
async function reviewCategory(ci) {
	S.skip = false;
	const cat = cats()[ci];
	const big = $("#cat-big");
	big.innerHTML = `${icon(cat.icon)}<span>${esc(cat.name)}</span>`;
	anim(
		big,
		[
			{ transform: "translateX(40px)", opacity: 0 },
			{ transform: "none", opacity: 1 },
		],
		{
			duration: 320,
		},
	);
	$$(".steps i").forEach((s, k) => s.classList.toggle("on", k <= ci));
	const entries = entriesFor(ci);
	const you = entries.find((e) => e.p.id === "you");
	const order = [...entries.filter((e) => e !== you), ...(you ? [you] : [])];
	const list = $("#answers");
	list.innerHTML = order.map((e) => ansHTML(e, cat)).join("");
	const row = (e) => $(`[data-ans="${e.p.id}"]`);
	for (const e of order) {
		const host = $(".ans-word", row(e));
		if (e.word) {
			e.box = miniWord(e.word, S.letter, lastMode());
			host.append(e.box);
		} else host.innerHTML = '<span class="empty">—</span>';
	}
	for (const e of order) {
		await sleep(55);
		row(e).classList.add("dealt");
	}
	sound.flip();
	await sleep(120);
	for (const e of order) {
		await sleep(e === you ? 300 : 140);
		row(e).classList.add("open");
		sound.flip();
		e.box?._paint();
		if (e.word && !e.ok) {
			row(e).classList.add("cracked");
			sound.crunch();
		}
	}
	if (you) {
		const yr = row(you);
		if (you.pts !== 0) lookAtEl(yr);
	}
	const host = isHost();
	const doubt = entries.find((e) => e.dubious && e.ok);
	const a = entries.find(
		(e) =>
			e.ok &&
			entries.some(
				(x) =>
					x !== e && x.ok && x.key !== e.key && fold(x.word) === fold(e.word),
			),
	);
	const pair = a
		? [
				a,
				entries.find(
					(x) =>
						x !== a && x.ok && x.key !== a.key && fold(x.word) === fold(a.word),
				),
			]
		: null;
	const toggle = (e) => {
		if (!e.ok) return;
		e.accepted = !e.accepted;
		row(e).classList.toggle("cracked", !e.accepted);
		e.accepted ? sound.word(1) : sound.crunch();
		haptic(e.accepted ? 10 : [20, 30, 20]);
		if (!e.accepted) shake(0.4);
	};
	if (host)
		for (const e of entries)
			row(e).addEventListener("click", (ev) => {
				if (ev.target.closest("button") || list.classList.contains("frozen"))
					return;
				toggle(e);
				if (e === doubt) doubt.decided = true;
			});
	if (pair) {
		const link = () => {
			pair.merged = !pair.merged;
			pair[1].key = pair.merged ? pair[0].key : norm(pair[1].word);
			for (const e of pair) {
				row(e).classList.toggle("linked", pair.merged);
				$(".link-btn", row(e))?.setAttribute(
					"aria-pressed",
					String(pair.merged),
				);
			}
			sound.clack();
			haptic(pair.merged ? [10, 40, 10] : 8);
			for (const e of pair) bounce(row(e), 0.94, 240);
		};
		pair.link = link;
		for (const e of pair) {
			row(e).classList.add("maybe");
			if (host) {
				row(e).insertAdjacentHTML(
					"beforeend",
					`<button type="button" class="link-btn" aria-label="Zusammenführen" aria-pressed="false">${icon("link")}</button>`,
				);
				$(".link-btn", row(e)).addEventListener("click", link);
			}
		}
	}
	let votes = [];
	if (doubt) votes = await startDoubt(doubt, host, row(doubt));
	const wait =
		doubt || (pair && host) ? (host ? 5200 : 3000) : host ? 1500 : 900;
	if (pair && !host) after(900, () => !pair.merged && pair.link());
	await waitNext(wait);
	list.classList.add("frozen");
	if (doubt && !doubt.decided)
		await resolveDoubt(doubt, votes, host, row(doubt));
	$$(".decide, .link-btn").forEach((b) => b.remove());
	const groups = {};
	points(entries);
	for (const e of entries)
		if (e.pts === 5 || (e.flame && !e.flameWin && e.ok && e.accepted))
			(groups[e.key] ??= []).push(e);
	for (const g of Object.values(groups)) {
		if (g.length < 2) continue;
		await sleep(200);
		for (const e of g) {
			row(e).classList.add("twin");
			bounce(row(e), 0.94, 260);
		}
		sound.clack();
	}
	for (const e of order) {
		await sleep(e === you ? 300 : 150);
		stamp(e, row(e));
	}
	if (you?.pts >= 20 && entries.filter((e) => e.pts > 0).length === 1) {
		row(you).classList.add("solo-win");
		fx.at(row(you), { n: 40, speed: 12, size: 12 });
		sound.clear();
		mood("cheer", 1200);
	}
	if (you?.pts)
		S.words.push({ word: you.word, pts: you.pts, cat: ci, letter: S.letter });
	S.roundRows.push(entries);
	await sleep(700);
}
async function startDoubt(e, host, el) {
	el.classList.add("doubt");
	el.insertAdjacentHTML(
		"beforeend",
		`<div class="votes"></div><div class="decide ${host ? "host" : "player"}"><button type="button" class="yes" aria-label="${host ? "Gilt" : "Daumen hoch"}">${icon(host ? "check" : "up")}</button><button type="button" class="no" aria-label="${host ? "Gilt nicht" : "Daumen runter"}">${icon(host ? "x" : "down")}</button></div>`,
	);
	mood("wow", 900);
	const votes = [];
	const voters = players().filter(
		(p) => p.id !== "you" && p.id !== e.p.id && (host || p.id !== S.host),
	);
	const decide = (v) => {
		if (host) {
			e.decided = true;
			e.accepted = v;
			el.classList.remove("doubt");
			el.classList.toggle("cracked", !v);
			v ? sound.word(2) : sound.crunch();
			haptic(v ? 12 : [20, 30, 20]);
			fx.at(el, { n: 8, speed: 4 });
			S.nextNow?.();
		} else {
			e.yourVote = v;
			$$(".decide button", el).forEach((b) =>
				b.setAttribute(
					"aria-pressed",
					String(b.classList.contains(v ? "yes" : "no")),
				),
			);
			addVote(el, YOU, !v);
			sound.tap();
			haptic(10);
		}
	};
	$(".yes", el).addEventListener("click", () => decide(true));
	$(".no", el).addEventListener("click", () => decide(false));
	for (const [k, b] of voters.entries())
		after(200 + k * 320, () => {
			const down = k === 0 || Math.random() < 0.4;
			votes.push(down);
			addVote(el, b, down);
			sound.tone(down ? 220 : 660, 0.08, 0.14, { type: "triangle" });
		});
	return votes;
}
function addVote(el, p, down) {
	$(`.vote[data-v="${p.id}"]`, el)?.remove();
	$(".votes", el).insertAdjacentHTML(
		"beforeend",
		`<span class="vote ${down ? "down" : "up"}" data-v="${p.id}" style="--pc:${p.color}">${icon(down ? "down" : "up")}</span>`,
	);
}
async function resolveDoubt(e, votes, host, el) {
	const downs = votes.filter(Boolean).length + (e.yourVote === false ? 1 : 0);
	const ups =
		votes.length - votes.filter(Boolean).length + (e.yourVote ? 1 : 0);
	e.accepted = downs <= ups;
	if (!host) {
		el.insertAdjacentHTML(
			"beforeend",
			`<span class="judge">${avatar(hostPerson())}${icon("crown")}</span>`,
		);
		sound.stamp(0);
		await sleep(450);
	}
	el.classList.remove("doubt");
	if (!e.accepted) {
		el.classList.add("cracked");
		sound.crunch();
		shake(0.6);
	} else {
		sound.word(2);
		fx.at(el, { n: 10, speed: 5 });
	}
	if (e.yourVote !== undefined && e.yourVote === e.accepted) mood("happy", 700);
	await sleep(380);
}
function stamp(e, el) {
	const pts = $(".pts", el);
	pts.textContent = e.pts;
	pts.className = `pts p${Math.min(20, e.pts - (e.flameWin ? 5 : 0))} on`;
	sound.stamp(e.pts);
	if (e.p.id === "you") haptic(e.pts >= 10 ? [15, 30, 25] : 12);
	if (e.flame) {
		const f = $(".ans-flame", el);
		if (e.flameWin) {
			f.classList.add("win");
			sound.ignite();
			fx.at(f, {
				n: 18,
				speed: 7,
				up: 3,
				colors: ["#ff9600", "#ffc800", "#ff4b4b"],
			});
			const r = f.getBoundingClientRect();
			floatText("+5", r.left + r.width / 2, r.top, "flame-float");
		} else {
			f.classList.add("out");
			sound.fizzle();
			fx.at(f, { n: 8, speed: 2, up: 2, colors: ["#c9c9d4", "#e6e6ee"] });
		}
	}
	if (e.pts >= 10)
		fx.at(pts, {
			n: e.pts >= 20 ? 14 : 7,
			speed: e.pts >= 20 ? 7 : 4,
			size: 7,
		});
	if (!e.pts) {
		if (e.p.id === "you") mood("sad", 700);
		return;
	}
	if (e.p.id === "you") mood("happy", 600);
	S.roundPts[e.p.id] += e.pts;
	const target = $(`[data-sb="${e.p.id}"]`);
	const a = pts.getBoundingClientRect();
	const b = target.getBoundingClientRect();
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
		{ duration: reduced() ? 1 : 480, easing: "cubic-bezier(.4,0,.2,1)" },
	);
	m.onfinish = () => {
		fly.remove();
		const n = $("b", target);
		if (!n) return;
		n.textContent = S.roundPts[e.p.id];
		bounce(target, 1.25, 260);
		sound.note(84, 0.05);
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

// ---------- solo ----------
function soloReview() {
	sound.scene = "review";
	const rows = cats().map((c, ci) => {
		const word = S.answers[ci].trim();
		return {
			ci,
			word,
			ok: ruleValid(word, S.letter),
			on: ruleValid(word, S.letter),
		};
	});
	const sum = () => rows.filter((r) => r.ok && r.on).length * 20;
	const last = S.round === S.cfg.rounds - 1;
	screen(
		"solo-review",
		`<div class="solo-bar"><span class="letter-chip">${S.letter}</span><b id="solo-sum">0</b><span class="solo-total">${icon("star")}<b>${S.totals.you}</b></span></div>
		<div class="solo-list">${rows
			.map(
				(r) =>
					`<button type="button" class="solo-row ${r.ok ? "" : "cracked"}" data-row="${r.ci}" aria-pressed="${r.on}">${icon(cats()[r.ci].icon)}<span class="ans-word"></span><span class="pts">${r.ok ? 20 : 0}</span></button>`,
			)
			.join("")}</div>
		<button type="button" class="btn primary" id="cont">${last ? icon("crown") : icon("arrow")}</button>`,
	);
	for (const r of rows) {
		const host = $(`[data-row="${r.ci}"] .ans-word`);
		if (!r.word) host.innerHTML = '<span class="empty">—</span>';
		else {
			const box = miniWord(r.word, S.letter, lastMode());
			host.append(box);
			box._paint();
		}
		$(`[data-row="${r.ci}"]`).addEventListener("click", (e) => {
			if (!r.ok) return shake(0.3);
			r.on = !r.on;
			e.currentTarget.classList.toggle("cracked", !r.on);
			e.currentTarget.setAttribute("aria-pressed", String(r.on));
			r.on ? sound.word(1) : sound.crunch();
			haptic(10);
			paint();
		});
	}
	const paint = () => {
		const el = $("#solo-sum");
		countUp(el, Number(el.textContent), sum(), 300);
		bounce(el, 1.25);
	};
	$("#cont").addEventListener("click", () => {
		S.totals.you += sum();
		for (const r of rows)
			if (r.ok && r.on)
				S.words.push({ word: r.word, pts: 20, cat: r.ci, letter: S.letter });
		if (last) return soloEnd();
		S.round++;
		startRound();
	});
	run(async () => {
		for (const r of rows) {
			await sleep(160);
			const el = $(`[data-row="${r.ci}"]`);
			el.classList.add("in");
			sound.stamp(r.ok ? 20 : 0);
			if (r.ok) fx.at($(".pts", el), { n: 8, speed: 4 });
		}
		paint();
		$("#cont").classList.add("nudge");
	});
}
function soloEnd() {
	sound.scene = "result";
	const record = S.totals.you > (db.soloBest || 0);
	if (record) {
		db.soloBest = S.totals.you;
		save();
	}
	finalScreen(S.totals.you, record, [
		[icon("check"), S.words.length],
		[icon("grid"), S.cfg.rounds],
	]);
}

// ---------- round result ----------
function roundResult() {
	sound.scene = "result";
	const ranked = players();
	const prev = { ...S.totals };
	for (const p of ranked)
		S.totals[p.id] = (S.totals[p.id] || 0) + S.roundPts[p.id];
	const n = cats().length;
	const youValid = S.roundRows.filter(
		(r) => r.find((e) => e.p.id === "you")?.pts > 0,
	).length;
	S.streak = youValid === n ? S.streak + 1 : 0;
	const before = [...ranked].sort((a, b) => prev[b.id] - prev[a.id]);
	const max = Math.max(1, ...ranked.map((p) => S.totals[p.id]));
	const last = S.round === S.cfg.rounds - 1;
	screen(
		"result",
		`<div class="result-head"><span class="letter-chip">${S.letter}</span><div class="rounds big">${Array.from({ length: S.cfg.rounds }, (_, i) => `<i class="${i <= S.round ? "done" : ""}"></i>`).join("")}</div></div>
		<ol class="ranking" id="ranking">${before
			.map(
				(
					p,
				) => `<li class="rank ${p.id === "you" ? "me" : ""}" data-rank="${p.id}" style="--pc:${p.color};--w:${prev[p.id] / max}">
					<span class="pos"></span>${avatar(p)}<span class="name">${p.name}</span>
					${p.id === "you" && S.streak >= 1 ? `<span class="streak">${icon("flame")}<b>${S.streak}</b></span>` : ""}
					<span class="bar"><i></i></span><span class="gain">+${S.roundPts[p.id]}</span><b class="total">${prev[p.id]}</b><span class="ready">${icon("check")}</span></li>`,
			)
			.join("")}</ol>
		${
			bots().some((b) => b.status === "pending")
				? `<div class="waiting">${bots()
						.filter((b) => b.status === "pending")
						.map((b) => avatar(b))
						.join("")}${icon("eye")}</div>`
				: ""
		}
		<button type="button" class="btn primary" id="cont">${last ? icon("crown") : `<span>${S.round + 2}</span>`}${icon("arrow")}</button>`,
	);
	const rows = () => $$("#ranking .rank");
	const setPos = () =>
		rows().forEach((r, i) => {
			$(".pos", r).innerHTML = i === 0 ? icon("crown") : String(i + 1);
		});
	setPos();
	$("#cont").addEventListener("click", () => {
		haptic(15);
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
			if (S.roundPts[id]) sound.note(76 + (id === "you" ? 7 : 0), 0.06);
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
		for (const r of sorted) list.append(r);
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
		if (newYou >= 0 && newYou < oldYou) {
			await sleep(500);
			const me = $('[data-rank="you"]');
			me.classList.add("up");
			fx.at(me, { n: 30, speed: 9 });
			sound.combo(4 - newYou);
			haptic([20, 40, 40]);
			mood("cheer", 1200);
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
				{
					duration: 500,
				},
			);
			fx.at(st, { n: 14, speed: 6, colors: ["#ff7a1a", "#ffc800", "#ff4b6e"] });
		}
		for (const b of shuffle(activeBots())) {
			await sleep(rand(500, 1100));
			$(`[data-rank="${b.id}"]`)?.classList.add("is-ready");
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
	sound.scene = "result";
	const ranked = players().sort((a, b) => S.totals[b.id] - S.totals[a.id]);
	const place = ranked.findIndex((p) => p.id === "you") + 1;
	const best = [...S.words].sort(
		(a, b) => b.pts - a.pts || b.word.length - a.word.length,
	)[0];
	const slots = [
		[ranked[1], 2],
		[ranked[0], 1],
		[ranked[2], 3],
	].filter(([p]) => p);
	screen(
		"podium",
		`<div class="podium-row">${slots
			.map(
				([
					p,
					k,
				]) => `<div class="step s${k} ${p.id === "you" ? "me" : ""}" data-step="${p.id}">
					<div class="step-av">${k === 1 ? `<span class="crown">${icon("crown")}</span>` : ""}${avatar(p, "big")}<b>${S.totals[p.id]}</b></div>
					<div class="block"><span>${k}</span></div></div>`,
			)
			.join("")}</div>
		${ranked
			.slice(3)
			.map(
				(p, i) =>
					`<div class="fourth ${p.id === "you" ? "me" : ""}"><span>${i + 4}</span>${avatar(p)}<b>${S.totals[p.id]}</b></div>`,
			)
			.join("")}
		${best ? `<div class="best-word"><span class="cat">${icon(cats()[best.cat]?.icon || "star")}</span><div class="tiles mini" id="best" data-max="30"><span class="caret"></span></div><span class="pts p${Math.min(20, best.pts)} on">${best.pts}</span></div>` : ""}
		<div class="end-actions"><button type="button" class="btn primary" id="again">${icon("arrow")}</button><button type="button" class="btn ghost" id="to-lobby" aria-label="Lobby">${icon("grid")}</button><button type="button" class="btn ghost" id="to-sprint" aria-label="Sprint">${icon("bolt")}</button></div>`,
	);
	if (best) paintTiles($("#best"), best.word, best.letter, false);
	bindEnd();
	run(async () => {
		for (const [p] of [...slots].sort((a, b) => b[1] - a[1])) {
			await sleep(420);
			$(`[data-step="${p.id}"]`).classList.add("up");
			sound.stamp(p.id === ranked[0].id ? 20 : 10);
		}
		await sleep(400);
		sound.fanfare();
		fx.rain(place === 1 ? 160 : 70);
		haptic(place === 1 ? [30, 50, 30, 50, 120] : 20);
		mood(place === 1 ? "cheer" : "happy", 2400);
		if (place === 1) slam(`${avatar(YOU)}<b>1</b>`, "win");
	});
}
function bindEnd() {
	$("#again").addEventListener("click", () =>
		S.mode === "sprint" ? startSprint() : startMatch(),
	);
	$("#to-lobby")?.addEventListener("click", lobby);
	$("#to-sprint")?.addEventListener("click", startSprint);
}
function finalScreen(score, record, stats) {
	screen(
		"final",
		`<div class="hero">${mascotHTML("", "big")}</div>
		<div class="big-score"><b id="final">0</b>${record ? `<span class="badge">${icon("crown")}</span>` : ""}</div>
		<div class="stats">${stats.map(([ic, v]) => `<span>${ic}<b>${v}</b></span>`).join("")}</div>
		<div class="end-actions"><button type="button" class="btn primary" id="again">${icon("arrow")}</button><button type="button" class="btn ghost" id="to-lobby" aria-label="Lobby">${icon("grid")}</button></div>`,
	);
	$(".hero .m-letter").innerHTML = icon("star");
	countUp($("#final"), 0, score, 1100);
	bindEnd();
	run(async () => {
		for (let i = 0; i < 8; i++) {
			await sleep(130);
			sound.slot(i * 3);
		}
		sound.fanfare();
		mood("cheer", 2000);
		hop($(".hero .mascot"), 40);
		if (record) {
			fx.rain(150);
			slam(`${icon("crown")}<b>${score}</b>`, "win");
			haptic([30, 50, 30, 50, 120]);
		}
	});
}

// ---------- sprint ----------
const SPRINT_MS = 45000;
function startSprint() {
	S.mode = "sprint";
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
	S.lastSec = null;
	screen(
		"sprint",
		`<div class="hud">
			${mascotHTML("", "letter")}
			<div class="hud-mid"><div class="sprint-score"><b id="sp-score">0</b>${db.best ? `<small>${icon("crown")}${db.best}</small>` : ""}</div><div class="fuse" id="fuse"><i></i><b></b></div></div>
			<div class="combo" id="combo"><b>×1</b><i></i></div>
		</div>
		<div class="sprint-cats">${cats()
			.map((c, i) => `<span data-sc="${i}">${icon(c.icon)}</span>`)
			.join("")}</div>
		<label class="card big" id="sp-card"><span class="cat" id="sp-cat"></span>${tilesHTML(S.letter, 46, false)}<input class="answer" id="sp-input" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="24" enterkeyhint="next" disabled><span class="lock">${icon("check")}</span></label>
		<div class="sprint-actions"><button type="button" class="btn ghost" id="sp-skip" aria-label="Überspringen">${icon("skip")}</button></div>
		<div class="chain" id="chain"></div>`,
	);
	$(".hud .mascot").id = "letter";
	paintSprintCat();
	const input = $("#sp-input");
	const box = $("#sp-card .tiles");
	input.addEventListener("input", () => {
		if (!S.playing) return;
		const grew = [...input.value].length > (box._chars?.length || 0);
		paintTiles(box, input.value, S.letter);
		if (grew) {
			sound.key([...input.value].length - 1 + S.sprint.combo);
			const last = $$(".tile:not(.ghost)", box).at(-1);
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
	sound.scene = "quiet";
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
	const c = cats()[sp.cat];
	$("#sp-cat").innerHTML = `${icon(c.icon)}<span>${esc(c.name)}</span>`;
	$("#sp-input").setAttribute("aria-label", `${c.name} mit ${S.letter}`);
	$$("[data-sc]").forEach((el, i) => {
		el.classList.toggle("now", i === sp.cat);
		el.classList.toggle("done", sp.batch.has(i));
	});
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
	sp.combo = sp.t - sp.lastAt <= 6000 ? Math.min(5, sp.combo + 1) : 1;
	sp.lastAt = sp.t;
	sp.maxCombo = Math.max(sp.maxCombo, sp.combo);
	const pts = 10 * sp.combo;
	sp.score += pts;
	sp.words.push({ word, letter: S.letter, cat: sp.cat, pts, valid: true });
	sp.batch.add(sp.cat);
	const box = $(".tiles", card);
	const r = box.getBoundingClientRect();
	floatText(`+${pts}`, r.left + r.width / 2, r.top, `pts-float c${sp.combo}`);
	fx.at(box, { n: 10 + sp.combo * 4, speed: 5 + sp.combo });
	sound.word(sp.combo);
	sound.layer = sp.combo;
	haptic(sp.combo >= 3 ? [12, 30, 18] : 14);
	mood("happy", 600);
	hop($("#letter"), 8 + sp.combo * 3);
	if (sp.combo >= 2) {
		sound.combo(sp.combo);
		const c = $("#combo");
		$("b", c).textContent = `×${sp.combo}`;
		c.dataset.k = sp.combo;
		anim(
			c,
			[
				{ transform: "scale(1)" },
				{ transform: "scale(1.5) rotate(-6deg)" },
				{ transform: "scale(1)" },
			],
			{
				duration: 380,
			},
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
	chip.innerHTML = `${icon(cats()[sp.cat].icon)}${esc(word)}`;
	$("#chain").prepend(chip);
	countUp($("#sp-score"), sp.score - pts, sp.score, 300);
	input.value = "";
	paintTiles(box, "", S.letter, false);
	if (sp.batch.size === cats().length) return nextSprintLetter(true);
	const n = cats().length;
	do sp.cat = (sp.cat + 1) % n;
	while (sp.batch.has(sp.cat));
	paintSprintCat();
}
function sprintSkip() {
	const sp = S.sprint;
	if (!S.playing) return;
	sp.combo = 0;
	paintCombo();
	sound.poof();
	haptic(8);
	$("#sp-input").value = "";
	paintTiles($("#sp-card .tiles"), "", S.letter, false);
	const n = cats().length;
	const rest = Array.from({ length: n }, (_, d) => (sp.cat + d + 1) % n).filter(
		(i) => !sp.batch.has(i),
	);
	if (!rest.length || rest[0] <= sp.cat) return nextSprintLetter(false);
	sp.cat = rest[0];
	paintSprintCat();
}
function paintCombo() {
	const c = $("#combo");
	if (!c) return;
	$("b", c).textContent = `×${Math.max(1, S.sprint.combo)}`;
	c.dataset.k = S.sprint.combo;
}
function nextSprintLetter(clear) {
	const sp = S.sprint;
	S.playing = false;
	if (clear) {
		nextPalette();
		sound.clear();
		haptic([20, 40, 20, 40, 60]);
		mood("cheer", 1200);
		const n = cats().length;
		slam(`<b class="slam-num">${n}/${n}</b>`, "clear");
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
	if (left < 10000 && sound.scene === "sprint") {
		sound.scene = "final";
		setBaseMood("worried");
	}
	const sec = Math.ceil(left / 1000);
	if (left < 5000 && sec !== S.lastSec && sec > 0) {
		S.lastSec = sec;
		sound.tick();
		const r = $("#letter").getBoundingClientRect();
		floatText(String(sec), r.right + 30, r.top + r.height / 2, "count");
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
	slam(`${icon("clock")}`);
	sound.slam();
	haptic([40, 30, 80]);
	sound.layer = 0;
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
					`<div class="sr-group"><span class="letter-chip">${L}</span><div class="sr-words">${ws
						.map(
							([i, w]) =>
								`<button type="button" class="chip" data-w="${i}" aria-pressed="true" style="--c:var(--t${(i % 5) + 1})">${icon(cats()[w.cat].icon)}${esc(w.word)}<small>${w.pts}</small></button>`,
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
			haptic(10);
			$("#sr-score").textContent =
				sp.score -
				sp.words.filter((x) => !x.valid).reduce((a, x) => a + x.pts, 0);
		}),
	);
	$("#sr-done").addEventListener("click", sprintResult);
	run(async () => {
		for (const b of $$("[data-w]")) {
			b.classList.add("in");
			sound.note(80 + (Number(b.dataset.w) % 8), 0.05);
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
	if (record) {
		db.best = score;
		save();
	}
	finalScreen(score, record, [
		[icon("check"), sp.words.filter((w) => w.valid).length],
		[icon("bolt"), `×${sp.maxCombo}`],
		[icon("grid"), sp.li],
	]);
}

// ---------- host disconnect (sketch) ----------
function hostDrop() {
	const h = S.host === "you" ? bots()[0] : hostPerson();
	if (!h || $(".drop")) return shake(0.5);
	const el = document.createElement("div");
	el.className = "drop";
	el.innerHTML = `<div class="drop-card">${avatar(h, "big")}<span class="drop-wifi">${icon("wifi")}</span><svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/></svg><b id="drop-n">15</b></div>`;
	document.body.append(el);
	setBaseMood("worried");
	haptic([40, 60, 40]);
	sound.crunch();
	const back = rand(4500, 7500);
	const t0 = performance.now();
	const tick = () => {
		const ms = performance.now() - t0;
		const left = Math.ceil((15000 - ms) / 1000);
		const n = $("#drop-n", el);
		if (n && n.textContent !== String(left)) {
			n.textContent = left;
			sound.tick();
		}
		el.style.setProperty("--k", (ms / 15000).toFixed(4));
		if (ms < back) return requestAnimationFrame(tick);
		el.classList.add("back");
		sound.word(3);
		haptic([15, 30, 15]);
		fx.at($(".drop-card", el), { n: 30, speed: 9 });
		setBaseMood("idle");
		mood("cheer", 900);
		setTimeout(() => el.remove(), 700);
	};
	requestAnimationFrame(tick);
}

// ---------- loop ----------
let lastT = performance.now();
let driftAt = 0;
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
		const t = S.tilt;
		t.x += (t.tx - t.x) * 0.08;
		t.y += (t.ty - t.y) * 0.08;
		const st = document.body.style;
		st.setProperty("--px", t.x.toFixed(3));
		st.setProperty("--py", t.y.toFixed(3));
		if (now - driftAt > 150) {
			driftAt = now;
			const d = S.drift;
			d.v = (d.v + rand(-1, 1) * 0.25) * 0.96;
			d.d = clamp(d.d + d.v, -22, 22);
			const progress =
				S.phase === "play" && S.limit !== Infinity
					? (S.elapsed / S.limit) * 40
					: S.phase === "sprint" && S.sprint
						? (S.sprint.t / SPRINT_MS) * 40
						: 0;
			st.setProperty("--drift", `${(d.d + progress).toFixed(1)}deg`);
		}
	}
	fx.draw();
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- chrome ----------
function paintRole() {
	const b = $("#role");
	const h = hostPerson();
	b.innerHTML = `${icon("crown")}${avatar(h, "sm")}`;
	b.disabled = !person("mia") || S.phase !== "lobby";
	b.setAttribute(
		"aria-label",
		h.id === "you" ? "Du bist Host" : `${h.name} ist Host`,
	);
}
$("#role").addEventListener("click", () => {
	if (!person("mia") || S.phase !== "lobby") return;
	S.host = S.host === "you" ? "mia" : "you";
	sound.start();
	sound.pop();
	haptic(10);
	lobby();
	bounce($("#role"), 1.2);
});
function paintSound() {
	const b = $("#sound");
	b.innerHTML = icon(prefs.sound ? "sound" : "mute");
	b.setAttribute("aria-pressed", String(prefs.sound));
}
$("#sound").addEventListener("click", () => {
	sound.setOn(!prefs.sound);
	save();
	paintSound();
	haptic(8);
});
$("#gear").innerHTML = icon("gear");
$$("[data-icon]").forEach((el) => {
	el.innerHTML = icon(el.dataset.icon);
});
$("#gear").addEventListener("click", () => {
	sound.start();
	sound.tap();
	$("#prefs").showModal();
});
$("#prefs").addEventListener("click", (e) => {
	if (e.target === e.currentTarget) e.currentTarget.close();
});
for (const k of ["music", "sfx"]) {
	const el = $(`#${k}`);
	el.value = Math.round(prefs[k] * 100);
	el.addEventListener("input", () => {
		prefs[k] = Number(el.value) / 100;
		sound.setLevels();
		save();
	});
	el.addEventListener("change", () => (k === "sfx" ? sound.word(2) : null));
}
const paintToggles = () => {
	$("#haptics").setAttribute("aria-pressed", String(prefs.haptics));
	$("#motion").setAttribute("aria-pressed", String(reduced()));
};
$("#haptics").addEventListener("click", () => {
	prefs.haptics = !prefs.haptics;
	save();
	paintToggles();
	haptic([20, 40, 20]);
});
$("#motion").addEventListener("click", () => {
	db.reduced = !reduced();
	document.body.classList.toggle("reduced", db.reduced);
	save();
	paintToggles();
});
$("#drop").addEventListener("click", () => {
	$("#prefs").close();
	hostDrop();
});
document.addEventListener("visibilitychange", () => {
	if (!sound.ctx) return;
	document.hidden
		? sound.ctx.suspend().catch(() => {})
		: prefs.sound && sound.ctx.resume().catch(() => {});
});
let pointerQueued = false;
addEventListener("pointermove", (e) => {
	if (e.pointerType === "mouse") {
		S.tilt.tx = clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1);
		S.tilt.ty = clamp((e.clientY / innerHeight - 0.5) * 2, -1, 1);
	}
	if (pointerQueued || S.phase === "play") return;
	pointerQueued = true;
	requestAnimationFrame(() => {
		pointerQueued = false;
		lookAt(e.clientX, e.clientY);
	});
});
addEventListener("deviceorientation", (e) => {
	if (e.gamma == null) return;
	S.tilt.tx = clamp(e.gamma / 25, -1, 1);
	S.tilt.ty = clamp((e.beta - 45) / 25, -1, 1);
});
addEventListener(
	"pointerdown",
	() => {
		sound.start();
		const D = window.DeviceOrientationEvent;
		if (D && typeof D.requestPermission === "function")
			D.requestPermission().catch(() => {});
	},
	{ once: true },
);
const media = matchMedia("(prefers-reduced-motion: reduce)");
document.body.classList.toggle("reduced", db.reduced ?? media.matches);
paintToggles();
paintSound();
setPalette(Math.floor(Math.random() * PALETTES.length));
lobby();
