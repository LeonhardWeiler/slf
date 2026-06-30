import { z } from "zod";

export const HostDisconnectedEvent = z.object({
  type: z.literal("hostDisconnected"),
  payload: z.object({
    timeoutMs: z.number(), // always 30000
  }),
});

export const GameEndedEvent = z.object({
  type: z.literal("gameEnded"),
  payload: z.object({
    reason: z.enum([
      "hostEnded",
      "alphabetExhausted",
      "hostTimeout",
    ]),
  }),
});

export const SyncRequiredEvent = z.object({
  type: z.literal("syncRequired"),
  payload: z.object({
    reason: z.string(),
  }),
});

export const AppErrorEvent = z.object({
  type: z.literal("error"),
  payload: z.object({
    message: z.string(),
  }),
});
