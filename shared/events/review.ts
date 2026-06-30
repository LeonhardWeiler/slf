import { z } from "zod";

export const SetAnswerValidityEvent = z.object({
  type: z.literal("setAnswerValidity"),
  payload: z.object({
    answerId: z.string(),
    valid: z.boolean(),
  }),
});

export const MergeAnswersEvent = z.object({
  type: z.literal("mergeAnswers"),
  payload: z.object({
    targetAnswerId: z.string(),
    sourceAnswerId: z.string(),
  }),
});

export const UnmergeAnswersEvent = z.object({
  type: z.literal("unmergeAnswers"),
  payload: z.object({
    answerId: z.string(),
  }),
});

export const NextCategoryEvent = z.object({
  type: z.literal("nextCategory"),
  payload: z.object({}),
});

export const PreviousCategoryEvent = z.object({
  type: z.literal("previousCategory"),
  payload: z.object({}),
});

export const FinishReviewEvent = z.object({
  type: z.literal("finishReview"),
  payload: z.object({}),
});
