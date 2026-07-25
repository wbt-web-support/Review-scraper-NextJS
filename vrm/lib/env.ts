/**
 * Public Supabase config.
 *
 * NEXT_PUBLIC_* vars must be referenced as full static literals -- Next inlines
 * them at build time by textual match. `process.env[key]` or a destructure
 * (`const { NEXT_PUBLIC_X } = process.env`) yields undefined in the browser.
 *
 * The service-role key is deliberately NOT here: this module is import-safe from
 * client code, and that key must never be reachable from it. It is read only
 * inside src/lib/supabase/admin.ts, which is marked `server-only`.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
  );
}
