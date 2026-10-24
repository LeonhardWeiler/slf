import { prefs } from "./prefs";

export type Scene =
	| "lobby"
	| "play"
	| "final"
	| "review"
	| "result"
	| "sprint"
	| "quiet";
export type Timbre = "candy" | "rubber";

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const pent = (n: number) => {
	const i = Math.min(n, 12);
	return 72 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5);
};

const SCENES: Record<
	Scene,
	{ bpm: number; pulse: number; hat: number; bell: number }
> = {
	lobby: { bpm: 84, pulse: 0, hat: 0, bell: 1 },
	play: { bpm: 92, pulse: 1, hat: 1, bell: 0 },
	final: { bpm: 104, pulse: 2, hat: 2, bell: 1 },
	review: { bpm: 80, pulse: 0, hat: 0, bell: 0 },
	result: { bpm: 88, pulse: 1, hat: 0, bell: 1 },
	sprint: { bpm: 96, pulse: 1, hat: 1, bell: 0 },
	quiet: { bpm: 72, pulse: 0, hat: 0, bell: 0 },
};
const PROG: [number, number[]][] = [
	[48, [0, 4, 7, 11]],
	[45, [0, 3, 7, 10]],
	[41, [0, 4, 7, 11]],
	[43, [0, 4, 7, 9]],
];
const BELLS = [
	[0, 7, 12, 16],
	[0, 3, 7, 15],
	[0, 4, 11, 16],
	[0, 7, 9, 14],
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
	timbre: Timbre = "candy";
	layer = 0;
	private ctx: AudioContext | null = null;
	private music!: GainNode;
	private section!: GainNode;
	private sfx!: GainNode;
	private noiseBuf!: AudioBuffer;
	private step = 0;
	private next = 0;
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
			this.music.connect(limit);
			this.sfx.connect(limit);
			limit.connect(out).connect(ctx.destination);
			this.levels();
			this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
			const d = this.noiseBuf.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
			this.next = ctx.currentTime + 0.05;
		}
		void this.ctx.resume().catch(() => {});
		if (!this.loop) this.loop = window.setInterval(() => this.schedule(), 25);
	}

	levels() {
		if (!this.ctx) return;
		const { music, sfx } = prefs.get();
		const t = this.ctx.currentTime;
		this.music.gain.setTargetAtTime(music, t, 0.05);
		this.sfx.gain.setTargetAtTime(sfx, t, 0.05);
	}

	// setScene fades out what the old scene still has ringing and starts the
	// new one on a fresh bar, so two grooves never overlap.
	setScene(s: Scene) {
		this.layer = 0;
		if (s === this.scene) return;
		this.scene = s;
		const ctx = this.ctx;
		if (!ctx) return;
		const t = ctx.currentTime;
		this.section.gain.setTargetAtTime(0, t, 0.12);
		const old = this.section;
		setTimeout(() => old.disconnect(), 3000);
		this.section = ctx.createGain();
		this.section.connect(this.music);
		this.step = 0;
		this.next = t + 0.3;
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
		this.tone(f, dur, gain, { t, bus });
		this.tone(f * 2.76, dur * 0.35, gain * 0.25, { t, bus });
	}

	private schedule() {
		const ctx = this.ctx;
		if (!ctx || !this.ok) return;
		const sc = SCENES[this.scene];
		const sixteenth = 60 / sc.bpm / 4;
		const barLen = sixteenth * 16;
		if (this.next < ctx.currentTime - 0.25) this.next = ctx.currentTime + 0.02;
		while (this.next < ctx.currentTime + 0.12) {
			const t = this.next;
			const s = this.step % 16;
			const bar = Math.floor(this.step / 16) % 4;
			const [root, chord] = PROG[bar];
			const L = this.layer;
			if (s === 0) {
				for (const c of chord)
					for (const d of [-7, 7])
						this.tone(hz(root + 12 + c), barLen, 0.022, {
							t,
							type: "triangle",
							bus: "music",
							cut: 1100,
							detune: d,
							attack: barLen * 0.35,
						});
				this.tone(hz(root - 12), barLen, 0.16, {
					t,
					bus: "music",
					attack: 0.08,
				});
			}
			if (sc.pulse && s % (sc.pulse === 2 ? 4 : 8) === 0)
				this.tone(95, 0.3, 0.22, { t, glide: 50, bus: "music", attack: 0.01 });
			if (sc.hat && s % 4 === 2)
				this.noise(0.04, 0.03, { t, f: 9000, bus: "music" });
			if (sc.hat >= 2 && s % 2 === 1)
				this.noise(0.02, 0.015, { t, f: 10000, bus: "music" });
			if ((sc.bell || L >= 1) && s % 4 === 0)
				this.bell(
					root + 24 + BELLS[bar][s / 4],
					barLen * 0.4,
					0.02,
					t,
					"music",
				);
			if (L >= 2 && s % 4 === 2)
				this.bell(root + 36 + chord[(s >> 2) % 4], 0.5, 0.012, t, "music");
			if (L >= 3 && s % 2 === 1)
				this.bell(
					root + 36 + BELLS[bar][(s >> 1) % 4],
					0.25,
					0.008,
					t,
					"music",
				);
			this.step++;
			this.next += sixteenth;
		}
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
	word(k: number) {
		const t = this.now;
		for (const [i, d] of [0, 2, 3, 5].entries())
			this.bell(pent(5 + k + d), 0.35, 0.09, t + i * 0.05);
		this.tone(90, 0.16, 0.25, { t, glide: 45 });
	}
	clear() {
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
		this.tone(120, 0.4, 0.5, { glide: 38 });
		this.noise(0.25, 0.12, { type: "lowpass", f: 900 });
		for (const c of [0, 4, 7]) this.bell(72 + c, 0.8, 0.07);
	}
	slam() {
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
