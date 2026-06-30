import { z } from "zod";

export const AnswerSchema = z.object({
  answerId: z.string(),
  playerId: z.string(),
  categoryId: z.string(),
  value: z.string().min(1).max(30),
  valid: z.boolean(),
  mergedInto: z.string().nullable(),
  pointsPreview: z.number(),
});
