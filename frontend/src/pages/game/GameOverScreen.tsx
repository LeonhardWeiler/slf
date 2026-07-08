import { Trophy } from "lucide-react";
import { ws } from "@/lib/ws";
import { useLobbyStore, useIsHost } from "@/store/lobby";
import { useGameStore } from "@/store/game";
import { RoomHeader } from "@/components/RoomHeader";
import { CountUp } from "@/components/CountUp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GameOverScreen() {
	const lobby = useLobbyStore((s) => s.lobby);
	const myPlayerId = useLobbyStore((s) => s.myPlayerId);
	const result = useGameStore((s) => s.result);
	const isHost = useIsHost();

	if (!lobby) return null;

	const playerName = (id: string) =>
		lobby.players.find((p) => p.id === id)?.name ?? "?";
	// "(verlassen)" gilt auch für getrennte Spieler (in der Kommentator-Ansicht
	// schon ausgegraut), damit End- und Live-Ansicht konsistent sind.
	const hasLeft = (id: string) => {
		const p = lobby.players.find((pl) => pl.id === id);
		return p ? p.left || !p.connected : false;
	};
	const ranking = result?.ranking ?? [];

	return (
		<div className="min-h-svh bg-background screen-pad">
			<div className="mx-auto w-full max-w-5xl space-y-4">
				<RoomHeader title="Spiel beendet" />

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Endstand</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{ranking.map((r, i) => (
							<div
								key={r.playerId}
								// Final standings ease in top-to-bottom (backwards fill keeps
								// them hidden through the stagger delay).
								style={{
									animationDelay: `${i * 70}ms`,
									animationFillMode: "backwards",
								}}
								className={`animate-fade-in flex items-center justify-between py-2 px-3 rounded-md ${
									r.rank === 1
										? "bg-amber-500/15 border border-amber-500/40"
										: "bg-muted/50"
								}`}
							>
								<div className="flex items-center gap-3">
									<span className="text-sm font-bold text-muted-foreground w-5">
										{r.rank}.
									</span>
									{r.rank === 1 && (
										<Trophy className="h-4 w-4 text-amber-500" />
									)}
									<span className="text-sm font-medium">
										{playerName(r.playerId)}
										{r.playerId === myPlayerId && (
											<span className="text-xs text-muted-foreground">
												{" "}
												(du)
											</span>
										)}
										{hasLeft(r.playerId) && (
											<span className="text-xs text-muted-foreground">
												{" "}
												(verlassen)
											</span>
										)}
									</span>
								</div>
								<CountUp
									value={r.score}
									className="text-sm font-bold tabular-nums"
								/>
							</div>
						))}
					</CardContent>
				</Card>

				{isHost ? (
					<Button
						className="w-full"
						size="lg"
						onClick={() => ws.send({ type: "returnToLobby", payload: {} })}
					>
						Zurück zur Lobby
					</Button>
				) : (
					<p className="text-center text-sm text-muted-foreground">
						Warte auf den Host…
					</p>
				)}
			</div>
		</div>
	);
}
