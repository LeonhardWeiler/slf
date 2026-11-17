import { z } from "zod/mini";

// jitless skips Zod's `new Function` probe, which the CSP (no 'unsafe-eval') reports as a violation.
// Imported first in main.tsx so it runs before any schema is parsed.
z.config({ jitless: true });
