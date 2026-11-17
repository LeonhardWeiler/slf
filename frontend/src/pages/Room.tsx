import { Navigate } from "@/lib/nav";
import { phaseReady, useRoomStore } from "@/store/room";
import { Lobby } from "./Lobby";
import { GameScreen } from "./game/GameScreen";
import { ReviewScreen } from "./game/ReviewScreen";
import { RoundResultScreen } from "./game/RoundResultScreen";
import { GameOverScreen } from "./game/GameOverScreen";

export function Room() {
	// Only the phase, so Room does not re-render on other lobby changes.
	const state = useRoomStore((s) => s.lobby?.state);
	const ready = useRoomStore(phaseReady);

	if (!state) {
		return <Navigate to="/" />;
	}

	if (!ready) {
		return (
			<div className="min-h-svh bg-background flex items-center justify-center">
				<p className="text-muted-foreground">Wird geladen…</p>
			</div>
		);
	}

	return renderScreen(state);
}

export function renderScreen(state: string) {
	switch (state) {
		case "Countdown":
		case "Playing":
			return <GameScreen />;
		case "Reviewing":
			return <ReviewScreen />;
		case "RoundResult":
			return <RoundResultScreen />;
		case "GameOver":
			return <GameOverScreen />;
		default:
			return <Lobby />;
	}
}
