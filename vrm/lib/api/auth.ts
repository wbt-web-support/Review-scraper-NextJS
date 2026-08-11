import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod/v4";
import { createAdminClient } from "@vrm/lib/supabase/admin";

/**
 * Bearer-key auth and the shared replies for /api/v1.
 *
 * Split out of api/reviews.ts when the API grew past a single read route. Every
 * endpoint resolves its caller through requireTenant and nothing else: a second
 * copy of that resolution is exactly the sort of thing that drifts out of step and
 * turns into a cross-tenant leak.
 *
 * The tenant comes from the api_key and from nothing else. No route reads a
 * caller-supplied tenant id, so there is no parameter to tamper with -- which is
 * what makes it safe for the write routes to run on the service-role client.
 */

export type ApiTenant = { id: string; name: string; slug: string };

/**
 * Resolves the bearer token to a tenant. Returns null for any bad key, without
 * distinguishing "no such key" from "malformed" -- an attacker learns nothing
 * either way.
 */
export async function tenantForApiKey(key: string | null): Promise<ApiTenant | null> {
  if (!key || !key.startsWith("vrm_")) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("api_key", key)
    .maybeSingle();

  return data ?? null;
}

/** `Authorization: Bearer vrm_...`, or the `?key=` fallback some no-code tools force. */
export function apiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return new URL(request.url).searchParams.get("key");
}

/** The caller, or null. Every /api/v1 handler starts with this line. */
export async function requireTenant(request: Request): Promise<ApiTenant | null> {
  return tenantForApiKey(apiKeyFromRequest(request));
}

/**
 * One tenant's own data, and it changes the moment they moderate something.
 * Nothing about it should sit in a shared cache.
 */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export function unauthorized() {
  return fail(
    "Invalid or missing API key. Send it as: Authorization: Bearer vrm_...",
    401,
  );
}

export function badRequest(message: string) {
  return fail(message, 400);
}

export function notFound(message: string) {
  return fail(message, 404);
}

export function serverError(message: string) {
  return fail(message, 500);
}

/** Zod's full report is for developers reading a stack trace; a caller wants one line. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request body.";
}

/**
 * Parses a JSON body, or returns the 400 to send back.
 *
 * A malformed body is a client bug worth naming: without this, `await
 * request.json()` throws and the route reports a 500, sending someone hunting for
 * a server fault that is really a missing Content-Type.
 */
export async function readJsonBody(
  request: Request,
): Promise<{ body: unknown; error?: never } | { body?: never; error: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return { error: badRequest("Body must be valid JSON.") };
  }
}
