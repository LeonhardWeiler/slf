import { z } from "zod";

import { LobbyStateSchema } from "../schemas/lobby";
import { GameStateSchema } from "../schemas/game";
import { RoundResultSchema } from "../schemas/round";
import { ReviewStateSchema } from "../schemas/review";
import { PlayerKickedEvent } from "./lobby";
import { AppErrorEvent } from "./system";
import { HostDisconnectedEvent, GameEndedEvent, SyncRequiredEvent } from "./system";

import {
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
} from "./session";

import { BuzzRejectedEvent } from "./game";

export const ServerEvents = z.discriminatedUnion("type", [
  LobbyStateSchema.extend({ type: z.literal("lobbyState") }),
  GameStateSchema.extend({ type: z.literal("gameState") }),
  ReviewStateSchema.extend({ type: z.literal("reviewState") }),
  RoundResultSchema.extend({ type: z.literal("roundResult") }),

  AppErrorEvent,

  HostDisconnectedEvent,
  GameEndedEvent,
  SyncRequiredEvent,

  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  PlayerKickedEvent,

  BuzzRejectedEvent,
]);
