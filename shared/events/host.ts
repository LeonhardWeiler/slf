import { z } from "zod";

export const StartGameEvent = z.object({
  type: z.literal("startGame"),
  payload: z.object({}),
});

export const EndGameEvent = z.object({
  type: z.literal("endGame"),
  payload: z.object({}),
});

export const StartNextRoundEvent = z.object({
  type: z.literal("startNextRound"),
  payload: z.object({}),
});

export const KickPlayerEvent = z.object({
  type: z.literal("kickPlayer"),
  payload: z.object({
    playerId: z.string(),
  }),
});
