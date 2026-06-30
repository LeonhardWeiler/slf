import { z } from "zod";

export const SystemStateSchema = z.object({
  ok: z.boolean(),
});
