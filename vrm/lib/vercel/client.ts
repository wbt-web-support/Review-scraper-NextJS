import "@vrm/lib/server-guard";

/**
 * Vercel domain registration.
 *
 * Pointing DNS at Vercel is only half of a custom domain. Vercel will not serve --
 * or even issue a TLS certificate for -- a domain it has not been told belongs to a
 * project. Miss that step and the DNS looks perfect while the domain drops every
 * connection during the TLS handshake, which is a genuinely baffling failure to
 * debug.
 *
 * So we register the domain with Vercel ourselves, and treat "Vercel is serving it"
 * as part of what verified means. Without this the app can only ever answer "does
 * their DNS point at us?", which is not the same question as "does this work?".
 *
 * Unconfigured (local dev, self-hosting) is a supported state: every function
 * returns `{ skipped: true }` and verification falls back to a DNS-only check.
 */

const API = "https://api.vercel.com";

type VercelConfig = {
  token: string;
  projectId: string;
  teamId?: string;
};

function getConfig(): VercelConfig | null {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;

  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID };
}

export function isVercelConfigured(): boolean {
  return getConfig() !== null;
}

function query(config: VercelConfig): string {
  return config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : "";
}

async function call(path: string, config: VercelConfig, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export type AddDomainResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

/**
 * Attach a domain to the Vercel project. Idempotent.
 *
 * A domain already on THIS project is success, not an error -- re-saving the same
 * domain must not fail. A domain owned by a DIFFERENT Vercel account is a real
 * failure and needs to be surfaced, because no amount of DNS will fix it.
 */
export async function addDomainToVercel(domain: string): Promise<AddDomainResult> {
  const config = getConfig();
  if (!config) return { ok: true, skipped: true };

  const { ok, status, body } = await call(
    `/v10/projects/${encodeURIComponent(config.projectId)}/domains${query(config)}`,
    config,
    { method: "POST", body: JSON.stringify({ name: domain }) },
  );

  if (ok) return { ok: true };

  const code = (body as { error?: { code?: string; message?: string } }).error?.code;

  // Already attached to this project. That is the desired end state.
  if (code === "domain_already_in_use_by_this_project") return { ok: true };

  /**
   * `domain_already_in_use` (409) is ambiguous, and treating it as success would be
   * a real bug: it fires BOTH when the domain is already on this project (fine) and
   * when it belongs to somebody else's project (very much not fine -- we'd report
   * success on a domain we cannot serve).
   *
   * The API won't tell us which, so ask the project directly.
   */
  if (code === "domain_already_in_use" || status === 409) {
    const attached = await call(
      `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}${query(config)}`,
      config,
    );
    if (attached.ok) return { ok: true };

    return {
      ok: false,
      error: "That domain is already attached to a different Vercel project or account.",
    };
  }
  if (code === "forbidden" || status === 403) {
    return { ok: false, error: "The Vercel API token is not allowed to manage this project." };
  }

  const message =
    (body as { error?: { message?: string } }).error?.message ?? `Vercel returned ${status}`;
  return { ok: false, error: `Vercel: ${message}` };
}

/** A DNS record the client must add at their registrar. */
export type DnsRecord = {
  type: "CNAME" | "A" | "TXT";
  /** The subdomain label, e.g. "review". */
  name: string;
  value: string;
};

export type DomainStatus =
  | { skipped: true }
  | {
      skipped?: false;
      /** Vercel is serving it: attached to the project AND DNS resolves here. */
      serving: boolean;
      /** DNS is not (yet) pointing at Vercel. */
      misconfigured: boolean;
      /** Exactly what the client must add at their DNS provider. */
      records: DnsRecord[];
    };

/**
 * Pull the DNS records Vercel actually wants, rather than assuming them.
 *
 * Vercel now issues a PER-PROJECT CNAME target (c2411166de41c307.vercel-dns-016.com),
 * not the old shared cname.vercel-dns.com. A hardcoded target is therefore wrong
 * the moment they change it -- and the client would dutifully enter a value that
 * quietly never verifies. Ask the API instead, and show whatever it says.
 */
function parseRecords(
  body: Record<string, unknown>,
  subdomain: string,
  fallbackCname: string,
): DnsRecord[] {
  // The API has used a few shapes for this over time. Accept a bare string, an
  // array of strings, or an array of {value}.
  const flatten = (raw: unknown): string[] => {
    if (typeof raw === "string") return [raw];
    if (Array.isArray(raw)) {
      return raw
        .map((r) => (typeof r === "string" ? r : (r as { value?: string })?.value))
        .filter((v): v is string => typeof v === "string");
    }
    return [];
  };

  const cnames = flatten(body.recommendedCNAME);
  if (cnames.length > 0) {
    return [{ type: "CNAME", name: subdomain, value: cnames[0].replace(/\.$/, "") }];
  }

  const ips = flatten(body.recommendedIPv4);
  if (ips.length > 0) {
    return ips.map((value) => ({ type: "A" as const, name: subdomain, value }));
  }

  // Vercel told us nothing useful. Fall back to the configured target rather than
  // showing the client an empty table.
  return [{ type: "CNAME", name: subdomain, value: fallbackCname }];
}

/**
 * Is Vercel actually serving this domain, and what DNS does it want?
 *
 * `misconfigured` is Vercel's OWN DNS check -- the same question our
 * dns.resolveCname asks, but answered by the machine that has to serve the
 * request. That is the only answer that matters.
 */
export async function getVercelDomainStatus(
  domain: string,
  fallbackCname: string,
): Promise<DomainStatus> {
  const config = getConfig();
  if (!config) return { skipped: true };

  const subdomain = domain.split(".")[0];

  // Is it attached to the project at all?
  const attached = await call(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}${query(config)}`,
    config,
  );

  // Attached or not, the config endpoint still tells us what DNS it wants.
  const conf = await call(
    `/v6/domains/${encodeURIComponent(domain)}/config${query(config)}`,
    config,
  );
  const body = conf.body as Record<string, unknown>;
  const records = parseRecords(body, subdomain, fallbackCname);

  if (!attached.ok) {
    return { serving: false, misconfigured: true, records };
  }

  const misconfigured = Boolean(body.misconfigured);
  return { serving: !misconfigured, misconfigured, records };
}

/** Detach a domain, so a deleted tenant doesn't leave it squatting on the project. */
export async function removeDomainFromVercel(domain: string): Promise<void> {
  const config = getConfig();
  if (!config) return;

  await call(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}${query(config)}`,
    config,
    { method: "DELETE" },
  ).catch(() => {});
}
