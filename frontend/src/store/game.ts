import { create } from "zustand";
import type {
	GameStatePayload,
	ReviewStatePayload,
	RoundResultPayload,
	CommentatorStatePayload,
	BuzzRejectReason,
} from "@/types/events";

interface GameStore {
	game: GameStatePayload | null;
	review: ReviewStatePayload | null;
	result: RoundResultPayload | null;
	commentator: CommentatorStatePayload | null;
	buzzRejected: BuzzRejectReason | null;
	buzzing: boolean;

	setGame: (game: GameStatePayload) => void;
	setReview: (review: ReviewStatePayload) => void;
	setResult: (result: RoundResultPayload) => void;
	setCommentator: (commentator: CommentatorStatePayload) => void;
	setBuzzRejected: (reason: BuzzRejectReason | null) => void;
	buzz: () => void;
	resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
	game: null,
	review: null,
	result: null,
	commentator: null,
	buzzRejected: null,
	buzzing: false,

	// endsAt is moved onto the local clock, so timers compare it with Date.now().
	setGame: (game) =>
		set({
			game: {
				...game,
				endsAt:
					game.endsAt === null
						? null
						: game.endsAt - game.serverNow + Date.now(),
			},
			buzzRejected: null,
			buzzing: false,
		}),
	setReview: (review) => set({ review }),
	setResult: (result) => set({ result }),
	setCommentator: (commentator) => set({ commentator }),
	setBuzzRejected: (reason) => set({ buzzRejected: reason, buzzing: false }),
	buzz: () => set({ buzzRejected: null, buzzing: true }),
	resetGame: () =>
		set({
			game: null,
			review: null,
			result: null,
			commentator: null,
			buzzRejected: null,
			buzzing: false,
		}),
}));
