import { Navigate } from "@tanstack/react-router";
import { useLobbyStore } from "@/store/lobby";
import { Lobby } from "./Lobby";
import { GameScreen } from "./game/GameScreen";
import { ReviewScreen } from "./game/ReviewScreen";
import { SoloReviewScreen } from "./game/SoloReviewScreen";
import { RoundResultScreen } from "./game/RoundResultScreen";
import { GameOverScreen } from "./game/GameOverScreen";

// Renders the right screen for the current lobby state. The server is the
// single source of truth for which phase we are in.
export function Room() {
	// Only the phase matters here - subscribing to just `lobby.state` keeps Room
	// from re-rendering on every other lobby-store change (the child screens read
	// the full lobby themselves).
	const state = useLobbyStore((s) => s.lobby?.state);
	const solo = useLobbyStore((s) => s.lobby?.solo ?? false);

	if (!state) {
		return <Navigate to="/" replace />;
	}

	return renderScreen(state, solo);
}

function renderScreen(state: string, solo: boolean) {
	switch (state) {
		case "Countdown":
		case "Playing":
			return <GameScreen />;
		case "Reviewing":
			return solo ? <SoloReviewScreen /> : <ReviewScreen />;
		case "RoundResult":
			return <RoundResultScreen />;
		case "GameOver":
			return <GameOverScreen />;
		default:
			return <Lobby />;
	}
}
