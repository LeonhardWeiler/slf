const hz = (m) => 440 * 2 ** ((m - 69) / 12);

const SCENES = {
	lobby: { bpm: 108, kick: 1, clap: 0, hat: 1, bass: 1, stab: 1, hook: 1 },
	play: { bpm: 118, kick: 2, clap: 1, hat: 2, bass: 1, stab: 1, hook: 0 },
	final: { bpm: 138, kick: 2, clap: 1, hat: 3, bass: 1, stab: 1, hook: 2 },
	review: { bpm: 104, kick: 1, clap: 1, hat: 1, bass: 1, stab: 1, hook: 0 },
	result: { bpm: 112, kick: 2, clap: 1, hat: 2, bass: 1, stab: 1, hook: 1 },
	sprint: { bpm: 128, kick: 2, clap: 1, hat: 2, bass: 1, stab: 1, hook: 0 },
	quiet: { bpm: 96, kick: 0, clap: 0, hat: 1, bass: 1, stab: 1, hook: 0 },
};
const PROG = [
	[48, [0, 4, 7]],
	[45, [0, 3, 7]],
	[41, [0, 4, 7]],
	[43, [0, 4, 7]],
];
const HOOK = [
	[
		[0, 76],
		[3, 79],
		[6, 76],
		[8, 84],
		[10, 81],
		[12, 79],
		[14, 76],
	],
	[
		[0, 76],
		[3, 79],
		[6, 81],
		[8, 84],
		[11, 83],
		[12, 81],
	],
	[
		[0, 77],
		[3, 81],
		[6, 84],
		[8, 86],
		[10, 84],
		[12, 81],
		[14, 77],
	],
	[
		[0, 79],
		[3, 83],
		[6, 86],
		[8, 84],
		[10, 83],
		[12, 79],
		[14, 74],
	],
];
const BASS = [0, 3, 6, 8, 11, 14];

export class Sound {
	constructor(prefs) {
		this.prefs = prefs;
		this.ctx = null;
		this.scene = "lobby";
		this.layer = 0;
		this.step = 0;
		this.next = 0;
	}
	start() {
		if (!this.prefs.sound) return;
		if (!this.ctx) {
			const A = window.AudioContext || window.webkitAudioContext;
			if (!A) return;
			const ctx = new A();
			this.ctx = ctx;
			this.music = ctx.createGain();
			this.sfx = ctx.createGain();
			const limit = ctx.createDynamicsCompressor();
			limit.threshold.value = -9;
			limit.knee.value = 3;
			limit.ratio.value = 14;
			limit.attack.value = 0.002;
			limit.release.value = 0.14;
			this.out = ctx.createGain();
			this.out.gain.value = 1.7;
			this.music.connect(limit);
			this.sfx.connect(limit);
			limit.connect(this.out).connect(ctx.destination);
			this.setLevels();
			const len = ctx.sampleRate;
			this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
			const d = this.noiseBuf.getChannelData(0);
			for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
			this.next = ctx.currentTime + 0.05;
		}
		this.ctx.resume().catch(() => {});
	}
	setLevels() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.music.gain.setTargetAtTime(this.prefs.music, t, 0.05);
		this.sfx.gain.setTargetAtTime(this.prefs.sfx, t, 0.05);
	}
	setOn(on) {
		this.prefs.sound = on;
		if (on) this.start();
		else this.ctx?.suspend().catch(() => {});
	}
	get ok() {
		return this.prefs.sound && this.ctx && this.ctx.state === "running";
	}
	get now() {
		return this.ctx?.currentTime || 0;
	}
	bus(name) {
		return name === "music" ? this.music : this.sfx;
	}
	tone(
		f,
		dur,
		gain,
		{
			t = 0,
			type = "sine",
			bus = "sfx",
			glide = 0,
			cut = 8000,
			detune = 0,
		} = {},
	) {
		if (!this.ok) return;
		const ctx = this.ctx;
		const at = t || ctx.currentTime;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		const flt = ctx.createBiquadFilter();
		o.type = type;
		o.detune.value = detune;
		o.frequency.setValueAtTime(f, at);
		if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur * 0.7);
		flt.type = "lowpass";
		flt.frequency.value = cut;
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		o.connect(flt).connect(g).connect(this.bus(bus));
		o.start(at);
		o.stop(at + dur + 0.03);
	}
	noise(
		dur,
		gain,
		{ t = 0, type = "highpass", f = 6000, to = 0, q = 0.8, bus = "sfx" } = {},
	) {
		if (!this.ok) return;
		const ctx = this.ctx;
		const at = t || ctx.currentTime;
		const src = ctx.createBufferSource();
		const flt = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = this.noiseBuf;
		flt.type = type;
		flt.frequency.setValueAtTime(f, at);
		if (to) flt.frequency.exponentialRampToValueAtTime(to, at + dur);
		flt.Q.value = q;
		g.gain.setValueAtTime(gain, at);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		src.connect(flt).connect(g).connect(this.bus(bus));
		src.start(at, Math.random() * 0.5);
		src.stop(at + dur + 0.02);
	}
	pluck(m, dur, gain, t = 0, bus = "sfx") {
		for (const d of [-8, 8])
			this.tone(hz(m), dur, gain, {
				t,
				type: "square",
				bus,
				cut: 3200,
				detune: d,
			});
		this.tone(hz(m + 12), dur * 0.5, gain * 0.35, { t, type: "triangle", bus });
	}
	kick(t, g = 1) {
		this.tone(160, 0.36, g, { t, glide: 46, bus: "music" });
		this.tone(55, 0.3, g * 0.5, { t, bus: "music" });
		this.noise(0.014, g * 0.35, { t, f: 2500, bus: "music" });
	}
	clap(t, g = 0.3) {
		for (const d of [0, 0.012, 0.024])
			this.noise(d === 0.024 ? 0.16 : 0.02, g, {
				t: t + d,
				type: "bandpass",
				f: 1700,
				q: 0.9,
				bus: "music",
			});
	}
	schedule() {
		if (!this.ok) return;
		const sc = SCENES[this.scene];
		const sixteenth = 60 / sc.bpm / 4;
		const ctx = this.ctx;
		if (this.next < ctx.currentTime - 0.25) this.next = ctx.currentTime + 0.02;
		while (this.next < ctx.currentTime + 0.12) {
			const t = this.next;
			const s = this.step % 16;
			const bar = Math.floor(this.step / 16) % 4;
			const [root, chord] = PROG[bar];
			const L = this.layer;
			if (sc.kick === 2 && s % 4 === 0) this.kick(t, 0.95);
			if (sc.kick === 1 && s % 8 === 0) this.kick(t, 0.8);
			if (sc.clap && (s === 4 || s === 12)) this.clap(t);
			if (sc.hat >= 2 || s % 2 === 0)
				this.noise(0.028, s % 4 === 2 ? 0.16 : 0.07, {
					t,
					f: 8500,
					bus: "music",
				});
			if (sc.hat >= 3 && s % 4 === 2)
				this.noise(0.16, 0.08, { t, f: 7000, bus: "music" });
			if (sc.bass && BASS.includes(s))
				this.tone(hz(root - 12 + (s === 14 ? 12 : 0)), sixteenth * 1.6, 0.34, {
					t,
					type: "sawtooth",
					bus: "music",
					cut: 520,
				});
			if (sc.stab && s % 4 === 2 && (L >= 1 || this.scene !== "play"))
				for (const c of chord)
					this.tone(hz(root + 24 + c), 0.11, 0.035, {
						t,
						type: "square",
						bus: "music",
						cut: 2200,
					});
			const hook = sc.hook || (L >= 2 ? 1 : 0);
			if (hook)
				for (const [st, m] of HOOK[bar])
					if (st === s)
						this.pluck(
							m + (hook === 2 ? 12 : 0) - 12,
							sixteenth * 2.2,
							0.045,
							t,
							"music",
						);
			if (L >= 3 && s % 2 === 1)
				this.tone(hz(root + 36 + chord[(s >> 1) % 3]), 0.06, 0.025, {
					t,
					type: "triangle",
					bus: "music",
				});
			if (this.scene === "final" && s % 4 === 0)
				this.tone(s % 8 ? 1250 : 1650, 0.05, 0.12, {
					t,
					type: "triangle",
					bus: "music",
				});
			this.step++;
			this.next += sixteenth;
		}
	}
	key(n) {
		const penta = [0, 2, 4, 7, 9];
		this.pluck(
			72 + penta[n % 5] + 12 * Math.min(2, Math.floor(n / 5)),
			0.12,
			0.06,
		);
		this.noise(0.02, 0.06, { f: 7000 });
	}
	poof() {
		this.noise(0.08, 0.08, { type: "bandpass", f: 2500, to: 600 });
	}
	thud() {
		this.tone(140, 0.09, 0.22, { glide: 70 });
	}
	word(k) {
		const t = this.now;
		[0, 4, 7, 12].forEach((c, i) =>
			this.pluck(72 + k * 2 + c, 0.18, 0.06, t + i * 0.045),
		);
		this.tone(90, 0.16, 0.5, { t, glide: 45 });
	}
	clear() {
		const t = this.now;
		[0, 4, 7, 12, 16, 19, 24, 28].forEach((c, i) =>
			this.pluck(67 + c, 0.3, 0.06, t + i * 0.04),
		);
		this.noise(0.7, 0.22, { t, type: "bandpass", f: 400, to: 7000 });
		this.tone(70, 0.55, 0.8, { t, glide: 35 });
	}
	slot(i) {
		this.tone(900 + i * 40, 0.03, 0.12, { type: "square", cut: 3000 });
	}
	land() {
		this.tone(120, 0.4, 0.9, { glide: 38 });
		this.noise(0.25, 0.2, { type: "lowpass", f: 900 });
		[0, 4, 7].forEach((c) => this.pluck(60 + c, 0.5, 0.05));
	}
	slam() {
		this.noise(0.35, 0.45, { type: "bandpass", f: 500, q: 0.6 });
		this.tone(80, 0.5, 0.9, { glide: 32 });
	}
	flip() {
		this.noise(0.05, 0.16, { type: "bandpass", f: 3200, q: 1.5 });
	}
	stamp(pts) {
		this.tone(110, 0.12, 0.6, { glide: 50 });
		this.noise(0.06, 0.14, { type: "lowpass", f: 1200 });
		if (!pts) return;
		const base = pts >= 20 ? 79 : pts >= 10 ? 74 : 69;
		this.pluck(base, 0.22, 0.06);
		if (pts >= 20) this.pluck(base + 7, 0.3, 0.05, this.now + 0.06);
	}
	clack() {
		const t = this.now;
		this.noise(0.03, 0.26, { t, type: "bandpass", f: 2200, q: 3 });
		this.noise(0.03, 0.2, { t: t + 0.07, type: "bandpass", f: 2600, q: 3 });
	}
	crunch() {
		this.noise(0.35, 0.32, { type: "lowpass", f: 2500, to: 200 });
		this.tone(200, 0.3, 0.28, { type: "sawtooth", glide: 60, cut: 900 });
	}
	whoosh() {
		this.noise(0.45, 0.22, { type: "bandpass", f: 300, to: 4000, q: 1.2 });
	}
	ignite() {
		this.noise(0.5, 0.25, { type: "bandpass", f: 600, to: 3000, q: 0.7 });
		this.tone(220, 0.25, 0.2, { type: "triangle", glide: 660 });
	}
	fizzle() {
		this.noise(0.5, 0.18, { type: "highpass", f: 3000, to: 9000 });
		this.tone(500, 0.35, 0.12, { type: "triangle", glide: 160 });
	}
	pop() {
		this.tone(420, 0.12, 0.24, { glide: 900 });
	}
	tap() {
		this.tone(700, 0.05, 0.12, { type: "triangle", glide: 900 });
	}
	tick() {
		this.tone(1500, 0.03, 0.14, { type: "triangle" });
	}
	combo(n) {
		const t = this.now;
		[0, 7, 12].forEach((c, i) =>
			this.pluck(72 + n * 2 + c, 0.16, 0.06, t + i * 0.05),
		);
	}
	fanfare() {
		const t = this.now;
		[
			[60, 64, 67],
			[65, 69, 72],
			[67, 71, 74],
			[72, 76, 79, 84],
		].forEach((ch, i) =>
			ch.forEach((m) =>
				this.pluck(m, i === 3 ? 0.9 : 0.2, 0.045, t + i * 0.16),
			),
		);
		this.noise(1.2, 0.1, { t: t + 0.48, type: "highpass", f: 5000 });
		this.tone(70, 0.6, 0.8, { t: t + 0.48, glide: 35 });
	}
	note(m, g = 0.05) {
		this.tone(hz(m), 0.08, g, { type: "triangle" });
	}
}
