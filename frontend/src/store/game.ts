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

	setGame: (game: GameStatePayload) => void;
	setReview: (review: ReviewStatePayload) => void;
	setResult: (result: RoundResultPayload) => void;
	setCommentator: (commentator: CommentatorStatePayload) => void;
	setBuzzRejected: (reason: BuzzRejectReason | null) => void;
	resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
	game: null,
	review: null,
	result: null,
	commentator: null,
	buzzRejected: null,

	setGame: (game) => set({ game, buzzRejected: null }),
	setReview: (review) => set({ review }),
	setResult: (result) => set({ result }),
	setCommentator: (commentator) => set({ commentator }),
	setBuzzRejected: (reason) => set({ buzzRejected: reason }),
	resetGame: () =>
		set({
			game: null,
			review: null,
			result: null,
			commentator: null,
			buzzRejected: null,
		}),
}));
