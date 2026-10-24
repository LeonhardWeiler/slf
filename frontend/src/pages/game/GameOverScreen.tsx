import { useEffect, useState } from "react";
import { Crown, Flame, Hourglass, RotateCcw, Star, Trophy } from "lucide-react";
import { ws } from "@/lib/ws";
import { haptic, slam } from "@/lib/feel";
import { fx } from "@/lib/fx";
import { sound } from "@/lib/sound";
import { stats } from "@/lib/stats";
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
	const [end, setEnd] = useState<{
		best: number;
		fresh: boolean;
		streak: number;
		grew: boolean;
	} | null>(null);
	const solo = !!lobby?.solo;
	const mode = solo ? "solo-sprint" : "multi-classic";
	const score = lobby?.players.find((p) => p.id === myPlayerId)?.score ?? 0;
	const won = result?.ranking[0]?.playerId === myPlayerId && score > 0;
	const played = !!result?.ranking.some((r) => r.playerId === myPlayerId);

	// Solo counts the total up; multiplayer raises third, second, then first.
	// Then the personal record and the day streak land.
	useEffect(() => {
		const at = (ms: number, f: () => void) => setTimeout(f, ms);
		const ids = solo
			? []
			: [3, 2, 1].map((place, i) =>
					at(500 + i * 700, () => {
						setUp(4 - place);
						sound.stamp(place === 1 ? 20 : 10);
						haptic(20);
						if (place === 1) {
							sound.fanfare();
							fx.rain();
							mood("cheer", 2000);
						}
					}),
				);
		ids.push(
			at(solo ? 2700 : 2600, () => {
				if (solo) {
					sound.stamp(20);
					mood("cheer", 1500);
				} else if (won) slam("SIEG!", "win big");
				const best = stats.best(mode);
				const before = stats.streak();
				stats.record(mode, score);
				const streak = stats.played();
				const fresh = score > best;
				const wait = won ? 1200 : 500;
				setEnd({ best, fresh, streak, grew: streak > before });
				if (fresh) {
					setTimeout(() => {
						slam("NEU!", "win");
						fx.rain(160);
						sound.fanfare();
					}, wait);
				}
				if (streak > before)
					setTimeout(() => sound.ignite(), wait + (fresh ? 900 : 0));
			}),
		);
		return () => ids.forEach(clearTimeout);
	}, [solo, mode, score, won]);

	if (!lobby) return null;

	const playerOf = (id: string) => lobby.players.find((p) => p.id === id);
	const playerName = (id: string) => playerOf(id)?.name ?? "?";
	const ranking = result?.ranking ?? [];

	return (
		<>
			<RoomHeader />
			<section className={`screen over${solo ? " solo" : ""}`}>
				{played && (
					<div className="center hero">
						{solo && <Mascot size="big" base="happy" />}
						<span className="solo-total">
							<Star />
							<CountUp
								value={score}
								durationMs={solo ? 2600 : 2400}
								rattle={solo}
							/>
						</span>
					</div>
				)}
				{!solo && (
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
											<CountUp
												value={up >= 3 - i ? r.score : 0}
												durationMs={500}
												className="step-pts"
											/>
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
								<Av
									id={r.playerId}
									name={playerName(r.playerId)}
									size="sm"
									tip={false}
								/>
								<span className="name">
									{playerName(r.playerId)}
									<PlayerStatus player={playerOf(r.playerId)} />
								</span>
								<b>{r.score}</b>
							</div>
						))}
					</>
				)}
				{end && (
					<div className="end-stats">
						<span
							className={`badge record${end.fresh ? " fresh" : ""}`}
							data-tip="Rekord"
						>
							<Trophy />
							{end.fresh ? "NEU!" : end.best}
						</span>
						<span
							className={`badge streak${end.grew ? " grew" : ""}`}
							data-tip="Tage in Folge"
						>
							<Flame />
							{end.streak}
						</span>
					</div>
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
