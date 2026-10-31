import type { World } from "./feel";
import { prefs } from "./prefs";

export type Scene =
	| "lobby"
	| "play"
	| "final"
	| "review"
	| "result"
	| "sprint"
	| "quiet";

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const pent = (n: number) => {
	const i = Math.min(n, 12);
	return 72 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5);
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// The music has no beat: a scene sets the mean gap between notes in seconds,
// their register and the brightness of the music bus.
const SCENES: Record<Scene, { gap: number; reg: number; cut: number }> = {
	lobby: { gap: 2.2, reg: 0, cut: 2600 },
	play: { gap: 2.6, reg: 0, cut: 2200 },
	final: { gap: 1.7, reg: 12, cut: 3600 },
	review: { gap: 3, reg: 0, cut: 1800 },
	result: { gap: 2, reg: 7, cut: 3200 },
	sprint: { gap: 2.4, reg: 0, cut: 2400 },
	quiet: { gap: 3.6, reg: -5, cut: 1400 },
};
const PROG: [number, number[]][] = [
	[48, [0, 4, 7, 11, 14]],
	[45, [0, 3, 7, 10, 14]],
	[41, [0, 4, 7, 11, 14]],
	[43, [0, 4, 7, 9, 14]],
];

type Bus = "music" | "sfx";
interface ToneOpts {
	t?: number;
	type?: OscillatorType;
	bus?: Bus;
	glide?: number;
	cut?: number;
	attack?: number;
	detune?: number;
}
interface NoiseOpts {
	t?: number;
	type?: BiquadFilterType;
	f?: number;
	to?: number;
	q?: number;
	attack?: number;
	bus?: Bus;
}

class Sound {
	scene: Scene = "lobby";
	timbre: World = "candy";
	layer = 0;
	private ctx: AudioContext | null = null;
	private music!: GainNode;
	private tint!: BiquadFilterNode;
	private section!: GainNode;
	private sfx!: GainNode;
	private noiseBuf!: AudioBuffer;
	private hushed = false;
	private next = 0;
	private chord = 0;
	private chordEnd = 0;
	private lowAt = 0;
	private loop = 0;

	start() {
		if (!prefs.get().sound) return;
		if (!this.ctx) {
			const A =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!A) return;
			const ctx = new A();
			this.ctx = ctx;
			this.music = ctx.createGain();
			this.section = ctx.createGain();
			this.section.connect(this.music);
			this.sfx = ctx.createGain();
			const limit = ctx.createDynamicsCompressor();
			limit.threshold.value = -6;
			limit.knee.value = 6;
			limit.ratio.value = 6;
			limit.attack.value = 0.002;
			limit.release.value = 0.14;
			const out = ctx.createGain();
			out.gain.value = 1.3;
			this.tint = ctx.createBiquadFilter();
			this.tint.frequency.value = SCENES[this.scene].cut;
			const len = ctx.sampleRate * 3;
			const ir = ctx.createBuffer(2, len, ctx.sampleRate);
			for (let c = 0; c < 2; c++) {
				const d = ir.getChannelData(c);
				for (let i = 0; i < len; i++)
					d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
			}
			const room = ctx.createConvolver();
			room.buffer = ir;
			const wet = ctx.createGain();
			wet.gain.value = 0.6;
			this.music.connect(this.tint).connect(limit);
			this.tint.connect(room).connect(wet).connect(limit);
			this.sfx.connect(limit);
			limit.connect(out).connect(ctx.destination);
			this.levels();
			this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
			const d = this.noiseBuf.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
			this.next = ctx.currentTime + 0.05;
		}
		void this.ctx.resume().catch(() => {});
		if (!this.loop) this.loop = window.setInterval(() => this.schedule(), 100);
	}

	levels() {
		if (!this.ctx) return;
		const { music, sfx } = prefs.get();
		const t = this.ctx.currentTime;
		this.music.gain.setTargetAtTime(this.hushed ? 0 : music, t, 0.15);
		this.sfx.gain.setTargetAtTime(sfx, t, 0.05);
	}

	// hush silences the music while a menu or dialog is open.
	hush(on: boolean) {
		this.hushed = on;
		this.levels();
	}

	// setScene lets the old scene ring out and starts the new one after a breath.
	setScene(s: Scene) {
		this.layer = 0;
		if (s === this.scene) return;
		this.scene = s;
		const ctx = this.ctx;
		if (!ctx) return;
		const t = ctx.currentTime;
		this.section.gain.setTargetAtTime(0, t, 0.4);
		const old = this.section;
		setTimeout(() => old.disconnect(), 4000);
		this.section = ctx.createGain();
		this.section.connect(this.music);
		this.tint.frequency.setTargetAtTime(SCENES[s].cut, t, 0.5);
		this.next = t + 0.6;
	}

	// duck lowers the music under a big moment and lets it swell back.
	private duck(sec = 1.5) {
		const t = this.now;
		const g = this.section?.gain;
		if (!g) return;
		g.cancelScheduledValues(t);
		g.setTargetAtTime(0.25, t, 0.03);
		g.setTargetAtTime(1, t + sec, 0.6);
	}

	pause() {
		void this.ctx?.suspend().catch(() => {});
	}

	setOn(on: boolean) {
		prefs.set({ sound: on });
		if (on) this.start();
		else this.pause();
	}

	private get ok() {
		return prefs.get().sound && this.ctx?.state === "running";
	}
	private get now() {
		return this.ctx?.currentTime ?? 0;
	}

	private tone(f: number, dur: number, gain: number, o: ToneOpts = {}) {
		const ctx = this.ctx;
		if (!ctx || !this.ok) return;
		const at = o.t || ctx.currentTime;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		const flt = ctx.createBiquadFilter();
		osc.type = o.type ?? "sine";
		osc.detune.value = o.detune ?? 0;
		osc.frequency.setValueAtTime(f, at);
		if (o.glide)
			osc.frequency.exponentialRampToValueAtTime(o.glide, at + dur * 0.7);
		flt.type = "lowpass";
		flt.frequency.value = o.cut ?? 8000;
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(
			Math.max(0.0002, gain),
			at + (o.attack ?? 0.004),
		);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		osc
			.connect(flt)
			.connect(g)
			.connect(o.bus === "music" ? this.section : this.sfx);
		osc.start(at);
		osc.stop(at + dur + 0.03);
	}

	private noise(dur: number, gain: number, o: NoiseOpts = {}) {
		const ctx = this.ctx;
		if (!ctx || !this.ok) return;
		const at = o.t || ctx.currentTime;
		const src = ctx.createBufferSource();
		const flt = ctx.createBiquadFilter();
		const g = ctx.createGain();
		src.buffer = this.noiseBuf;
		flt.type = o.type ?? "highpass";
		flt.frequency.setValueAtTime(o.f ?? 6000, at);
		if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, at + dur);
		flt.Q.value = o.q ?? 0.8;
		g.gain.setValueAtTime(o.attack ? 0.0001 : gain, at);
		if (o.attack) g.gain.exponentialRampToValueAtTime(gain, at + o.attack);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		src
			.connect(flt)
			.connect(g)
			.connect(o.bus === "music" ? this.section : this.sfx);
		src.start(at, Math.random() * 0.5);
		src.stop(at + dur + 0.02);
	}

	// pluck is the melodic voice; its timbre follows the world of the round.
	private pluck(m: number, dur: number, gain: number, t = 0, bus: Bus = "sfx") {
		const f = hz(m);
		switch (this.timbre) {
			case "rubber":
				this.tone(f * 0.94, dur * 1.1, gain * 1.5, {
					t,
					type: "triangle",
					glide: f,
					bus,
				});
				this.tone(f * 2, dur * 0.4, gain * 0.3, { t, type: "sine", bus });
				return;
			case "fluffy":
				this.tone(f, dur * 1.4, gain * 1.4, { t, type: "sine", bus, cut: 900 });
				return;
			case "glass":
				this.tone(f, dur, gain * 1.2, { t, type: "sine", bus });
				this.tone(f * 4.2, dur * 0.3, gain * 0.25, { t, type: "sine", bus });
				return;
			default:
				for (const d of [-8, 8])
					this.tone(f, dur, gain, {
						t,
						type: "square",
						bus,
						cut: 3200,
						detune: d,
					});
				this.tone(f * 2, dur * 0.5, gain * 0.35, { t, type: "triangle", bus });
		}
	}

	// bell is the casino voice: a sine with a quiet inharmonic partial.
	private bell(m: number, dur: number, gain: number, t = 0, bus: Bus = "sfx") {
		const f = hz(m);
		this.tone(f, dur, gain, { t, bus, attack: bus === "music" ? 0.03 : 0.004 });
		this.tone(f * 2.76, dur * 0.35, gain * 0.25, { t, bus });
	}

	// schedule drops one note at a time: a chord tone that rings for seconds,
	// every half minute a low root as a resting point, now and then a pause.
	// Each answer locked in the round (layer) thickens it a little.
	private schedule() {
		const ctx = this.ctx;
		if (!ctx || !this.ok) return;
		const now = ctx.currentTime;
		if (this.next < now - 1) this.next = now + 0.2;
		if (this.next > now + 0.3) return;
		const t = this.next;
		const sc = SCENES[this.scene];
		if (t >= this.chordEnd) {
			this.chord = (this.chord + 1) % PROG.length;
			this.chordEnd = t + rand(8, 15);
		}
		const [root, tones] = PROG[this.chord];
		if (t >= this.lowAt) {
			this.lowAt = t + rand(26, 34);
			this.bell(root + 12, 4, 0.06, t, "music");
		} else {
			const m = root + 24 + sc.reg + tones[Math.floor(rand(0, tones.length))];
			this.bell(m, rand(2, 4), 0.022, t, "music");
			if (this.layer >= 3 && Math.random() < 0.4)
				this.bell(m + 12, 2, 0.008, t + rand(0.2, 0.6), "music");
		}
		this.next =
			t +
			(sc.gap / (1 + this.layer * 0.12)) * rand(0.7, 1.35) +
			(Math.random() < 0.12 ? rand(2, 4) : 0);
	}

	key(n: number) {
		const penta = [0, 2, 4, 7, 9];
		this.pluck(
			72 + penta[n % 5] + 12 * Math.min(2, Math.floor(n / 5)),
			0.1,
			0.035,
		);
	}
	poof() {
		this.noise(0.08, 0.05, { type: "bandpass", f: 2500, to: 600 });
	}
	thud() {
		this.tone(140, 0.09, 0.16, { glide: 70 });
	}
	word(k: number, rare = false) {
		const t = this.now;
		for (const [i, d] of (rare ? [0, 2, 4, 5, 7, 9] : [0, 2, 3, 5]).entries())
			this.bell(pent(5 + Math.min(k, 6) + d), 0.35, 0.09, t + i * 0.05);
		this.tone(90, 0.16, 0.25, { t, glide: 45 });
	}
	clear() {
		this.duck();
		const t = this.now;
		for (const [i, c] of [0, 4, 7, 12, 16, 19, 24, 28].entries())
			this.bell(79 + c, 0.5, 0.11, t + i * 0.045);
		this.noise(0.7, 0.14, { t, type: "bandpass", f: 400, to: 7000 });
		this.tone(70, 0.55, 0.5, { t, glide: 35 });
	}
	slot(i: number) {
		this.noise(0.02, 0.06, { type: "bandpass", f: 2600 + i * 60, q: 3 });
	}
	land() {
		this.duck();
		this.tone(120, 0.4, 0.5, { glide: 38 });
		this.noise(0.25, 0.12, { type: "lowpass", f: 900 });
		for (const c of [0, 4, 7]) this.bell(72 + c, 0.8, 0.07);
	}
	slam() {
		this.duck();
		this.noise(0.35, 0.3, { type: "bandpass", f: 500, q: 0.6 });
		this.tone(80, 0.5, 0.6, { glide: 32 });
	}
	flip() {
		this.noise(0.05, 0.08, { type: "bandpass", f: 3200, q: 1.5 });
	}
	stamp(pts: number) {
		this.tone(110, 0.12, 0.35, { glide: 50 });
		this.noise(0.06, 0.1, { type: "lowpass", f: 1200 });
		if (!pts) return;
		const base = pts >= 20 ? 91 : pts >= 10 ? 86 : 81;
		this.bell(base, 0.4, 0.08);
		if (pts >= 20) this.bell(base + 7, 0.5, 0.07, this.now + 0.07);
	}
	crunch() {
		this.noise(0.35, 0.2, { type: "lowpass", f: 2500, to: 200 });
		this.tone(200, 0.3, 0.16, { type: "sawtooth", glide: 60, cut: 900 });
	}
	whoosh() {
		this.noise(0.45, 0.12, { type: "bandpass", f: 300, to: 4000, q: 1.2 });
	}
	ignite() {
		this.noise(0.5, 0.14, { type: "bandpass", f: 600, to: 3000, q: 0.7 });
		this.tone(220, 0.25, 0.12, { type: "triangle", glide: 660 });
	}
	pop() {
		this.tone(420, 0.1, 0.12, { glide: 900 });
	}
	tap() {
		this.noise(0.018, 0.08, { type: "bandpass", f: 2200, q: 2 });
		this.tone(1500, 0.03, 0.04, { type: "triangle" });
	}
	nope() {
		this.tone(220, 0.14, 0.12, { type: "square", glide: 150, cut: 900 });
	}
	beep(n: number) {
		this.tone([1175, 988, 880][n - 1], 0.14, 0.12, {
			type: "square",
			cut: 2600,
		});
		if (n === 3)
			this.noise(3, 0.07, {
				type: "bandpass",
				f: 250,
				to: 5000,
				q: 1.2,
				attack: 2.9,
			});
	}
	boom() {
		this.duck();
		this.tone(90, 0.8, 0.6, { glide: 30 });
		this.noise(0.9, 0.3, { type: "highpass", f: 3000, to: 900 });
		this.noise(0.4, 0.25, { type: "lowpass", f: 700 });
	}
	count(p: number) {
		this.noise(0.015, 0.05, { type: "bandpass", f: 2400 + p * 2400, q: 5 });
		this.tone(700 + p * 900, 0.025, 0.03, { type: "square", cut: 2500 });
	}
	tick(n = 0) {
		this.tone(1400 + n * 24, 0.025, 0.06, { type: "triangle" });
	}
	coin(i: number) {
		const m = pent(5 + i);
		this.bell(m, 0.3, 0.09);
		this.bell(m + 12, 0.2, 0.04, this.now + 0.04);
	}
	combo(n: number) {
		const t = this.now;
		for (const [i, d] of [0, 3, 5, 7].entries())
			this.bell(pent(5 + n + d), 0.3, 0.1, t + i * 0.05);
	}
	fanfare() {
		this.duck();
		const t = this.now;
		[
			[60, 64, 67],
			[65, 69, 72],
			[67, 71, 74],
			[72, 76, 79, 84],
		].forEach((ch, i) => {
			for (const m of ch)
				this.pluck(m, i === 3 ? 0.9 : 0.2, 0.04, t + i * 0.16);
		});
		for (let i = 0; i < 12; i++)
			this.bell(
				88 + [0, 4, 7, 12][i % 4] + 12 * Math.floor(i / 8),
				0.4,
				0.07,
				t + 0.48 + i * 0.06,
			);
		this.noise(1.2, 0.08, { t: t + 0.48, type: "highpass", f: 5000 });
		this.tone(70, 0.6, 0.5, { t: t + 0.48, glide: 35 });
	}
	ready(on: boolean) {
		const t = this.now;
		const [a, b] = on ? [79, 86] : [86, 79];
		this.bell(a, 0.18, 0.08, t);
		this.bell(b, on ? 0.35 : 0.2, 0.08, t + 0.07);
		if (on) this.tone(120, 0.1, 0.25, { t, glide: 60 });
	}
	advance() {
		const t = this.now;
		this.noise(0.3, 0.07, { t, type: "bandpass", f: 900, to: 3500, q: 1.5 });
		for (const [i, m] of [67, 72, 76].entries())
			this.pluck(m, 0.16, 0.035, t + 0.08 + i * 0.06);
	}
	crown() {
		this.duck();
		const t = this.now;
		for (const [i, c] of [0, 4, 7, 12, 16, 19, 24].entries())
			this.bell(72 + c, 0.6, 0.06, t + i * 0.035);
		for (const c of [0, 4, 7, 11])
			for (const d of [-6, 6])
				this.tone(hz(60 + c), 1.6, 0.03, {
					t: t + 0.25,
					type: "triangle",
					cut: 2400,
					detune: d,
					attack: 0.06,
				});
		this.bell(96, 1.4, 0.05, t + 0.3);
		this.noise(1.4, 0.04, {
			t: t + 0.25,
			type: "highpass",
			f: 7000,
			attack: 0.1,
		});
		this.tone(80, 0.5, 0.35, { t: t + 0.25, glide: 40 });
	}
	note(m: number, g = 0.05) {
		this.tone(hz(m), 0.08, g, { type: "triangle" });
	}
}

export const sound = new Sound();
