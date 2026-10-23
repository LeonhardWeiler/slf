import { useEffect, useState } from "react";
import { Crown, Hourglass, RotateCcw, Star } from "lucide-react";
import { ws } from "@/lib/ws";
import { fx } from "@/lib/fx";
import { sound } from "@/lib/sound";
import { useRoomStore, useIsHost } from "@/store/room";
import { PlayerStatus } from "@/components/PlayerStatus";
import { RoomHeader } from "@/components/RoomHeader";
import { CountUp } from "@/components/CountUp";
import { Av, Btn, Mascot, mood } from "@/components/kit";

const ORDER = [1, 0, 2];

export function GameOverScreen() {
	const lobby = useRoomStore((s) => s.lobby);
	const myPlayerId = useRoomStore((s) => s.myPlayerId);
	const result = useRoomStore((s) => s.result);
	const isHost = useIsHost();
	const [up, setUp] = useState(0);

	// Third, second, then first rise; the winner lands with confetti.
	useEffect(() => {
		const ids = [3, 2, 1].map((place, i) =>
			setTimeout(
				() => {
					setUp(4 - place);
					sound.slot(i);
					if (place === 1) {
						sound.fanfare();
						fx.rain();
						mood("cheer", 2000);
					}
				},
				500 + i * 700,
			),
		);
		return () => ids.forEach(clearTimeout);
	}, []);

	if (!lobby) return null;

	const playerOf = (id: string) => lobby.players.find((p) => p.id === id);
	const playerName = (id: string) => playerOf(id)?.name ?? "?";
	const ranking = result?.ranking ?? [];

	return (
		<>
			<RoomHeader />
			<section className="screen over">
				{lobby.solo ? (
					<div className="center solo-score">
						<Mascot size="big" base="happy" />
						<span className="solo-total">
							<Star />
							<CountUp value={playerOf(myPlayerId ?? "")?.score ?? 0} />
						</span>
					</div>
				) : (
					<>
						<div className="podium-row">
							{ORDER.map((i) => {
								const r = ranking[i];
								if (!r) return null;
								return (
									<div
										key={r.playerId}
										className={`step s${i + 1}${up >= 3 - i ? " up" : ""}${r.playerId === myPlayerId ? " me" : ""}`}
									>
										<div className="step-av">
											{r.rank === 1 && r.score > 0 && (
												<span className="crown">
													<Crown />
												</span>
											)}
											<Av
												id={r.playerId}
												name={playerName(r.playerId)}
												size="big"
											/>
											<b>{r.score}</b>
										</div>
										<div className="block">{r.rank}</div>
									</div>
								);
							})}
						</div>
						{ranking.slice(3).map((r) => (
							<div
								key={r.playerId}
								className={`fourth${r.playerId === myPlayerId ? " me" : ""}`}
							>
								<b>{r.rank}</b>
								<Av id={r.playerId} name={playerName(r.playerId)} size="sm" />
								<span className="name">
									{playerName(r.playerId)}
									<PlayerStatus player={playerOf(r.playerId)} />
								</span>
								<b>{r.score}</b>
							</div>
						))}
					</>
				)}
				<div className="end-actions">
					{isHost ? (
						<Btn
							kind="primary"
							aria-label="Zurück zur Lobby"
							data-tip="Zurück zur Lobby"
							onClick={() => ws.send({ type: "returnToLobby", payload: {} })}
						>
							<RotateCcw />
						</Btn>
					) : (
						<p className="waiting" data-tip="Warte auf den Host">
							<Hourglass />
						</p>
					)}
				</div>
			</section>
		</>
	);
}
