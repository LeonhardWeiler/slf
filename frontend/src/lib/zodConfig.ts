import { z } from "zod";

// Disable Zod's JIT-compiled validators (which use `new Function`). Under our
// strict Content-Security-Policy (`script-src` without `'unsafe-eval'`), Zod's
// eval-capability probe would trigger a CSP violation in the console on first
// parse — harmless (it is caught and Zod falls back to the interpreted path),
// but it needlessly pollutes the console and dings the Lighthouse "no console
// errors" Best-Practices check. Setting `jitless` makes Zod skip the probe and
// use the interpreted path directly, so no `new Function` is ever attempted.
//
// Imported first in main.tsx so it runs before any schema is parsed.
z.config({ jitless: true });
