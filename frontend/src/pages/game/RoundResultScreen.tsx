import { useEffect, useState } from "react";
import { ArrowRight, Crown, Flag, Hourglass, X } from "lucide-react";
import { sound } from "@/lib/sound";
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
	const [counted, setCounted] = useState(false);

	// The round's points land a beat after the board appears.
	useEffect(() => {
		const id = setTimeout(() => {
			setCounted(true);
			const mine =
				result?.scores.find((s) => s.playerId === myPlayerId)?.roundPoints ?? 0;
			if (mine > 0) {
				sound.combo(Math.min(5, Math.ceil(mine / 10)));
				mood("cheer", 1200);
			} else sound.thud();
		}, 700);
		return () => clearTimeout(id);
	}, [result, myPlayerId]);

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
	const roundPointsOf = (id: string) =>
		result.scores.find((s) => s.playerId === id)?.roundPoints ?? 0;
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
					{result.ranking.map((r, i) => {
						const gain = roundPointsOf(r.playerId);
						const p = playerOf(r.playerId);
						return (
							<li
								key={r.playerId}
								className={`rank${r.playerId === myPlayerId ? " me" : ""}${counted && gain > 0 ? " gaining" : ""}`}
								style={
									{
										"--pc": playerColor(r.playerId),
										"--w": counted ? r.score / top : (r.score - gain) / top,
										animationDelay: `${i * 70}ms`,
									} as React.CSSProperties
								}
							>
								<span className="pos">
									{r.rank === 1 && r.score > 0 ? <Crown /> : r.rank}
								</span>
								<Av id={r.playerId} name={playerName(r.playerId)} />
								<span className="name">
									{playerName(r.playerId)}
									<PlayerStatus player={p} />
								</span>
								<span className="gain">+{gain}</span>
								<CountUp
									value={counted ? r.score : r.score - gain}
									className="total"
								/>
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
