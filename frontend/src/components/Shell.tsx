import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	Hand,
	Settings,
	Volume2,
	VolumeX,
	Waves,
	Music,
	Zap,
} from "lucide-react";
import { fx } from "@/lib/fx";
import { haptic, setWorld, shake, shiftPalette, worldFor } from "@/lib/feel";
import { prefs, usePrefs } from "@/lib/prefs";
import { sound, type Scene } from "@/lib/sound";
import { useRoomStore } from "@/store/room";
import type { GameState } from "@/types/events";
import { Btn, IconBtn, Slider, Toggle } from "@/components/kit";
import { Modal } from "@/components/Modal";

const VOLUME = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const SCENES: Record<GameState, Scene> = {
	Lobby: "lobby",
	Countdown: "play",
	Playing: "play",
	Reviewing: "review",
	RoundResult: "result",
	GameOver: "final",
};

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const band = (d: number) => 8 * Math.tanh(d / 40);
const GRAB =
	"button, [role=switch], .card, .ans, .rank, .seat, .fourth, .av, .tile, .pts, .code span";

// lookAt reads every mascot rect before it writes, so one frame lays out once.
function lookAt(x: number, y: number) {
	const ms = [...document.querySelectorAll<HTMLElement>(".mascot")];
	const rs = ms.map((m) => m.getBoundingClientRect());
	for (const [i, m] of ms.entries()) {
		const r = rs[i];
		const dx = x - (r.left + r.width / 2);
		const dy = y - (r.top + r.height * 0.3);
		const d = Math.max(1, Math.hypot(dx, dy));
		const k = Math.min(1, d / 160);
		m.style.setProperty("--lx", ((dx / d) * k).toFixed(3));
		m.style.setProperty("--ly", ((dy / d) * k).toFixed(3));
	}
}

// Shell owns everything that lives outside a screen: confetti
// canvas, tooltips, world and music per phase, and the global input feedback.
export function Shell({ children }: { children: ReactNode }) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);
	const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
		null,
	);
	const calm = usePrefs((s) => s.calm);
	const code = useRoomStore((s) => s.lobby?.lobbyCode ?? "");
	const state = useRoomStore((s) => s.lobby?.state);
	const sprint = useRoomStore((s) => !!s.game?.letters?.length);
	const used = useRoomStore(
		(s) => (s.game?.usedLetters ?? s.result?.usedLetters)?.length,
	);
	const round = useRef(0);
	if (state === "Lobby" || !state) round.current = 0;
	else if (used !== undefined) round.current = used;

	useEffect(() => (canvas.current ? fx.mount(canvas.current) : undefined), []);

	useEffect(() => {
		fx.calm = calm;
		document.body.classList.toggle("calm", calm);
	}, [calm]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: a new round or phase re-reads round.current
	useEffect(() => {
		setWorld(worldFor(code, round.current));
	}, [code, used, state]);

	useEffect(() => {
		sound.setScene(
			sprint && state === "Playing"
				? "sprint"
				: state
					? SCENES[state]
					: "lobby",
		);
		shiftPalette();
	}, [state, sprint]);

	useEffect(() => {
		let tipTimer = 0;
		let press = 0;
		let pressed: Element | null = null;
		let swallow = false;
		let grab: { el: HTMLElement; x: number; y: number } | null = null;
		const st = document.documentElement.style;
		// Pointer targets, eased each frame: they follow instantly unless they
		// glide after a jump (pointer re-entered, new touch).
		const look = { x: innerWidth / 2, y: innerHeight / 3 };
		const par = { x: 0, y: 0 };
		const eye = { ...look };
		const fg = { ...par };
		let glide = false;
		let raf = 0;
		let last = 0;
		function ease(
			cur: { x: number; y: number },
			to: { x: number; y: number },
			a: number,
		) {
			cur.x += (to.x - cur.x) * a;
			cur.y += (to.y - cur.y) * a;
			return Math.abs(to.x - cur.x) + Math.abs(to.y - cur.y);
		}
		function frame(t: number) {
			const dt = last ? Math.min(64, t - last) : 16;
			last = t;
			const a = glide ? 1 - Math.exp(-dt / 90) : 1;
			const left = ease(eye, look, a) / 50 + ease(fg, par, a);
			if (glide && Math.abs(eye.x - look.x) + Math.abs(fg.x - par.x) < 0.5)
				glide = false;
			lookAt(eye.x, eye.y);
			const px = fg.x.toFixed(2);
			if (px !== st.getPropertyValue("--px")) st.setProperty("--px", px);
			const bs = bgRef.current?.style;
			bs?.setProperty("--bx", px);
			bs?.setProperty("--by", fg.y.toFixed(2));
			raf = left > 0.002 ? requestAnimationFrame(frame) : 0;
			if (!raf) last = 0;
		}
		function kick() {
			if (!raf) raf = requestAnimationFrame(frame);
		}
		function onOut(e: PointerEvent) {
			if (!e.relatedTarget) glide = true;
		}

		function showTip(el: Element) {
			const text = el.getAttribute("data-tip");
			if (!text) return;
			const r = el.getBoundingClientRect();
			setTip({ text, x: r.left + r.width / 2, y: r.top });
		}
		function onMove(e: PointerEvent) {
			if (e.pointerType === "mouse") {
				par.x = clamp((e.clientX / innerWidth - 0.5) * 2);
				par.y = clamp((e.clientY / innerHeight - 0.5) * 2);
			}
			look.x = e.clientX;
			look.y = e.clientY;
			kick();
			if (grab) {
				const x = band(e.clientX - grab.x);
				const y = band(e.clientY - grab.y);
				grab.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
				grab.el.style.rotate = `${(x * 0.5).toFixed(1)}deg`;
			}
		}
		function onOver(e: PointerEvent) {
			if (e.pointerType !== "mouse") return;
			const el = (e.target as Element).closest("[data-tip]");
			clearTimeout(tipTimer);
			setTip(null);
			if (el) tipTimer = window.setTimeout(() => showTip(el), 350);
		}
		function onDown(e: PointerEvent) {
			sound.start();
			if (e.pointerType !== "mouse") {
				glide = true;
				look.x = e.clientX;
				look.y = e.clientY;
				kick();
			}
			const t = e.target as Element;
			const btn = t.closest("button, [role=button], [role=switch]");
			const g = t.closest<HTMLElement>(GRAB);
			if (g && !fx.calm && !t.closest("input, textarea")) {
				grab = { el: g, x: e.clientX, y: e.clientY };
				g.classList.add("held");
			}
			if (btn) {
				if (
					(btn as HTMLButtonElement).disabled ||
					btn.getAttribute("aria-disabled") === "true"
				) {
					shake(btn, 0.6);
					sound.nope();
					haptic([20, 30, 20]);
				} else {
					sound.tap();
					haptic(8);
				}
			} else if (g) {
				sound.pop();
				haptic(5);
			}
			clearTimeout(press);
			setTip(null);
			const tipEl = t.closest("[data-tip]");
			if (tipEl && e.pointerType !== "mouse") {
				pressed = tipEl;
				press = window.setTimeout(() => {
					swallow = true;
					showTip(tipEl);
					haptic(15);
				}, 450);
			}
		}
		let asked = false;
		function onUp() {
			if (!asked) {
				asked = true;
				(
					globalThis.DeviceOrientationEvent as unknown as {
						requestPermission?: () => Promise<string>;
					}
				)
					?.requestPermission?.()
					.catch(() => {});
			}
			if (grab) {
				grab.el.classList.remove("held");
				grab.el.style.translate = "";
				grab.el.style.rotate = "";
				grab = null;
			}
			clearTimeout(press);
			if (swallow) setTimeout(() => setTip(null), 1400);
		}
		function onClick(e: MouseEvent) {
			if (!swallow) return;
			swallow = false;
			if (pressed?.contains(e.target as Node)) {
				e.preventDefault();
				e.stopPropagation();
			}
		}
		function onTilt(e: DeviceOrientationEvent) {
			if (e.gamma == null || e.beta == null) return;
			par.x = clamp(e.gamma / 25);
			par.y = clamp((e.beta - 45) / 25);
			kick();
		}
		const vv = window.visualViewport;
		function onViewport() {
			if (vv)
				document.documentElement.style.setProperty("--vh", `${vv.height}px`);
		}
		onViewport();
		vv?.addEventListener("resize", onViewport);
		function onVisible() {
			if (document.hidden) sound.pause();
			else sound.start();
		}
		addEventListener("pointermove", onMove, { passive: true });
		addEventListener("pointerover", onOver);
		addEventListener("pointerout", onOut);
		addEventListener("pointerdown", onDown, true);
		addEventListener("pointerup", onUp);
		addEventListener("pointercancel", onUp);
		addEventListener("click", onClick, true);
		addEventListener("deviceorientation", onTilt);
		addEventListener("scroll", () => setTip(null), { passive: true });
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			removeEventListener("pointermove", onMove);
			cancelAnimationFrame(raf);
			removeEventListener("pointerover", onOver);
			removeEventListener("pointerout", onOut);
			removeEventListener("pointerdown", onDown, true);
			removeEventListener("pointerup", onUp);
			removeEventListener("pointercancel", onUp);
			removeEventListener("click", onClick, true);
			removeEventListener("deviceorientation", onTilt);
			document.removeEventListener("visibilitychange", onVisible);
			vv?.removeEventListener("resize", onViewport);
		};
	}, []);

	return (
		<>
			<div className="bg" ref={bgRef} aria-hidden="true">
				{[...Array(8).keys()].map((i) => (
					<i key={i} />
				))}
			</div>
			<main className="app">{children}</main>
			<canvas id="fx" ref={canvas} />
			{tip && <Tip {...tip} />}
		</>
	);
}

function Tip({ text, x, y }: { text: string; x: number; y: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ left: x, top: y - 40 });
	useEffect(() => {
		const r = ref.current?.getBoundingClientRect();
		if (!r) return;
		const left = Math.max(
			8,
			Math.min(innerWidth - r.width - 8, x - r.width / 2),
		);
		const top = y - r.height - 10 < 8 ? y + 52 : y - r.height - 10;
		setPos({ left, top });
	}, [x, y]);
	return (
		<div ref={ref} className="tip" role="tooltip" style={pos}>
			{text}
		</div>
	);
}

// TopBar is the row on top of every screen: `start` on the left, `children`
// centred, sound and settings on the right.
export function TopBar({
	start,
	children,
}: {
	start?: ReactNode;
	children?: ReactNode;
}) {
	const on = usePrefs((s) => s.sound);
	const [open, setOpen] = useState(false);
	return (
		<header className="top">
			<div className="top-start">{start}</div>
			<div className="top-mid">{children}</div>
			<div className="top-end">
				<IconBtn
					tip={on ? "Ton aus" : "Ton an"}
					aria-pressed={on}
					onClick={() => sound.setOn(!on)}
				>
					{on ? <Volume2 /> : <VolumeX />}
				</IconBtn>
				<IconBtn tip="Einstellungen" onClick={() => setOpen(true)}>
					<Settings />
				</IconBtn>
			</div>
			{open && <PrefsSheet onClose={() => setOpen(false)} />}
		</header>
	);
}

function PrefsSheet({ onClose }: { onClose: () => void }) {
	const p = usePrefs();
	return (
		<Modal role="dialog" labelledBy="prefs-title" onClose={onClose}>
			<h2 id="prefs-title" className="sr-only">
				Einstellungen
			</h2>
			<div className="prefs">
				<div className="pref" data-tip="Lautstärke der Hintergrundmusik">
					<Music />
					<Slider
						steps={VOLUME}
						value={Math.round(p.music * 10)}
						label="Musik"
						format={(v) => `${v * 10}%`}
						onChange={(v) => {
							prefs.set({ music: v / 10 });
							sound.levels();
						}}
					/>
				</div>
				<div className="pref" data-tip="Lautstärke der Soundeffekte">
					<Waves />
					<Slider
						steps={VOLUME}
						value={Math.round(p.sfx * 10)}
						label="Effekte"
						format={(v) => `${v * 10}%`}
						onChange={(v) => {
							prefs.set({ sfx: v / 10 });
							sound.levels();
							sound.word(2);
						}}
					/>
				</div>
				<div className="row" style={{ justifyContent: "center" }}>
					<Toggle
						on={p.haptics}
						tip="Vibration"
						onChange={(haptics) => prefs.set({ haptics })}
					>
						<Hand />
					</Toggle>
					<Toggle
						on={!p.calm}
						tip="Animation"
						onChange={(on) => prefs.set({ calm: !on })}
					>
						<Zap />
					</Toggle>
				</div>
			</div>
			<Btn kind="primary" className="wide" onClick={onClose}>
				OK
			</Btn>
		</Modal>
	);
}
