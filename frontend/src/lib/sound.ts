import { prefs } from "./prefs";

export type Scene =
	| "lobby"
	| "play"
	| "final"
	| "review"
	| "result"
	| "sprint"
	| "quiet";
export type Timbre = "candy" | "wood" | "rubber" | "paper";

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const SCENES: Record<
	Scene,
	{ bpm: number; kick: number; clap: number; hat: number; hook: number }
> = {
	lobby: { bpm: 108, kick: 1, clap: 0, hat: 1, hook: 1 },
	play: { bpm: 118, kick: 2, clap: 1, hat: 2, hook: 0 },
	final: { bpm: 138, kick: 2, clap: 1, hat: 3, hook: 2 },
	review: { bpm: 104, kick: 1, clap: 1, hat: 1, hook: 0 },
	result: { bpm: 112, kick: 2, clap: 1, hat: 2, hook: 1 },
	sprint: { bpm: 128, kick: 2, clap: 1, hat: 2, hook: 0 },
	quiet: { bpm: 96, kick: 0, clap: 0, hat: 1, hook: 0 },
};
const PROG: [number, number[]][] = [
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

type Bus = "music" | "sfx";
interface ToneOpts {
	t?: number;
	type?: OscillatorType;
	bus?: Bus;
	glide?: number;
	cut?: number;
	detune?: number;
}
interface NoiseOpts {
	t?: number;
	type?: BiquadFilterType;
	f?: number;
	to?: number;
	q?: number;
	bus?: Bus;
}

class Sound {
	scene: Scene = "lobby";
	timbre: Timbre = "candy";
	layer = 0;
	private ctx: AudioContext | null = null;
	private music!: GainNode;
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
			this.sfx = ctx.createGain();
			const limit = ctx.createDynamicsCompressor();
			limit.threshold.value = -9;
			limit.knee.value = 3;
			limit.ratio.value = 14;
			limit.attack.value = 0.002;
			limit.release.value = 0.14;
			const out = ctx.createGain();
			out.gain.value = 1.7;
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
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		osc
			.connect(flt)
			.connect(g)
			.connect(o.bus === "music" ? this.music : this.sfx);
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
		g.gain.setValueAtTime(gain, at);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		src
			.connect(flt)
			.connect(g)
			.connect(o.bus === "music" ? this.music : this.sfx);
		src.start(at, Math.random() * 0.5);
		src.stop(at + dur + 0.02);
	}

	// pluck is the melodic voice; its timbre follows the world of the round.
	private pluck(m: number, dur: number, gain: number, t = 0, bus: Bus = "sfx") {
		const f = hz(m);
		switch (this.timbre) {
			case "wood":
				this.tone(f, dur * 0.8, gain * 1.6, { t, bus });
				this.tone(f * 4, dur * 0.18, gain * 0.5, { t, bus });
				this.noise(0.012, gain * 0.8, {
					t,
					type: "bandpass",
					f: f * 3,
					q: 4,
					bus,
				});
				return;
			case "rubber":
				this.tone(f * 0.94, dur * 1.1, gain * 1.5, {
					t,
					type: "triangle",
					glide: f,
					bus,
				});
				this.tone(f * 2, dur * 0.4, gain * 0.3, { t, type: "sine", bus });
				return;
			case "paper":
				this.tone(f, dur * 1.3, gain * 1.2, {
					t,
					type: "triangle",
					cut: 1800,
					bus,
				});
				this.noise(0.04, gain * 0.7, {
					t,
					type: "bandpass",
					f: 2400,
					q: 1.2,
					bus,
				});
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

	private kick(t: number, g = 1) {
		this.tone(160, 0.36, g, { t, glide: 46, bus: "music" });
		this.tone(55, 0.3, g * 0.5, { t, bus: "music" });
		this.noise(0.014, g * 0.35, { t, f: 2500, bus: "music" });
	}

	private hat(t: number, loud: boolean) {
		if (this.timbre === "wood")
			this.noise(0.03, loud ? 0.22 : 0.1, {
				t,
				type: "bandpass",
				f: 1900,
				q: 6,
				bus: "music",
			});
		else if (this.timbre === "paper")
			this.noise(0.06, loud ? 0.12 : 0.05, {
				t,
				type: "bandpass",
				f: 5000,
				q: 0.5,
				bus: "music",
			});
		else this.noise(0.028, loud ? 0.16 : 0.07, { t, f: 8500, bus: "music" });
	}

	private clap(t: number, g = 0.3) {
		for (const d of [0, 0.012, 0.024])
			this.noise(d === 0.024 ? 0.16 : 0.02, g, {
				t: t + d,
				type: "bandpass",
				f: this.timbre === "rubber" ? 1100 : 1700,
				q: 0.9,
				bus: "music",
			});
	}

	private schedule() {
		const ctx = this.ctx;
		if (!ctx || !this.ok) return;
		const sc = SCENES[this.scene];
		const sixteenth = 60 / sc.bpm / 4;
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
			if (sc.hat >= 2 || s % 2 === 0) this.hat(t, s % 4 === 2);
			if (sc.hat >= 3 && s % 4 === 2)
				this.noise(0.16, 0.08, { t, f: 7000, bus: "music" });
			if (BASS.includes(s))
				this.tone(hz(root - 12 + (s === 14 ? 12 : 0)), sixteenth * 1.6, 0.34, {
					t,
					type: this.timbre === "rubber" ? "square" : "sawtooth",
					bus: "music",
					cut: this.timbre === "rubber" ? 380 : 520,
					glide: this.timbre === "rubber" ? hz(root - 13) : 0,
				});
			if (s % 4 === 2 && (L >= 1 || this.scene !== "play"))
				for (const c of chord)
					this.tone(hz(root + 24 + c), 0.11, 0.035, {
						t,
						type: this.timbre === "wood" ? "sine" : "square",
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

	key(n: number) {
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
	word(k: number) {
		const t = this.now;
		for (const [i, c] of [0, 4, 7, 12].entries())
			this.pluck(72 + k * 2 + c, 0.18, 0.06, t + i * 0.045);
		this.tone(90, 0.16, 0.5, { t, glide: 45 });
	}
	clear() {
		const t = this.now;
		for (const [i, c] of [0, 4, 7, 12, 16, 19, 24, 28].entries())
			this.pluck(67 + c, 0.3, 0.06, t + i * 0.04);
		this.noise(0.7, 0.22, { t, type: "bandpass", f: 400, to: 7000 });
		this.tone(70, 0.55, 0.8, { t, glide: 35 });
	}
	slot(i: number) {
		this.tone(900 + i * 40, 0.03, 0.12, { type: "square", cut: 3000 });
	}
	land() {
		this.tone(120, 0.4, 0.9, { glide: 38 });
		this.noise(0.25, 0.2, { type: "lowpass", f: 900 });
		for (const c of [0, 4, 7]) this.pluck(60 + c, 0.5, 0.05);
	}
	slam() {
		this.noise(0.35, 0.45, { type: "bandpass", f: 500, q: 0.6 });
		this.tone(80, 0.5, 0.9, { glide: 32 });
	}
	flip() {
		this.noise(0.05, 0.16, { type: "bandpass", f: 3200, q: 1.5 });
	}
	stamp(pts: number) {
		this.tone(110, 0.12, 0.6, { glide: 50 });
		this.noise(0.06, 0.14, { type: "lowpass", f: 1200 });
		if (!pts) return;
		const base = pts >= 20 ? 79 : pts >= 10 ? 74 : 69;
		this.pluck(base, 0.22, 0.06);
		if (pts >= 20) this.pluck(base + 7, 0.3, 0.05, this.now + 0.06);
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
	nope() {
		this.tone(220, 0.14, 0.2, { type: "square", glide: 150, cut: 900 });
	}
	tick(n = 0) {
		this.tone(1200 + n * 18, 0.03, 0.14, { type: "triangle" });
	}
	combo(n: number) {
		const t = this.now;
		for (const [i, c] of [0, 7, 12].entries())
			this.pluck(72 + n * 2 + c, 0.16, 0.06, t + i * 0.05);
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
				this.pluck(m, i === 3 ? 0.9 : 0.2, 0.045, t + i * 0.16);
		});
		this.noise(1.2, 0.1, { t: t + 0.48, type: "highpass", f: 5000 });
		this.tone(70, 0.6, 0.8, { t: t + 0.48, glide: 35 });
	}
	note(m: number, g = 0.05) {
		this.tone(hz(m), 0.08, g, { type: "triangle" });
	}
}

export const sound = new Sound();
