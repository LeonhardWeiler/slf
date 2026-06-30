import type { z } from "zod";

/**
 * Generic Event Type (base contract)
 */
export type BaseEvent<T extends string, P> = {
  type: T;
  payload: P;
};

/**
 * Extract payload from Zod schema
 */
export type InferPayload<S> = S extends z.ZodTypeAny ? z.infer<S> : never;

/**
 * Event Map → type-safe registry
 */
export type EventMap = Record<string, z.ZodTypeAny>;

/**
 * Builds a strict event union from a map
 */
export type EventUnion<M extends EventMap> = {
  [K in keyof M]: {
    type: K;
    payload: z.infer<M[K]>;
  };
}[keyof M];

/**
 * Runtime-safe event validator registry
 */
export function createEventRouter<M extends EventMap>(map: M) {
  return {
    schemas: map,

    parse<K extends keyof M>(type: K, data: unknown) {
      return map[type].parse(data);
    },

    safeParse<K extends keyof M>(type: K, data: unknown) {
      return map[type].safeParse(data);
    },
  };
}
