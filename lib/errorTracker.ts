import { createHash } from 'crypto';

/**
 * A small, built-in error tracker. Every error the server logs, every request that
 * crashes, and every uncaught error in a teammate's browser is grouped by what it
 * is (its fingerprint), counted, and shown on the dashboard until someone marks it
 * fixed. If it happens again after that, it reopens.
 *
 * Records only on the production deployment (or with ERROR_TRACKER_LOCAL=1): the
 * local .env.local points at the production database, so local errors would
 * otherwise pollute the live list.
 *
 * Recording can never throw and never logs through console.error (which is hooked
 * to call it), so the tracker cannot cause or loop on its own errors.
 */

export type ErrorWhere = 'server' | 'browser';

export interface ErrorReport {
  where: ErrorWhere;
  error?: unknown;
  message?: string;
  /** "GET /api/widgets" on the server, the page path in a browser. */
  route?: string;
  extra?: Record<string, string | number | undefined>;
}

export interface TrackedError {
  id: string;
  where: ErrorWhere;
  message: string;
  route: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  stack: string | null;
}

const COLLECTION = process.env.ERROR_TRACKER_COLLECTION || 'app_errors';
const KEEP_DAYS = 30;
const THROTTLE_MS = 15_000;

export const trackerEnabled = () => process.env.VERCEL_ENV === 'production' || process.env.ERROR_TRACKER_LOCAL === '1';

/** Ids, numbers and quoted values vary between occurrences of the same error. */
function normalize(message: string): string {
  return message
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\b[0-9a-f]{24}\b/gi, '<id>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b[A-Za-z0-9]{17}\b(?=[^A-Za-z0-9]|$)/g, (m) => (/\d/.test(m) && /[A-Za-z]/.test(m) ? '<id>' : m))
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** The first frame of the stack, without line numbers (they change every deploy). */
function topFrame(stack: string | undefined): string {
  const line = (stack ?? '').split('\n').find((l) => l.trim().startsWith('at '));
  return line ? line.trim().replace(/:\d+:\d+\)?$/, '').replace(/\?[^\s)]*/, '') : '';
}

function describe(report: ErrorReport): { name: string; message: string; stack: string } {
  const e = report.error;
  if (e instanceof Error) {
    return { name: e.name, message: report.message ? `${report.message} ${e.message}` : e.message, stack: e.stack ?? '' };
  }
  if (typeof e === 'string') return { name: 'Error', message: report.message ? `${report.message} ${e}` : e, stack: '' };
  let rest = '';
  if (e !== undefined) {
    try { rest = JSON.stringify(e).slice(0, 300); } catch { rest = String(e); }
  }
  return { name: 'Error', message: [report.message, rest].filter(Boolean).join(' ') || 'Unknown error', stack: '' };
}

const recent = new Map<string, { at: number; pending: number }>();
const seenObjects = new WeakSet<object>();
let indexesReady = false;

async function collection() {
  const [{ default: dbConnect }, { default: mongoose }] = await Promise.all([import('./mongodb'), import('mongoose')]);
  await dbConnect();
  const coll = mongoose.connection.db!.collection(COLLECTION);
  if (!indexesReady) {
    indexesReady = true;
    await coll.createIndex({ fingerprint: 1 }, { unique: true }).catch(() => undefined);
    await coll.createIndex({ lastSeen: 1 }, { expireAfterSeconds: KEEP_DAYS * 86_400 }).catch(() => undefined);
  }
  return coll;
}

/** Record an error. Safe to call anywhere; resolves without throwing, ever. */
export async function recordError(report: ErrorReport): Promise<void> {
  try {
    if (!trackerEnabled()) return;
    if (report.error && typeof report.error === 'object') {
      if (seenObjects.has(report.error)) return; // already recorded (console + crash hook)
      seenObjects.add(report.error);
    }
    const { name, message, stack } = describe(report);
    const normalized = normalize(message);
    const fingerprint = createHash('sha1').update(`${report.where}|${normalized}|${topFrame(stack)}`).digest('hex');

    // A burst of the same error is one write: count it, and add the count to the next write.
    const now = Date.now();
    const r = recent.get(fingerprint);
    if (r && now - r.at < THROTTLE_MS) { r.pending++; return; }
    const increment = 1 + (r?.pending ?? 0);
    if (recent.size > 1000) recent.clear();
    recent.set(fingerprint, { at: now, pending: 0 });

    const coll = await collection();
    await coll.updateOne(
      { fingerprint },
      {
        $setOnInsert: { fingerprint, where: report.where, firstSeen: new Date(now) },
        $set: {
          name,
          message: message.slice(0, 1000),
          normalized,
          stack: stack.slice(0, 4000) || null,
          lastSeen: new Date(now),
          resolvedAt: null,
          ...(report.route ? { route: report.route.slice(0, 300) } : {}),
          ...(report.extra ? { extra: report.extra } : {}),
        },
        $inc: { count: increment },
      },
      { upsert: true },
    );
  } catch {
    // Never let the tracker break the thing it is watching.
  }
}

/** Open errors seen in the last `days` days, newest first. */
export async function listOpenErrors(days = 7, limit = 10): Promise<{ total: number; errors: TrackedError[] }> {
  const coll = await collection();
  const filter = { resolvedAt: null, lastSeen: { $gte: new Date(Date.now() - days * 86_400_000) } };
  const [total, rows] = await Promise.all([
    coll.countDocuments(filter),
    coll.find(filter).sort({ lastSeen: -1 }).limit(limit).toArray(),
  ]);
  return {
    total,
    errors: rows.map((r) => ({
      id: String(r._id),
      where: r.where,
      message: r.message,
      route: r.route ?? null,
      count: r.count ?? 1,
      firstSeen: new Date(r.firstSeen).toISOString(),
      lastSeen: new Date(r.lastSeen).toISOString(),
      stack: r.stack ? String(r.stack).split('\n').slice(0, 6).join('\n') : null,
    })),
  };
}

/** Mark an error fixed. It reopens by itself if it happens again. */
export async function resolveError(id: string): Promise<boolean> {
  const { Types } = await import('mongoose');
  if (!Types.ObjectId.isValid(id)) return false;
  const coll = await collection();
  const res = await coll.updateOne({ _id: new Types.ObjectId(id) }, { $set: { resolvedAt: new Date() } });
  return res.matchedCount === 1;
}

/**
 * Hooks console.error so every error the server already logs is recorded too.
 * Crawl failures are skipped: they are tracked on each business and shown in
 * their own group on the dashboard.
 */
export function captureConsoleErrors(): void {
  const flag = Symbol.for('reviewhub.consoleHooked');
  const g = globalThis as Record<symbol, unknown>;
  if (g[flag]) return;
  g[flag] = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const first = typeof args[0] === 'string' ? (args[0] as string) : '';
      if (first.startsWith('[crawler]')) return;
      const error = args.find((a) => a instanceof Error);
      const context = args.filter((a) => typeof a === 'string').join(' ').slice(0, 300);
      const other = error ? undefined : args.find((a) => a !== undefined && typeof a !== 'string');
      void recordError({ where: 'server', error: error ?? other, message: context || undefined });
    } catch {
      // ignore
    }
  };
}

/** Validates a report sent from a browser. Returns null for anything unusable. */
export function parseBrowserReport(body: unknown): { message: string; stack?: string; route?: string; userAgent?: string } | null {
  let b: unknown = body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return null; } }
  if (!b || typeof b !== 'object') return null;
  const o = b as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const message = str(o.message, 500);
  if (!message) return null;
  const url = str(o.url, 300);
  return {
    message,
    stack: str(o.stack, 4000),
    route: url ? url.split(/[?#]/)[0] : undefined,
    userAgent: str(o.userAgent, 300),
  };
}
