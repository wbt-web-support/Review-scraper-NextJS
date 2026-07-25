import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@vrm/lib/env";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Note this factory is ASYNC. In Next 16 `cookies()` is an async function and
 * synchronous access was removed outright, not deprecated. Every call site is
 * `const supabase = await createClient()` -- which is the single most common
 * mechanical difference from the Next 14 examples you'll find online.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Throws when called during a Server Component render: HTTP cannot set
          // cookies once streaming has begun.
          //
          // Swallowing is only safe because src/proxy.ts refreshes the session on
          // every request and writes the rotated cookies there. If the proxy is
          // ever removed, these silently-dropped refreshes become random logouts
          // the moment an access token expires mid-session.
        }
      },
    },
  });
}
