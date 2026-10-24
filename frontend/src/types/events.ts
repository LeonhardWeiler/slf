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
	// True for a player who joined mid-game and is waiting to play from the next
	// round: shown a spectator view, hidden from the standings until then.
	pending: boolean;
	score: number;
	// Rounds in a row with every slot validly filled.
	combo: number;
}

export interface Category {
	id: string;
	name: string;
}

export interface Settings {
	timeLimit: number | null;
	excludedLetters: string[];
	hostPlays: boolean;
	lastLetterMode: boolean;
}

// A lobbyState whose players are only the changed ones; removed lists the
// ids of players that are gone.
export interface LobbyPatchPayload extends LobbyStatePayload {
	removed: string[];
}

export interface LobbyStatePayload {
	lobbyCode: string;
	hostId: string;
	players: Player[];
	categories: Category[];
	settings: Settings;
	state: GameState;
	// Seconds until the lobby closes because the host is disconnected; null/absent
	// when the host is present.
	hostGraceSeconds?: number | null;
	// A single player is in the lobby: one-screen review, no scoreboard.
	solo: boolean;
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
	endsAt: number | null;
	serverNow: number;
	countdownRemaining: number | null;
	categoryCount: number;
	letters?: string[] | null;
	sprintPos?: number;
	sprintWords?: string[];
}

export interface ReviewAnswer {
	answerId: string;
	playerId: string;
	value: string;
	valid: boolean;
	mergedInto: string;
	pointsPreview: number;
	// voter playerId -> thumbs-up (true) or thumbs-down.
	votes: Record<string, boolean> | null;
	// The host overrode the verdict; votes no longer count.
	ruled: boolean;
}

export interface ReviewStatePayload {
	roundId: string;
	letter: string;
	categoryId: string;
	categoryIndex: number;
	categoryCount: number;
	answers: ReviewAnswer[];
	// playerId of whoever buzzed to end the round; empty on timeout / host-ended.
	buzzedBy?: string;
	endReason?: string;
	// Every category with the solo player's answer; null unless solo.
	solo: SoloRow[] | null;
	ready: string[] | null;
	voters: string[] | null;
}

export interface SoloRow {
	key: string;
	letter: string;
	categoryId: string;
	value: string;
	valid: boolean;
	points: number;
}

export interface ScoreEntry {
	playerId: string;
	roundPoints: number;
	totalPoints: number;
	points: number[];
	buzz: number;
	combo: number;
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

export interface CommentatorUpdatePayload {
	roundId: string;
	player: CommentatorPlayer;
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
	empty?: boolean;
	reason?: GameOverReason;
}

export type BuzzRejectReason =
	| "incompleteAnswers"
	| "invalidAnswers"
	| "alreadyBuzzed"
	| "invalidState";

// Why a lobby can't be joined right now, as reported by a pre-join checkLobby.
// A running game is no longer a blocker (you join as a waiting spectator), so
// only these reasons remain.
export type LobbyUnavailableReason =
	| "invalidCode"
	| "notFound"
	| "full"
	| "throttled";

export interface LobbyCheckPayload {
	lobbyCode: string;
	available: boolean;
	reason?: LobbyUnavailableReason;
}

export type ServerEvent =
	| { type: "lobbyState"; payload: LobbyStatePayload }
	| { type: "lobbyPatch"; payload: LobbyPatchPayload }
	| { type: "sessionCreated"; payload: SessionCreatedPayload }
	| { type: "lobbyCheck"; payload: LobbyCheckPayload }
	| { type: "playerKicked"; payload: { playerId: string } }
	| { type: "lobbyClosed"; payload: { reason: string } }
	| { type: "gameState"; payload: GameStatePayload }
	| { type: "reviewState"; payload: ReviewStatePayload }
	| { type: "commentatorState"; payload: CommentatorStatePayload }
	| { type: "commentatorUpdate"; payload: CommentatorUpdatePayload }
	| { type: "roundResult"; payload: RoundResultPayload }
	| { type: "buzzRejected"; payload: { reason: BuzzRejectReason } }
	| { type: "hostDisconnected"; payload: { graceSeconds: number } }
	| { type: "hostReconnected"; payload: Record<string, never> }
	| { type: "pong"; payload: Record<string, never> }
	| { type: "error"; payload: ErrorPayload };

// Client -> Server
export type ClientEvent =
	| { type: "createLobby"; payload: { playerName: string } }
	| { type: "joinLobby"; payload: { playerName: string; lobbyCode: string } }
	| { type: "checkLobby"; payload: { lobbyCode: string } }
	| { type: "reconnect"; payload: Record<string, never> }
	| { type: "leaveLobby"; payload: Record<string, never> }
	| { type: "addCategory"; payload: { name: string } }
	| { type: "editCategory"; payload: { categoryId: string; name: string } }
	| { type: "deleteCategory"; payload: { categoryId: string } }
	| {
			type: "updateSettings";
			payload: {
				timeLimit: number | null;
				excludedLetters: string[];
				hostPlays: boolean;
				lastLetterMode: boolean;
			};
	  }
	| { type: "kickPlayer"; payload: { playerId: string } }
	| { type: "startGame"; payload: Record<string, never> }
	| {
			type: "answerUpdate";
			payload: { roundId: string; categoryId: string; value: string };
	  }
	| {
			type: "inputSync";
			payload: {
				roundId: string;
				answers: { categoryId: string; value: string }[];
			};
	  }
	| { type: "buzz"; payload: { roundId: string } }
	| {
			type: "sprintWord";
			payload: { roundId: string; pos: number; value: string };
	  }
	| { type: "endRound"; payload: Record<string, never> }
	| {
			type: "setAnswerValidity";
			payload: { answerId: string; valid: boolean; categoryId?: string };
	  }
	| {
			type: "mergeAnswers";
			payload: { targetAnswerId: string; sourceAnswerId: string };
	  }
	| { type: "unmergeAnswers"; payload: { answerId: string } }
	| { type: "voteAnswer"; payload: { answerId: string; vote: 1 | -1 | 0 } }
	| { type: "reviewReady"; payload: Record<string, never> }
	| { type: "nextCategory"; payload: Record<string, never> }
	| { type: "previousCategory"; payload: Record<string, never> }
	| { type: "finishReview"; payload: Record<string, never> }
	| { type: "startNextRound"; payload: Record<string, never> }
	| { type: "endGame"; payload: Record<string, never> }
	| { type: "returnToLobby"; payload: Record<string, never> }
	| { type: "ping"; payload: Record<string, never> };
