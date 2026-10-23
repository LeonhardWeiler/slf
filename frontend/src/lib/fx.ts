import type { World } from "./feel";

type Shape = "sq" | "dot" | "star" | "ribbon" | "chip" | "blob" | "tri";
interface Part {
	x: number;
	y: number;
	vx: number;
	vy: number;
	s: number;
	r: number;
	vr: number;
	c: string;
	life: number;
	shape: Shape;
	flutter: boolean;
	bounce: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

const SHAPES: Record<
	World,
	{ burst: Shape[]; rain: Shape[]; gravity: number }
> = {
	candy: {
		burst: ["sq", "sq", "dot", "star"],
		rain: ["sq", "ribbon", "dot"],
		gravity: 0.32,
	},
	wood: {
		burst: ["chip", "chip", "sq"],
		rain: ["chip", "ribbon"],
		gravity: 0.42,
	},
	rubber: {
		burst: ["blob", "blob", "dot"],
		rain: ["blob", "dot"],
		gravity: 0.5,
	},
	paper: {
		burst: ["tri", "ribbon", "sq"],
		rain: ["ribbon", "tri"],
		gravity: 0.2,
	},
};

class Fx {
	colors = ["#ffc800"];
	world: World = "candy";
	calm = false;
	private parts: Part[] = [];
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private raf = 0;

	mount(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.resize();
		addEventListener("resize", this.resize);
		return () => {
			removeEventListener("resize", this.resize);
			cancelAnimationFrame(this.raf);
			this.raf = 0;
			this.canvas = null;
		};
	}

	private resize = () => {
		if (!this.canvas) return;
		const r = Math.min(devicePixelRatio || 1, 2);
		this.canvas.width = innerWidth * r;
		this.canvas.height = innerHeight * r;
		this.ctx = this.canvas.getContext("2d");
		this.ctx?.setTransform(r, 0, 0, r, 0, 0);
	};

	burst(
		x: number,
		y: number,
		{ n = 18, speed = 7, size = 9, up = 0, life = 1 } = {},
	) {
		if (this.calm) n = Math.min(n, 4);
		const shapes = SHAPES[this.world].burst;
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const v = rand(0.35, 1) * speed;
			this.add({
				x,
				y,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - up,
				s: rand(0.5, 1) * size,
				r: rand(0, 6),
				vr: rand(-0.3, 0.3),
				c: pick(this.colors),
				life,
				shape: pick(shapes),
				flutter: false,
				bounce: this.world === "rubber" ? 2 : 0,
			});
		}
	}

	at(el: Element | null, opts?: Parameters<Fx["burst"]>[2]) {
		if (!el) return;
		const r = el.getBoundingClientRect();
		this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
	}

	rain(n = 90) {
		if (this.calm) return;
		const shapes = SHAPES[this.world].rain;
		for (let i = 0; i < n; i++)
			this.add({
				x: rand(0, innerWidth),
				y: rand(-innerHeight * 0.6, -10),
				vx: rand(-1.5, 1.5),
				vy: rand(1, 4),
				s: rand(7, 13),
				r: rand(0, 6),
				vr: rand(-0.2, 0.2),
				c: pick(this.colors),
				life: 2.6,
				shape: pick(shapes),
				flutter: true,
				bounce: 0,
			});
	}

	private add(p: Part) {
		this.parts.push(p);
		if (!this.raf && this.ctx) this.raf = requestAnimationFrame(this.draw);
	}

	private draw = () => {
		const ctx = this.ctx;
		if (!ctx) return;
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		const g = SHAPES[this.world].gravity;
		this.parts = this.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
		for (const p of this.parts) {
			p.vy += p.flutter ? 0.04 : g;
			p.vx *= p.flutter ? 0.995 : 0.985;
			if (p.flutter) p.vx += Math.sin(p.y / 30 + p.r) * 0.08;
			p.x += p.vx;
			p.y += p.vy;
			if (p.bounce && p.y > innerHeight - 20 && p.vy > 0) {
				p.vy *= -0.6;
				p.bounce--;
			}
			p.r += p.vr;
			p.life -= 0.016;
			this.paint(ctx, p);
		}
		this.raf = this.parts.length ? requestAnimationFrame(this.draw) : 0;
	};

	private paint(ctx: CanvasRenderingContext2D, p: Part) {
		const s = p.s;
		ctx.save();
		ctx.globalAlpha = Math.min(1, p.life * 2);
		ctx.translate(p.x, p.y);
		ctx.rotate(p.r);
		ctx.fillStyle = p.c;
		ctx.beginPath();
		switch (p.shape) {
			case "dot":
				ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
				break;
			case "blob":
				ctx.ellipse(0, 0, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
				break;
			case "ribbon":
				ctx.roundRect(-s / 2, -s / 6, s, s / 3, s / 6);
				break;
			case "chip":
				ctx.roundRect(-s / 2, -s / 4, s, s / 2, 2);
				break;
			case "tri":
				ctx.moveTo(0, -s / 2);
				ctx.lineTo(s / 2, s / 2);
				ctx.lineTo(-s / 2, s / 3);
				break;
			case "star":
				for (let k = 0; k < 10; k++) {
					const rr = k % 2 ? s * 0.22 : s * 0.55;
					const a = (k * Math.PI) / 5;
					ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
				}
				break;
			default:
				ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.28);
		}
		ctx.fill();
		if (p.shape === "sq" || p.shape === "blob") {
			ctx.fillStyle = "rgba(255,255,255,.5)";
			ctx.beginPath();
			ctx.roundRect(
				-s / 2 + s * 0.15,
				-s / 2 + s * 0.12,
				s * 0.7,
				s * 0.22,
				s * 0.11,
			);
			ctx.fill();
		} else if (p.shape === "chip") {
			ctx.fillStyle = "rgba(0,0,0,.15)";
			ctx.fillRect(-s / 2, -1, s, 1.5);
		}
		ctx.restore();
	}
}

export const fx = new Fx();
