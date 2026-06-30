import { z } from "zod";

export const AddCategoryEvent = z.object({
  type: z.literal("addCategory"),
  payload: z.object({
    name: z.string().min(1).max(30),
  }),
});

export const EditCategoryEvent = z.object({
  type: z.literal("editCategory"),
  payload: z.object({
    categoryId: z.string(),
    name: z.string().min(1).max(30),
  }),
});

export const DeleteCategoryEvent = z.object({
  type: z.literal("deleteCategory"),
  payload: z.object({
    categoryId: z.string(),
  }),
});

export const UpdateSettingsEvent = z.object({
  type: z.literal("updateSettings"),
  payload: z.object({
    timeLimit: z.number().nullable(),
    showLetterDuringCountdown: z.boolean(),
    excludedLetters: z.array(z.string().length(1)),
  }),
});

export const PlayerKickedEvent = z.object({
  type: z.literal("playerKicked"),
  payload: z.object({
    playerId: z.string(),
  }),
});

export const LeaveLobbyEvent = z.object({
  type: z.literal("leaveLobby"),
  payload: z.object({}),
});

export const LobbyClosedEvent = z.object({
  type: z.literal("lobbyClosed"),
  payload: z.object({
    reason: z.enum(["hostLeft"]),
  }),
});
