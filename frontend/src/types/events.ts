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
  excludedLetters: string[];
  hostPlays: boolean;
  lastLetterMode: boolean;
  flamesEnabled: boolean;
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

// Machine-readable error codes (SRS 12.3.1). Mirrors backend errors.go.
export type ErrorCode =
  | "INVALID_SESSION"
  | "SESSION_NOT_FOUND"
  | "LOBBY_NOT_FOUND"
  | "INVALID_LOBBY_CODE"
  | "NAME_TOO_SHORT"
  | "NAME_TOO_LONG"
  | "NAME_NOT_UNIQUE"
  | "PLAYER_NOT_FOUND"
  | "INVALID_STATE"
  | "GAME_ALREADY_RUNNING"
  | "NOT_HOST"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_MINIMUM"
  | "INVALID_ANSWER_LENGTH"
  | "INVALID_FIRST_LETTER"
  | "VALIDATION_ERROR";

export type ErrorSeverity = "info" | "warning" | "critical";

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
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
  flamed: boolean;
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

export interface CommentatorPlayer {
  playerId: string;
  filledCategoryIds: string[];
  complete: boolean;
}

export interface CommentatorStatePayload {
  roundId: string;
  players: CommentatorPlayer[];
}

export type GameOverReason = "AlphabetFinished" | "HostEnded";

export interface RoundResultPayload {
  letter: string;
  scores: ScoreEntry[];
  ranking: RankEntry[];
  usedLetters: string[];
  remainingLetters: string[];
  isGameOver: boolean;
  reason?: GameOverReason;
}

export type BuzzRejectReason =
  | "incompleteAnswers"
  | "invalidAnswers"
  | "alreadyBuzzed"
  | "invalidState";

export type ServerEvent =
  | { type: "lobbyState"; payload: LobbyStatePayload }
  | { type: "sessionCreated"; payload: SessionCreatedPayload }
  | { type: "playerKicked"; payload: { playerId: string } }
  | { type: "lobbyClosed"; payload: { reason: "hostLeft" } }
  | { type: "gameState"; payload: GameStatePayload }
  | { type: "reviewState"; payload: ReviewStatePayload }
  | { type: "commentatorState"; payload: CommentatorStatePayload }
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
      payload: {
        timeLimit: number | null;
        showLetterDuringCountdown: boolean;
        excludedLetters: string[];
        hostPlays: boolean;
        lastLetterMode: boolean;
        flamesEnabled: boolean;
      };
    }
  | { type: "kickPlayer"; payload: { playerId: string } }
  | { type: "startGame"; payload: Record<string, never> }
  | { type: "answerUpdate"; payload: { categoryId: string; value: string } }
  | {
      type: "inputSync";
      payload: { roundId: string; answers: { categoryId: string; value: string }[] };
    }
  | { type: "buzz"; payload: Record<string, never> }
  | { type: "setFlame"; payload: { categoryId: string } }
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
