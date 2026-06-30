import { z } from "zod";
import { ClientEvents } from "../events/clientToServer";
import { ServerEvents } from "../events/serverToClient";

export type ClientEvent = z.infer<typeof ClientEvents>;
export type ServerEvent = z.infer<typeof ServerEvents>;
