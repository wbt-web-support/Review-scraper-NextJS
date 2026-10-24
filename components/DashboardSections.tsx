import Link from "next/link";
import {
  AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock, Copy, Link2Off, MessageSquareText, XCircle,
  PlayCircle, Star, ThumbsUp, TrendingUp, Video,
} from "lucide-react";
import type { DashboardOverview, DashboardBusiness, DashboardReview, DashboardVideoReview, DashboardIssues } from "../lib/dashboard";

/* ------------------------------------------------------------------ helpers */

const fmt = (n: number) => n.toLocaleString("en-GB");
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s);

/** "3 days ago" for real dates; stored text dates ("2 weeks ago") pass through. */
export function timeAgo(value: string | null): string {
  if (!value) return "never";
  if (!isIso(value)) return value;
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return "just now";
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />
      ))}
    </span>
  );
}

function SourceBadge({ source }: { source: "google" | "facebook" }) {
  return source === "google"
    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Google</span>
    : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">Facebook</span>;
}

function Section({ title, hint, href, linkLabel = "View all", children }: { title: string; hint?: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

/* ------------------------------------------------------------------ briefing */

function BriefingCard({ icon: Icon, tint, label, value, sub }: { icon: typeof Star; tint: string; label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}><Icon className="h-[18px] w-[18px]" /></span>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function Briefing({ data }: { data: DashboardOverview["briefing"] | undefined }) {
  if (!data) {
    return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[124px]" />)}</div>;
  }
  const { clients, reviews, averageRating, crawl } = data;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BriefingCard
          icon={Building2}
          tint="bg-blue-50 text-blue-600"
          label="Clients"
          value={fmt(clients.total)}
          sub={<>
            {fmt(clients.google)} Google · {fmt(clients.facebook)} Facebook
            {clients.duplicateEntries > 0 && (
              <span className="mt-0.5 block text-amber-700" title={`${fmt(clients.entries)} business entries in total. Some listings were added more than once; each is counted once here.`}>
                {fmt(clients.duplicateEntries)} duplicate entries, counted once
              </span>
            )}
          </>}
        />
        <BriefingCard icon={MessageSquareText} tint="bg-violet-50 text-violet-600" label="Total reviews" value={fmt(reviews.total)} sub={`${fmt(reviews.google)} Google · ${fmt(reviews.facebook)} Facebook`} />
        <BriefingCard icon={TrendingUp} tint="bg-emerald-50 text-emerald-600" label="New in the last 30 days" value={fmt(reviews.last30Days)} sub="Reviews posted across all clients" />
        <BriefingCard icon={Star} tint="bg-amber-50 text-amber-600" label="Average rating" value={averageRating ? averageRating.toFixed(2) : "–"} sub={<span className="inline-flex items-center gap-1.5">{averageRating ? <Stars rating={averageRating} size={12} /> : null} Google reviews</span>} />
      </div>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${crawl.failing || crawl.due ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <span className="inline-flex items-center gap-1.5 font-medium">
          {crawl.failing || crawl.due ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          Review crawling
        </span>
        <span>{fmt(crawl.upToDate)} clients up to date</span>
        {crawl.due > 0 && <span>{fmt(crawl.due)} waiting their turn</span>}
        {crawl.failing > 0 && (
          <a href="#issues" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-amber-950">
            <AlertTriangle className="h-3.5 w-3.5" />{fmt(crawl.failing)} failing, see why
          </a>
        )}
        <span className="text-xs opacity-75">Last crawl {timeAgo(crawl.lastCrawlAt)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ top clients */

export function TopClients({ businesses }: { businesses: DashboardBusiness[] | undefined }) {
  const max = Math.max(1, ...(businesses ?? []).map((b) => b.reviews));
  return (
    <Section title="Clients with the most reviews" hint="Counted the way their widgets count them" href="/reviews">
      {!businesses ? (
        <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : businesses.length === 0 ? (
        <p className="text-sm text-gray-500">No clients yet.</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {businesses.map((b, i) => (
            <li key={`${b.id}-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-5 shrink-0 text-right text-sm font-medium tabular-nums text-gray-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/reviews/${b.id}`} className="truncate text-sm font-medium text-gray-900 hover:text-blue-600">{b.name}</Link>
                  <SourceBadge source={b.source} />
                  {b.duplicateEntries > 0 && (
                    <span className="hidden shrink-0 text-[11px] text-gray-400 sm:inline" title="The same listing was added as more than one client entry">
                      +{b.duplicateEntries} duplicate {b.duplicateEntries === 1 ? "entry" : "entries"}
                    </span>
                  )}
                  {b.failing && <span title="Last crawl failed"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" /></span>}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, (b.reviews / max) * 100)}%` }} />
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-900">{fmt(b.reviews)}</p>
                <p className="text-[11px] text-gray-500">{b.averageRating ? `${b.averageRating.toFixed(1)} ★` : "reviews"}</p>
              </div>
              <div className="hidden w-24 shrink-0 text-right sm:block">
                <p className={`text-sm tabular-nums ${b.newReviews ? "font-medium text-emerald-600" : "text-gray-400"}`}>+{fmt(b.newReviews)}</p>
                <p className="text-[11px] text-gray-500">last 30 days</p>
              </div>
              <div className="hidden w-28 shrink-0 text-right md:block">
                <p className="text-sm text-gray-700">{timeAgo(b.lastCrawledAt)}</p>
                <p className="text-[11px] text-gray-500">last crawl</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ latest reviews */

export function LatestReviews({ reviews }: { reviews: DashboardReview[] | undefined }) {
  return (
    <Section title="Latest reviews" hint="Newest across all clients">
      {!reviews ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-500">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r, i) => (
            <li key={`${r.businessId}-${r.postedAt}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                {r.businessId
                  ? <Link href={`/reviews/${r.businessId}`} className="truncate text-xs font-semibold text-gray-900 hover:text-blue-600">{r.businessName}</Link>
                  : <span className="truncate text-xs font-semibold text-gray-900">{r.businessName}</span>}
                <SourceBadge source={r.source} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {r.rating !== null
                  ? <Stars rating={r.rating} size={12} />
                  : r.recommended !== null && <span className="inline-flex items-center gap-1 text-[11px] text-gray-600"><ThumbsUp className="h-3 w-3" />{r.recommended ? "Recommends" : "Doesn't recommend"}</span>}
                <span className="truncate text-[11px] text-gray-500">{r.author} · {timeAgo(r.postedAt)}</span>
              </div>
              {r.content && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-700">{r.content}</p>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ video reviews */

const STATUS_STYLE: Record<DashboardVideoReview["status"], string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-gray-100 text-gray-600 ring-gray-200",
};

function VideoStat({ label, value, tone = "text-gray-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <p className={`text-xl font-semibold tabular-nums ${tone}`}>{fmt(value)}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function VideoReviews({ video }: { video: DashboardOverview["video"] | undefined }) {
  return (
    <Section title="Video reviews" hint="Collected through each client's review page" href="/video-reviews" linkLabel="Manage">
      {!video ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <VideoStat label="Clients with video" value={video.businesses} />
            <VideoStat label="Reviews collected" value={video.reviews} />
            <VideoStat label="Waiting for approval" value={video.pending} tone={video.pending ? "text-amber-600" : "text-gray-900"} />
            <VideoStat label="Approved and live" value={video.approved} tone="text-emerald-600" />
          </div>

          {video.reviews === 0 ? (
            <p className="text-sm text-gray-500">No video reviews collected yet.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Latest</h3>
                <ul className="divide-y divide-gray-100">
                  {video.latest.map((r, i) => (
                    <li key={`${r.createdAt}-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-900 text-white">
                        {r.thumbnailUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          : r.type === "video" ? <PlayCircle className="h-5 w-5 opacity-80" /> : <MessageSquareText className="h-4 w-4 opacity-80" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{r.reviewerName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {r.businessId ? <Link href={`/video-reviews/${r.businessId}`} className="hover:text-blue-600">{r.businessName}</Link> : r.businessName} · {timeAgo(r.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <Stars rating={r.rating} size={12} />
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 lg:col-span-2">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Most video reviews</h3>
                <ul className="space-y-2">
                  {video.topBusinesses.map((b, i) => (
                    <li key={`${b.businessId}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Video className="h-4 w-4 shrink-0 text-violet-500" />
                        {b.businessId ? <Link href={`/video-reviews/${b.businessId}`} className="truncate text-sm text-gray-900 hover:text-blue-600">{b.name}</Link> : <span className="truncate text-sm text-gray-900">{b.name}</span>}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-gray-700">
                        {fmt(b.reviews)}{b.pending > 0 && <span className="ml-1.5 text-xs text-amber-600">{b.pending} pending</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}


/* ------------------------------------------------------------------ errors and issues */

/** "in 3 hours" / "3 hours ago" for a timestamp either side of now. */
function relative(value: string | null): string {
  return value ? timeAgo(value) : "–";
}

function IssueGroup({ icon: Icon, tone, title, children }: { icon: typeof Star; tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3">
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}><Icon className="h-4 w-4 shrink-0" />{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export function Issues({ issues }: { issues: DashboardIssues | undefined }) {
  const total = issues ? issues.crawlFailures.length + issues.invalidLinks.length + (issues.duplicates.extraEntries > 0 ? 1 : 0) + (issues.lateCrawls.count > 0 ? 1 : 0) + (issues.pendingVideo > 0 ? 1 : 0) : 0;
  return (
    <div id="issues" className="scroll-mt-6">
      <Section title="Errors and issues" hint={issues && total === 0 ? undefined : "What needs attention, and what to do"}>
        {!issues ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : total === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Nothing needs attention. Every client is crawling normally.</p>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
            {issues.crawlFailures.length > 0 && (
              <IssueGroup icon={XCircle} tone="text-red-700" title={`${issues.crawlFailures.length} ${issues.crawlFailures.length === 1 ? "client is" : "clients are"} failing to crawl`}>
                {issues.crawlFailures.map((f) => (
                  <div key={f.businessId} className="rounded-lg bg-red-50/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/reviews/${f.businessId}`} className="truncate text-xs font-semibold text-gray-900 hover:text-blue-600">{f.name}</Link>
                      <SourceBadge source={f.source} />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-800" title={f.detail}>{f.problem}</p>
                    <p className="mt-1 truncate text-[11px] text-gray-500" title={`${f.url}\n\n${f.detail}`}>
                      Failed {f.failures}× · next try {relative(f.retryAt)} · <span className="text-gray-400">{f.url}</span>
                    </p>
                  </div>
                ))}
              </IssueGroup>
            )}

            {issues.invalidLinks.length > 0 && (
              <IssueGroup icon={Link2Off} tone="text-amber-700" title={`${issues.invalidLinks.length} ${issues.invalidLinks.length === 1 ? "client has" : "clients have"} no crawlable link`}>
                <p className="text-xs leading-relaxed text-gray-700">Their saved link isn&apos;t a listing, so their reviews aren&apos;t crawled. Paste the listing link to start. A client that only uses video reviews needs nothing.</p>
                <ul className="space-y-1.5">
                  {issues.invalidLinks.map((l) => (
                    <li key={l.businessId} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/reviews/${l.businessId}`} className="truncate text-gray-900 hover:text-blue-600">{l.name}</Link>
                        {l.hasVideo && <span className="shrink-0 text-[11px] text-violet-600">has video reviews</span>}
                      </div>
                      <p className="truncate text-[11px] text-gray-400" title={l.url}>{l.url}</p>
                    </li>
                  ))}
                </ul>
              </IssueGroup>
            )}

            {issues.duplicates.extraEntries > 0 && (
              <IssueGroup icon={Copy} tone="text-amber-700" title={`${fmt(issues.duplicates.extraEntries)} duplicate client entries`}>
                <p className="text-xs leading-relaxed text-gray-700">
                  The same listing added more than once. All of them keep working; the only cost is that each copy is crawled, and paid for, separately. The counts above include each listing once.
                </p>
                <ul className="space-y-1">
                  {issues.duplicates.examples.map((d) => (
                    <li key={d.businessId} className="flex items-center justify-between gap-2 text-xs">
                      <Link href={`/reviews/${d.businessId}`} className="truncate text-gray-900 hover:text-blue-600">{d.name}</Link>
                      <span className="shrink-0 text-gray-500">{d.entries} entries</span>
                    </li>
                  ))}
                </ul>
              </IssueGroup>
            )}

            {(issues.lateCrawls.count > 0 || issues.pendingVideo > 0) && (
            <div className="min-w-0 space-y-3">
            {issues.lateCrawls.count > 0 && (
              <IssueGroup icon={Clock} tone="text-amber-700" title={`${fmt(issues.lateCrawls.count)} ${issues.lateCrawls.count === 1 ? "client is" : "clients are"} late for a crawl`}>
                <p className="text-xs text-gray-700">More than a day past their schedule. The crawler works through the most overdue first, so this should clear on its own.</p>
                <ul className="space-y-1">
                  {issues.lateCrawls.examples.map((l) => (
                    <li key={l.businessId} className="flex items-center justify-between gap-2 text-xs">
                      <Link href={`/reviews/${l.businessId}`} className="truncate text-gray-900 hover:text-blue-600">{l.name}</Link>
                      <span className="shrink-0 text-gray-500">last crawl {relative(l.lastCrawledAt)}</span>
                    </li>
                  ))}
                </ul>
              </IssueGroup>
            )}

            {issues.pendingVideo > 0 && (
              <IssueGroup icon={Video} tone="text-blue-700" title={`${fmt(issues.pendingVideo)} video ${issues.pendingVideo === 1 ? "review is" : "reviews are"} waiting for approval`}>
                <Link href="/video-reviews" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">Review them <ArrowRight className="h-3 w-3" /></Link>
              </IssueGroup>
            )}
            </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
