import { z } from "zod";

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(20),
  isHost: z.boolean(),
  connected: z.boolean(),
  score: z.number(),
});
