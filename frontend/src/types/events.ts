export type GameState =
  | "Lobby"
  | "Countdown"
  | "Playing"
  | "Reviewing"
  | "RoundResult"
  | "GameOver";

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  left: boolean;
  score: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Settings {
  timeLimit: number | null;
  showLetterDuringCountdown: boolean;
}

export interface LobbyStatePayload {
  lobbyCode: string;
  hostId: string;
  players: Player[];
  categories: Category[];
  settings: Settings;
  state: GameState;
}

export interface SessionCreatedPayload {
  sessionId: string;
  playerId: string;
}

export interface ErrorPayload {
  message: string;
}

export interface GameStatePayload {
  roundId: string;
  state: "Countdown" | "Playing";
  letter: string;
  usedLetters: string[];
  remainingLetters: string[];
  timeRemaining: number | null;
  countdownRemaining: number | null;
  elapsed: number | null;
  categoryCount: number;
}

export interface ReviewAnswer {
  answerId: string;
  playerId: string;
  value: string;
  valid: boolean;
  mergedInto: string;
  pointsPreview: number;
}

export interface ReviewStatePayload {
  roundId: string;
  letter: string;
  categoryId: string;
  categoryIndex: number;
  categoryCount: number;
  answers: ReviewAnswer[];
}

export interface ScoreEntry {
  playerId: string;
  roundPoints: number;
  totalPoints: number;
}

export interface RankEntry {
  playerId: string;
  rank: number;
  score: number;
}

export interface RoundResultPayload {
  letter: string;
  scores: ScoreEntry[];
  ranking: RankEntry[];
  isGameOver: boolean;
}

export type BuzzRejectReason =
  | "incompleteAnswers"
  | "alreadyBuzzed"
  | "invalidState";

export type ServerEvent =
  | { type: "lobbyState"; payload: LobbyStatePayload }
  | { type: "sessionCreated"; payload: SessionCreatedPayload }
  | { type: "playerKicked"; payload: { playerId: string } }
  | { type: "lobbyClosed"; payload: { reason: "hostLeft" } }
  | { type: "gameState"; payload: GameStatePayload }
  | { type: "reviewState"; payload: ReviewStatePayload }
  | { type: "roundResult"; payload: RoundResultPayload }
  | { type: "buzzRejected"; payload: { reason: BuzzRejectReason } }
  | { type: "error"; payload: ErrorPayload };

// Client → Server
export type ClientEvent =
  | { type: "createLobby"; payload: { playerName: string } }
  | { type: "joinLobby"; payload: { playerName: string; lobbyCode: string } }
  | { type: "reconnect"; payload: Record<string, never> }
  | { type: "leaveLobby"; payload: Record<string, never> }
  | { type: "addCategory"; payload: { name: string } }
  | { type: "editCategory"; payload: { categoryId: string; name: string } }
  | { type: "deleteCategory"; payload: { categoryId: string } }
  | {
      type: "updateSettings";
      payload: { timeLimit: number | null; showLetterDuringCountdown: boolean };
    }
  | { type: "kickPlayer"; payload: { playerId: string } }
  | { type: "startGame"; payload: Record<string, never> }
  | { type: "answerUpdate"; payload: { categoryId: string; value: string } }
  | {
      type: "inputSync";
      payload: { roundId: string; answers: { categoryId: string; value: string }[] };
    }
  | { type: "buzz"; payload: Record<string, never> }
  | { type: "setAnswerValidity"; payload: { answerId: string; valid: boolean } }
  | {
      type: "mergeAnswers";
      payload: { targetAnswerId: string; sourceAnswerId: string };
    }
  | { type: "unmergeAnswers"; payload: { answerId: string } }
  | { type: "nextCategory"; payload: Record<string, never> }
  | { type: "previousCategory"; payload: Record<string, never> }
  | { type: "finishReview"; payload: Record<string, never> }
  | { type: "startNextRound"; payload: Record<string, never> }
  | { type: "endGame"; payload: Record<string, never> }
  | { type: "returnToLobby"; payload: Record<string, never> };
