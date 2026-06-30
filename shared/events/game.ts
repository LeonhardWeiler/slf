import { z } from "zod";

export const BuzzEvent = z.object({
  type: z.literal("buzz"),
  payload: z.object({}),
});

export const BuzzRejectedEvent = z.object({
  type: z.literal("buzzRejected"),
  payload: z.object({
    reason: z.enum([
      "incompleteAnswers",
      "alreadyBuzzed",
      "invalidState",
    ]),
  }),
});

export const AnswerUpdateEvent = z.object({
  type: z.literal("answerUpdate"),
  payload: z.object({
    categoryId: z.string(),
    value: z.string().min(1).max(30),
  }),
});

export const InputSyncEvent = z.object({
  type: z.literal("inputSync"),
  payload: z.object({
    roundId: z.string(),
    answers: z.array(
      z.object({
        categoryId: z.string(),
        value: z.string().max(30),
      })
    ),
  }),
});
