import { z } from "zod";

export const GameStateSchema = z.object({
  roundId: z.string(),
  letter: z.string().length(1),
  usedLetters: z.array(z.string()),
  remainingLetters: z.array(z.string()),
  timeRemaining: z.number().nullable(),
});
