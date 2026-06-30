import { z } from "zod";

export const RoundResultSchema = z.object({
  letter: z.string().length(1),
  scores: z.array(
    z.object({
      playerId: z.string(),
      roundPoints: z.number(),
      totalPoints: z.number(),
    })
  ),
});
