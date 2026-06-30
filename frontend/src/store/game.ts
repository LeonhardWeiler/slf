import { create } from "zustand";
import type {
  GameStatePayload,
  ReviewStatePayload,
  RoundResultPayload,
  BuzzRejectReason,
} from "@/types/events";

interface GameStore {
  game: GameStatePayload | null;
  review: ReviewStatePayload | null;
  result: RoundResultPayload | null;
  buzzRejected: BuzzRejectReason | null;

  setGame: (game: GameStatePayload) => void;
  setReview: (review: ReviewStatePayload) => void;
  setResult: (result: RoundResultPayload) => void;
  setBuzzRejected: (reason: BuzzRejectReason | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  review: null,
  result: null,
  buzzRejected: null,

  setGame: (game) => set({ game, buzzRejected: null }),
  setReview: (review) => set({ review }),
  setResult: (result) => set({ result }),
  setBuzzRejected: (reason) => set({ buzzRejected: reason }),
  resetGame: () => set({ game: null, review: null, result: null, buzzRejected: null }),
}));
