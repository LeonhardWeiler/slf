import { z } from "zod";
import { PlayerSchema } from "./player";

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(30),
});

export const LobbyStateSchema = z.object({
  lobbyCode: z.string().length(6),
  hostId: z.string(),
  players: z.array(PlayerSchema),
  categories: z.array(CategorySchema),
  state: z.enum([
    "Lobby",
    "Countdown",
    "Playing",
    "Reviewing",
    "RoundResult",
    "GameOver",
  ]),
});
