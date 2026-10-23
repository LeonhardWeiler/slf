const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const reduced = () => document.body.classList.contains("reduced");

export const fx = {
	canvas: document.getElementById("fx"),
	parts: [],
	colors: ["#ffc800"],
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
			const a = Math.random() * Math.PI * 2;
			const v = rand(0.35, 1) * speed;
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
				shape: pick(["sq", "sq", "dot", "star"]),
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
				s: rand(7, 13),
				r: rand(0, 6),
				vr: rand(-0.2, 0.2),
				c: pick(this.colors),
				life: 2.6,
				shape: pick(["sq", "ribbon", "dot"]),
				flutter: true,
			});
	},
	at(el, opts) {
		if (!el) return;
		const r = el.getBoundingClientRect();
		this.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
	},
	draw() {
		const ctx = this.ctx;
		ctx.clearRect(0, 0, innerWidth, innerHeight);
		this.parts = this.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
		for (const p of this.parts) {
			p.vy += p.flutter ? 0.04 : 0.32;
			p.vx *= p.flutter ? 0.995 : 0.985;
			if (p.flutter) p.vx += Math.sin(p.y / 30 + p.r) * 0.08;
			p.x += p.vx;
			p.y += p.vy;
			p.r += p.vr;
			p.life -= 0.016;
			const s = p.s;
			ctx.save();
			ctx.globalAlpha = Math.min(1, p.life * 2);
			ctx.translate(p.x, p.y);
			ctx.rotate(p.r);
			ctx.fillStyle = p.c;
			ctx.beginPath();
			if (p.shape === "dot") ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
			else if (p.shape === "ribbon")
				ctx.roundRect(-s / 2, -s / 6, s, s / 3, s / 6);
			else if (p.shape === "star")
				for (let k = 0; k < 10; k++) {
					const rr = k % 2 ? s * 0.22 : s * 0.55;
					const a = (k * Math.PI) / 5;
					ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
				}
			else ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.28);
			ctx.fill();
			if (p.shape === "sq") {
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
			}
			ctx.restore();
		}
	},
};
fx.resize();
addEventListener("resize", () => fx.resize());
