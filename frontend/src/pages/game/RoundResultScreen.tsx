import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Crown, Flag, Hourglass, X } from "lucide-react";
import { animate, bounce, floatText, haptic, slam } from "@/lib/feel";
import { fx } from "@/lib/fx";
import { sound } from "@/lib/sound";
import { stats } from "@/lib/stats";
import { ws } from "@/lib/ws";
import { useRoomStore, useIsHost } from "@/store/room";
import { handlesEnter } from "@/lib/utils";
import { PlayerStatus } from "@/components/PlayerStatus";
import { RoomHeader } from "@/components/RoomHeader";
import { CountUp } from "@/components/CountUp";
import { useConfirm } from "@/components/ConfirmDialog";
import { isModalOpen } from "@/components/Modal";
import { Av, Btn, IconBtn, Mascot, mood, playerColor } from "@/components/kit";

export function RoundResultScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const myPlayerId = useRoomStore((s) => s.myPlayerId);
	const result = useRoomStore((s) => s.result);
	const isHost = useIsHost();
	const { confirm, dialog } = useConfirm();
	const sprint = useRoomStore((s) => !!s.lobby?.settings.sprint);
	const [step, setStep] = useState(0);
	const [sorted, setSorted] = useState(false);
	const rows = useRef(new Map<string, HTMLLIElement>());
	const tops = useRef(new Map<string, number>());

	// The board opens in the old order, every scoring answer lands as a coin,
	// then the rows fly to their new places.
	useEffect(() => {
		if (!result) return;
		setStep(0);
		setSorted(false);
		const n = Math.max(0, ...result.scores.map((s) => s.points.length));
		const ids = [
			...Array.from({ length: n }, (_, i) =>
				setTimeout(() => setStep(i + 1), 700 + i * 280),
			),
			setTimeout(
				() => {
					const gain =
						result.scores.find((s) => s.playerId === myPlayerId)?.roundPoints ??
						0;
					const key = `round-${sprint ? "sprint" : "classic"}`;
					const best = stats.best(key);
					stats.record(key, gain);
					stats.played();
					if (best > 0 && gain > best) {
						slam("NEU!", "win");
						fx.rain(60);
						sound.fanfare();
					} else if (gain > 0) mood("cheer", 1200);
					else sound.thud();
					for (const [id, el] of rows.current)
						tops.current.set(id, el.getBoundingClientRect().top);
					setSorted(true);
				},
				700 + n * 280 + 300,
			),
		];
		return () => ids.forEach(clearTimeout);
	}, [result, myPlayerId, sprint]);

	useEffect(() => {
		if (!step || !result) return;
		for (const s of result.scores) {
			const p = s.points[step - 1];
			const row = rows.current.get(s.playerId);
			if (!p || !row) continue;
			floatText(row.querySelector(".gain"), `+${p}`, "pts-float");
			bounce(row.querySelector(".total"), 1.25, 220);
			if (s.playerId === myPlayerId) {
				sound.coin(step - 1);
				haptic(8);
			}
		}
	}, [step, result, myPlayerId]);

	useLayoutEffect(() => {
		if (!sorted || !result) return;
		for (const [id, el] of rows.current) {
			const dy = (tops.current.get(id) ?? 0) - el.getBoundingClientRect().top;
			if (!dy) continue;
			animate(el, [{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
				duration: 700,
			});
			if (id === myPlayerId && dy > 0) {
				sound.whoosh();
				haptic([15, 30, 40]);
				if (result.ranking[0]?.playerId === id)
					setTimeout(() => sound.fanfare(), 450);
			}
		}
	}, [sorted, result, myPlayerId]);

	// Host can remove a player from the between-rounds standings (the points
	// table). The server keeps them in the ranking marked "(verlassen)" (todo-4).
	async function handleKick(playerId: string, name: string) {
		if (
			await confirm({
				title: `${name} entfernen?`,
				description: `${name} wird aus dem Spiel entfernt und erscheint im Stand weiter als „verlassen“.`,
				confirmLabel: "Entfernen",
				destructive: true,
			})
		) {
			ws.send({ type: "kickPlayer", payload: { playerId } });
		}
	}

	async function handleEndGame() {
		if (
			await confirm({
				title: "Spiel beenden?",
				description:
					"Das Spiel wird für alle beendet und der Endstand angezeigt.",
				confirmLabel: "Spiel beenden",
				destructive: true,
			})
		) {
			ws.send({ type: "endGame", payload: {} });
		}
	}

	// Host can start the next round with Enter. Ending the game stays button-only.
	useEffect(() => {
		if (!isHost) return;
		function onKey(e: KeyboardEvent) {
			if (e.defaultPrevented || handlesEnter(document.activeElement)) return;
			// Don't fire while a confirm dialog is up (e.g. "Spiel beenden?"), so the
			// Enter that confirms it doesn't also start the next round (UX-1).
			if (isModalOpen()) return;
			// Ignore auto-repeat: holding Enter would send startNextRound many times.
			// The first advances the server past RoundResult, so the rest hit an
			// invalid state and surface a spurious "Aktion nicht erlaubt".
			if (e.repeat) return;
			if (e.key === "Enter") {
				ws.send({ type: "startNextRound", payload: {} });
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isHost]);

	if (!lobby || !result) return null;

	const playerOf = (id: string) => lobby.players.find((p) => p.id === id);
	const playerName = (id: string) => playerOf(id)?.name ?? "?";
	const scoreOf = (id: string) => result.scores.find((s) => s.playerId === id);
	const roundPointsOf = (id: string) => scoreOf(id)?.roundPoints ?? 0;
	const shown = (id: string, total: number) =>
		sorted
			? total
			: total -
				roundPointsOf(id) +
				(scoreOf(id)
					?.points.slice(0, step)
					.reduce((a, b) => a + b, 0) ?? 0);
	const order = sorted
		? result.ranking
		: result.ranking.toSorted(
				(a, b) =>
					b.score -
					roundPointsOf(b.playerId) -
					(a.score - roundPointsOf(a.playerId)),
			);
	const lettersLeft = result.remainingLetters.length;
	const top = Math.max(1, ...result.ranking.map((r) => r.score));

	return (
		<>
			<RoomHeader>
				{isHost && (
					<IconBtn tip="Spiel beenden" onClick={handleEndGame}>
						<Flag />
					</IconBtn>
				)}
			</RoomHeader>
			<section className="screen result">
				<div className="hud">
					<Mascot
						size="letter"
						letter={result.letter}
						base={result.empty ? "sad" : "happy"}
					/>
					<div className="hud-mid">
						<div className="rounds big">
							{result.usedLetters.map((l) => (
								<i key={l} className="done" />
							))}
							{result.remainingLetters.slice(0, 3).map((l) => (
								<i key={l} />
							))}
						</div>
					</div>
				</div>
				<ol className="ranking">
					{order.map((r, i) => {
						const gain = roundPointsOf(r.playerId);
						const now = shown(r.playerId, r.score);
						const p = playerOf(r.playerId);
						return (
							<li
								key={r.playerId}
								ref={(el) => {
									if (el) rows.current.set(r.playerId, el);
									else rows.current.delete(r.playerId);
								}}
								className={`rank${r.playerId === myPlayerId ? " me" : ""}${now > r.score - gain ? " gaining" : ""}`}
								style={
									{
										"--pc": playerColor(r.playerId),
										"--w": now / top,
										animationDelay: `${i * 70}ms`,
									} as React.CSSProperties
								}
							>
								<span className="pos">
									{!sorted ? (
										i + 1
									) : r.rank === 1 && r.score > 0 ? (
										<Crown />
									) : (
										r.rank
									)}
								</span>
								<Av id={r.playerId} name={playerName(r.playerId)} tip={false} />
								<span className="name">
									{playerName(r.playerId)}
									<PlayerStatus player={p} />
								</span>
								<span className="gain">+{gain}</span>
								<CountUp value={now} durationMs={250} className="total" />
								{isHost && r.playerId !== myPlayerId && !p?.left && (
									<button
										type="button"
										className="kick"
										aria-label={`${playerName(r.playerId)} entfernen`}
										data-tip="Entfernen"
										onClick={() =>
											handleKick(r.playerId, playerName(r.playerId))
										}
									>
										<X />
									</button>
								)}
								<span className="bar">
									<i />
								</span>
							</li>
						);
					})}
				</ol>
				{isHost ? (
					<Btn
						kind="next"
						aria-label={lettersLeft > 0 ? "Nächste Runde" : "Spiel abschließen"}
						data-tip={lettersLeft > 0 ? "Nächste Runde" : "Spiel abschließen"}
						onClick={() => ws.send({ type: "startNextRound", payload: {} })}
					>
						{lettersLeft > 0 ? <ArrowRight /> : <Flag />}
					</Btn>
				) : (
					<p className="waiting" data-tip="Warte auf den Host">
						<Hourglass />
					</p>
				)}
			</section>
			{dialog}
		</>
	);
}
