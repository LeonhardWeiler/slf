import { z } from "zod";
import { AnswerSchema } from "./answer";

export const ReviewStateSchema = z.object({
  categoryId: z.string(),
  answers: z.array(AnswerSchema),
});
