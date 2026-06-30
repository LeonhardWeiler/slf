import { z } from "zod";

import {
  AddCategoryEvent,
  EditCategoryEvent,
  DeleteCategoryEvent,
  UpdateSettingsEvent,
} from "./lobby";

import {
  StartGameEvent,
  EndGameEvent,
  StartNextRoundEvent,
  KickPlayerEvent,
} from "./host";

import {
  SetAnswerValidityEvent,
  MergeAnswersEvent,
  UnmergeAnswersEvent,
  NextCategoryEvent,
  PreviousCategoryEvent,
  FinishReviewEvent,
} from "./review";

import { AnswerUpdateEvent, BuzzEvent } from "./game";

export const CreateLobbyEvent = z.object({
  type: z.literal("createLobby"),
  payload: z.object({
    playerName: z.string().min(1).max(20),
  }),
});

export const JoinLobbyEvent = z.object({
  type: z.literal("joinLobby"),
  payload: z.object({
    playerName: z.string().min(1).max(20),
    lobbyCode: z.string().length(6),
  }),
});

export const ReconnectEvent = z.object({
  type: z.literal("reconnect"),
  payload: z.object({}),
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

export const ClientEvents = z.discriminatedUnion("type", [
  CreateLobbyEvent,
  JoinLobbyEvent,
  ReconnectEvent,

  AnswerUpdateEvent,
  BuzzEvent,

  AddCategoryEvent,
  EditCategoryEvent,
  DeleteCategoryEvent,
  UpdateSettingsEvent,

  StartGameEvent,
  EndGameEvent,
  StartNextRoundEvent,
  KickPlayerEvent,

  SetAnswerValidityEvent,
  MergeAnswersEvent,
  UnmergeAnswersEvent,
  NextCategoryEvent,
  PreviousCategoryEvent,
  FinishReviewEvent,
  InputSyncEvent,
]);
