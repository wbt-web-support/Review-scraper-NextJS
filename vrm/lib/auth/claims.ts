export const ROLES = ["super_admin", "tenant_admin"] as const;
export type AppRole = (typeof ROLES)[number];

export type SessionClaims = {
  userId: string;
  email: string | null;
  role: AppRole | null;
  tenantId: string | null;
};

/**
 * The video product's screens live under /video, because the review scraper that
 * shares this app already owns /, /login and /dashboard. Only the LOGGED-IN screens
 * moved: /c/[slug], /s/[subdomain], /d/[host], /w.js and the public APIs stay at the
 * root, so every embed and QR code already out in the world keeps working.
 *
 * Everything that links or redirects within the video app builds its path from
 * these, so there is one place to change if the prefix ever moves again.
 */
export const VIDEO_BASE = "/video";

export const VIDEO_ROUTES = {
  login: `${VIDEO_BASE}/login`,
  admin: `${VIDEO_BASE}/admin`,
  dashboard: `${VIDEO_BASE}/dashboard`,
  tenant: (id: string) => `${VIDEO_BASE}/admin/tenants/${id}`,
} as const;

/** Where each role lands after login. */
export const HOME_FOR_ROLE: Record<AppRole, string> = {
  super_admin: VIDEO_ROUTES.admin,
  tenant_admin: VIDEO_ROUTES.dashboard,
};

function isRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/**
 * Reads the claims injected by the Postgres custom_access_token_hook, which
 * nests them under app_metadata.
 *
 * Everything is null-tolerant on purpose. If the hook is not enabled in the
 * Supabase dashboard, tokens simply arrive without these claims -- and the whole
 * auth layer must then fail CLOSED (role: null -> bounced to /login) rather than
 * defaulting to some role. `npm run seed` self-tests for exactly that condition.
 */
export function parseClaims(
  raw: Record<string, unknown>,
): SessionClaims | null {
  const sub = raw.sub;
  if (typeof sub !== "string") return null;

  const appMetadata = (raw.app_metadata ?? {}) as Record<string, unknown>;
  const role = appMetadata.user_role;
  const tenantId = appMetadata.tenant_id;

  return {
    userId: sub,
    email: typeof raw.email === "string" ? raw.email : null,
    role: isRole(role) ? role : null,
    tenantId: typeof tenantId === "string" ? tenantId : null,
  };
}
