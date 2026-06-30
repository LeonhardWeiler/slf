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
  const { lobby } = useLobbyStore();

  if (!lobby) {
    return <Navigate to="/" replace />;
  }

  switch (lobby.state) {
    case "Countdown":
    case "Playing":
      return <GameScreen />;
    case "Reviewing":
      return <ReviewScreen />;
    case "RoundResult":
      return <RoundResultScreen />;
    case "GameOver":
      return <GameOverScreen />;
    case "Lobby":
    default:
      return <Lobby />;
  }
}
