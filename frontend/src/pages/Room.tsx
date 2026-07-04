import { Navigate } from "react-router";
import { useLobbyStore } from "@/store/lobby";
import { Lobby } from "./Lobby";
import { GameScreen } from "./game/GameScreen";
import { ReviewScreen } from "./game/ReviewScreen";
import { RoundResultScreen } from "./game/RoundResultScreen";
import { GameOverScreen } from "./game/GameOverScreen";

// Renders the right screen for the current lobby state. The server is the
// single source of truth for which phase we are in.
export function Room() {
  // Only the phase matters here — subscribing to just `lobby.state` keeps Room
  // from re-rendering on every other lobby-store change (the child screens read
  // the full lobby themselves).
  const state = useLobbyStore((s) => s.lobby?.state);

  if (!state) {
    return <Navigate to="/" replace />;
  }

  return renderScreen(state);
}

function renderScreen(state: string) {
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
