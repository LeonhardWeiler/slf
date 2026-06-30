import { z } from "zod";

export const SessionCreatedEvent = z.object({
  type: z.literal("sessionCreated"),
  payload: z.object({
    sessionId: z.string(),
    playerId: z.string(),
  }),
});

export const PlayerDisconnectedEvent = z.object({
  type: z.literal("playerDisconnected"),
  payload: z.object({
    playerId: z.string(),
  }),
});

export const PlayerReconnectedEvent = z.object({
  type: z.literal("playerReconnected"),
  payload: z.object({
    playerId: z.string(),
    sessionId: z.string(),
  }),
});
