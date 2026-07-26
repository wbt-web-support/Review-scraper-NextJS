import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, Check, X, Trash2, Copy, RefreshCw, Loader, Monitor, Smartphone,
  Download, Clock, HardDrive, ExternalLink, Database,
} from "lucide-react";
import { formatBytes, formatDuration } from "../lib/utils";
import { normalizeRootDomain, reviewHostFor, rootDomainFor, REVIEW_SUBDOMAIN } from "@vrm/lib/domains/domain";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ReviewVideo } from "./ReviewVideo";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type ReviewStatus = "pending" | "approved" | "rejected";
interface TenantReview {
  id: string;
  reviewer_name: string;
  reviewer_email?: string | null;
  rating: number;
  video_guid: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  transcript: string | null;
  text_review: string | null;
  type: "video" | "text";
  status: ReviewStatus;
  created_at: string;
  download_url: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  storage_label: string | null;
  storage_url: string | null;
}
export interface Bundle {
  tenant: {
    id: string; name: string; slug: string; embed_key: string; api_key: string;
    logo_url: string | null; brand_color: string; contact_email: string | null; contact_phone: string | null;
    custom_domain: string | null; custom_domain_verified: boolean;
    review_open_mode: "dialog" | "page"; max_video_seconds: number;
  };
  collection: { prompt_questions: string[]; welcome_text: string; thank_you_text: string };
  widget: { layout: "grid" | "carousel" | "single"; autoplay: boolean };
  dns: { records: { type: string; name: string; value: string }[]; serving: boolean };
  counts: Record<ReviewStatus | "all", number>;
  bunnyLibraryId: string | null;
  limits: { min: number; max: number };
}

/**
 * The tenant-management tabs. The profile page renders these in its sub-sidebar.
 *
 * Video length and API access are deliberately NOT here -- they are single, small
 * controls that don't earn a whole tab, so they live in the Overview instead (see
 * VideoTab / ApiTab, exported below).
 */
export const TENANT_TABS = [
  { key: "reviews", label: "Reviews" },
  { key: "widget", label: "Widget & embed" },
  { key: "collect", label: "Collection page" },
  { key: "branding", label: "Branding" },
  { key: "domain", label: "Custom domain" },
] as const;
export type TenantTabKey = (typeof TENANT_TABS)[number]["key"];

/** For the two controls shown in Overview rather than as their own tab. */
export const TENANT_BASE = (businessId: string) => `/api/business-urls/${businessId}/tenant`;

const VIDEO_OPTIONS = [30, 60, 90, 120, 180, 300, 600];
function formatLen(s: number) {
  if (s < 60) return `${s} seconds`;
  const m = Math.floor(s / 60), r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} sec`;
}

/**
 * Native, in-project management of a business's video-review tenant. Everything the
 * /video admin screens do -- moderation, collection copy, branding, custom domain,
 * video length, API key, embed code -- without ever leaving the scraper app or its
 * login. All calls go through /api/business-urls/[id]/tenant/*, authorized by the
 * NextAuth session and business ownership.
 *
 * Controlled: the business profile page owns the tab and renders the sub-sidebar (so
 * Overview and these tabs share one nav). This renders only the selected panel. The
 * bundle query is keyed by businessId, so the profile page can read the same cached
 * data (for the pending-review badge) without a second request.
 */
export function TenantManager({ businessId, origin, tab }: { businessId: string; origin: string; tab: TenantTabKey }) {
  const base = `/api/business-urls/${businessId}/tenant`;

  const { data: bundle, isLoading } = useQuery<Bundle>({
    queryKey: ["tenant", businessId],
    queryFn: () => apiRequest("GET", base),
  });

  if (isLoading || !bundle) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  return (
    <div className="min-w-0">
      {tab === "reviews" && <ReviewsTab base={base} businessId={businessId} bundle={bundle} />}
      {tab === "widget" && <WidgetTab base={base} businessId={businessId} bundle={bundle} origin={origin} />}
      {tab === "collect" && <CollectTab base={base} businessId={businessId} bundle={bundle} />}
      {tab === "branding" && <BrandingTab base={base} businessId={businessId} bundle={bundle} />}
      {tab === "domain" && <DomainTab base={base} businessId={businessId} bundle={bundle} />}
    </div>
  );
}

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["tenant", businessId] });
    queryClient.invalidateQueries({ queryKey: ["businessUrls"] });
  };
}

/* ---------------------------------------------------------------- Reviews */
function ReviewsTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const [status, setStatus] = useState<ReviewStatus | "all">("all");
  // Lengths measured in the browser for direct (Supabase) files, keyed by review id.
  const [durations, setDurations] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ reviews: TenantReview[] }>({
    queryKey: ["tenant-reviews", businessId, status],
    queryFn: () => apiRequest("GET", `${base}/reviews${status === "all" ? "" : `?status=${status}`}`),
  });
  const reviews = data?.reviews ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant-reviews", businessId] });
    invalidate();
  };

  const moderate = useMutation<unknown, Error, { id: string; status: ReviewStatus }>({
    mutationFn: (v) => apiRequest("PATCH", `${base}/review`, { reviewId: v.id, status: v.status }),
    onSuccess: () => { refresh(); toast({ title: "Review updated" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiRequest("DELETE", `${base}/review`, { reviewId: id }),
    onSuccess: () => { refresh(); toast({ title: "Review deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const STATUS_STYLE: Record<ReviewStatus, string> = {
    pending: "bg-amber-50 text-amber-800",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${status === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s} <span className="opacity-70">{bundle.counts[s]}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : reviews.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No {status === "all" ? "" : status} reviews.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => {
            const length = formatDuration(r.duration_seconds ?? durations[r.id]);
            const size = formatBytes(r.size_bytes);
            return (
              <div key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {r.video_guid && (
                  <div className="relative aspect-video">
                    <ReviewVideo
                      videoGuid={r.video_guid}
                      fileUrl={r.download_url}
                      thumbnailUrl={r.thumbnail_url}
                      libraryId={bundle.bunnyLibraryId}
                      reviewerName={r.reviewer_name}
                      onDuration={(d) => setDurations((m) => (m[r.id] ? m : { ...m, [r.id]: d }))}
                    />
                    <div className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</div>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-gray-900">{r.reviewer_name}</span>
                    <span className="flex shrink-0 items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-current" : "text-gray-200"}`} />
                      ))}
                    </span>
                  </div>
                  {(r.text_review || r.transcript) && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{r.text_review || r.transcript}</p>
                  )}

                  {/* Video details */}
                  {r.video_guid && (
                    <div className="mt-3 space-y-1.5 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {length ?? "—"}</span>
                        <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {size ?? "—"}</span>
                      </div>
                      {r.storage_label && (
                        <div className="flex items-center gap-1">
                          <Database className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{r.storage_label}</span>
                          {r.storage_url && (
                            <a href={r.storage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700" title="Open where it's stored">
                              open <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    {r.status !== "approved" && (
                      <Button size="sm" onClick={() => moderate.mutate({ id: r.id, status: "approved" })} className="bg-green-600 text-white hover:bg-green-700">
                        <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                    {r.download_url && (
                      <a href={`${base}/download?reviewId=${r.id}`} className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </a>
                    )}
                    <button
                      onClick={() => { if (confirm(`Delete ${r.reviewer_name}'s review and its video for good?`)) remove.mutate(r.id); }}
                      className="ml-auto inline-flex items-center rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Widget & embed */
const WIDGET_LAYOUTS: { key: "grid" | "carousel" | "single"; label: string; hint: string }[] = [
  { key: "grid", label: "Grid", hint: "A wall of reviews" },
  { key: "carousel", label: "Carousel", hint: "One row, scrolls sideways" },
  { key: "single", label: "Single", hint: "One centred column" },
];

function WidgetTab({ base, businessId, bundle, origin }: { base: string; businessId: string; bundle: Bundle; origin: string }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const embedKey = bundle.tenant.embed_key;

  const [layout, setLayout] = useState(bundle.widget.layout);
  const [autoplay, setAutoplay] = useState(bundle.widget.autoplay);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState<"main" | "target" | null>(null);

  const save = useMutation<{ message: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "widget", layout, autoplay }),
    onSuccess: (r) => { invalidate(); toast({ title: r.message ?? "Saved" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const snippet = `<script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}" async></script>`;
  const targetSnippet = `<div id="reviews-widget"></div>\n<script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}" data-target="reviews-widget" async></script>`;
  const copy = (text: string, which: "main" | "target") => {
    navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 1500);
  };

  // Runs the REAL w.js in an iframe, so the preview is exactly what visitors see.
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}</style></head><body><script src="${origin}/w.js" data-tenant="${embedKey}" data-layout="${layout}"></script></body></html>`;

  return (
    <div className="space-y-5">
      <Panel title="Widget & embed" hint="How the client's approved video reviews look on their website.">
        <Field label="Layout">
          <div className="grid gap-2 sm:grid-cols-3">
            {WIDGET_LAYOUTS.map((o) => {
              const active = layout === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setLayout(o.key)}
                  className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <span className="block text-sm font-medium text-gray-900">{o.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} className="size-4 rounded border-gray-300" />
          <span className="text-sm text-gray-700">Autoplay videos</span>
        </label>
        <SaveBar onSave={() => save.mutate()} pending={save.isPending} label="Save widget layout" />

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-1 text-sm font-medium text-gray-700">Embed code — {layout}</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">{snippet}</code>
            <Button variant="outline" onClick={() => copy(snippet, "main")}>{copied === "main" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}</Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Paste this where you want the reviews to appear. It renders in place.</p>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800">Need it to render somewhere specific on the page?</summary>
            <div className="mt-2 flex items-start gap-2">
              <code className="flex-1 overflow-x-auto whitespace-pre rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">{targetSnippet}</code>
              <Button variant="outline" onClick={() => copy(targetSnippet, "target")}>{copied === "target" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">The reviews render inside the <code>div</code>; the script can then go anywhere.</p>
          </details>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Preview</p>
              <p className="text-xs text-gray-500">Exactly what visitors see on the website.</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize ${device === d ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
                  {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />} {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4">
            <iframe
              key={`${layout}-${device}-${embedKey}`}
              srcDoc={srcDoc}
              title="Widget preview"
              sandbox="allow-scripts allow-popups allow-same-origin"
              className="rounded-lg border border-gray-200 bg-white"
              style={{ width: device === "mobile" ? 390 : "100%", height: 460 }}
            />
          </div>
        </div>
      </Panel>

      <OpenModeCard base={base} businessId={businessId} bundle={bundle} origin={origin} />
    </div>
  );
}

/* ------------------------------------------------ Leave a review button (open mode) */
function OpenModeCard({ base, businessId, bundle, origin }: { base: string; businessId: string; bundle: Bundle; origin: string }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const [mode, setMode] = useState(bundle.tenant.review_open_mode);

  const collectUrl = bundle.tenant.custom_domain && bundle.tenant.custom_domain_verified
    ? `https://${bundle.tenant.custom_domain}/c/${bundle.tenant.slug}`
    : `${origin}/c/${bundle.tenant.slug}`;

  const save = useMutation<{ message: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "openMode", mode }),
    onSuccess: () => { invalidate(); toast({ title: "Saved" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const MODES = [
    { key: "dialog" as const, label: "Open in a dialog", hint: "The visitor stays on the client's website. Best for conversion." },
    { key: "page" as const, label: "Open in a new tab", hint: "A full page, on the client's own domain if one is connected." },
  ];

  return (
    <Panel title="Leave a review button" hint="How the widget's “Leave a review” button behaves.">
      <div className="grid gap-2 sm:grid-cols-2">
        {MODES.map((o) => {
          const active = mode === o.key;
          return (
            <button key={o.key} type="button" onClick={() => setMode(o.key)} className={`rounded-lg border p-3.5 text-left transition-colors ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <span className="block text-sm font-medium text-gray-900">{o.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {mode === "page" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3">
          <p className="text-xs text-gray-500">The button will open</p>
          <p className="mt-0.5 break-all font-mono text-sm text-gray-900">{collectUrl}</p>
          {!(bundle.tenant.custom_domain && bundle.tenant.custom_domain_verified) && (
            <p className="mt-2 text-xs text-amber-700">
              This sends visitors to our domain, which they won&apos;t recognise mid-journey. Connect a custom domain to host it on the client&apos;s own domain instead.
            </p>
          )}
        </div>
      )}
      <SaveBar onSave={() => save.mutate()} pending={save.isPending} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- Collection page */
function CollectTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const [welcome, setWelcome] = useState(bundle.collection.welcome_text);
  const [thanks, setThanks] = useState(bundle.collection.thank_you_text);
  const [questions, setQuestions] = useState(bundle.collection.prompt_questions.join("\n"));

  const save = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, {
      section: "collection", welcomeText: welcome, thankYouText: thanks,
      promptQuestions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
    }),
    onSuccess: () => { invalidate(); toast({ title: "Saved" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Panel title="Collection page" hint="The words the client's customer sees when leaving a review.">
      <Field label="Welcome text"><Input value={welcome} onChange={(e) => setWelcome(e.target.value)} /></Field>
      <Field label="Thank-you text"><Input value={thanks} onChange={(e) => setThanks(e.target.value)} /></Field>
      <Field label="Prompt questions (one per line)">
        <Textarea rows={4} value={questions} onChange={(e) => setQuestions(e.target.value)} />
      </Field>
      <SaveBar onSave={() => save.mutate()} pending={save.isPending} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- Branding */
function BrandingTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const [name, setName] = useState(bundle.tenant.name);
  const [color, setColor] = useState(bundle.tenant.brand_color);
  const [logo, setLogo] = useState(bundle.tenant.logo_url ?? "");
  const [email, setEmail] = useState(bundle.tenant.contact_email ?? "");
  const [phone, setPhone] = useState(bundle.tenant.contact_phone ?? "");

  const save = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, {
      section: "branding", name, brandColor: color, logoUrl: logo, contactEmail: email, contactPhone: phone,
    }),
    onSuccess: () => { invalidate(); toast({ title: "Saved" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Panel title="Branding" hint="Shown on the collection page and the widget.">
      <Field label="Business name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Brand colour">
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-1" />
          <span className="font-mono text-xs text-gray-500">{color.toUpperCase()}</span>
        </div>
      </Field>
      <Field label="Logo URL"><Input type="url" placeholder="https://…/logo.png" value={logo} onChange={(e) => setLogo(e.target.value)} /></Field>
      <div className="flex gap-3">
        <div className="flex-1"><Field label="Contact email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
        <div className="w-44"><Field label="Contact phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field></div>
      </div>
      <SaveBar onSave={() => save.mutate()} pending={save.isPending} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- Custom domain */
function DomainTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const savedHost = bundle.tenant.custom_domain;
  const [domain, setDomain] = useState(savedHost ? rootDomainFor(savedHost) : "");

  const save = useMutation<{ message: string }, Error, string>({
    mutationFn: (rootDomain) => apiRequest("PUT", `${base}/settings`, { section: "domainSave", rootDomain }),
    onSuccess: (r) => { invalidate(); toast({ title: r.message }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const verify = useMutation<{ message: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "domainVerify" }),
    onSuccess: (r) => { invalidate(); toast({ title: r.message }); },
    onError: (e) => toast({ title: "Not verified", description: e.message, variant: "destructive" }),
  });

  // Live preview of the review host they'll get. The server re-derives it.
  const previewRoot = normalizeRootDomain(domain);
  const previewHost = previewRoot ? reviewHostFor(previewRoot) : null;
  const serving = bundle.dns.serving;

  return (
    <Panel title="Custom domain" hint="Serve the collection page on the client's own domain. Nothing serves until DNS is verified.">
      <Field label="Their website's domain">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="njdesignpark.com" spellCheck={false} autoComplete="off" />
      </Field>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3">
        <p className="text-xs text-gray-500">Their reviews will live at</p>
        <p className="mt-0.5 font-mono text-sm font-medium text-gray-900">
          {previewHost ? (
            <><span className="text-blue-600">{REVIEW_SUBDOMAIN}.</span>{previewRoot}</>
          ) : (
            <span className="text-gray-400">{REVIEW_SUBDOMAIN}.yourdomain.com</span>
          )}
        </p>
      </div>

      <Button variant="outline" onClick={() => save.mutate(domain)} disabled={save.isPending}>
        {save.isPending ? "Saving…" : savedHost ? "Update domain" : "Connect domain"}
      </Button>

      {savedHost && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className={`size-2 rounded-full ${serving ? "bg-green-500" : "bg-amber-500"}`} />
              <p className="font-mono text-sm font-medium text-gray-900">{savedHost}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${serving ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                {serving ? "Live" : bundle.tenant.custom_domain_verified ? "Finishing setup" : "Awaiting DNS"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? <Loader className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}{serving ? "Re-check" : "Verify"}
            </Button>
          </div>

          {!serving && bundle.dns.records.length > 0 && (
            <>
              <p className="mt-5 text-sm text-gray-700">
                Add {bundle.dns.records.length === 1 ? "this record" : "these records"} at the DNS provider (GoDaddy, Cloudflare, Namecheap…), then press Verify.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <tr><th className="px-3.5 py-2.5 font-medium">Type</th><th className="px-3.5 py-2.5 font-medium">Name</th><th className="px-3.5 py-2.5 font-medium">Value</th></tr>
                  </thead>
                  <tbody>
                    {bundle.dns.records.map((r) => (
                      <tr key={`${r.type}-${r.value}`} className="border-t border-gray-100">
                        <td className="px-3.5 py-2.5 font-mono text-gray-800">{r.type}</td>
                        <td className="px-3.5 py-2.5 font-mono text-gray-800">{r.name}</td>
                        <td className="px-3.5 py-2.5">
                          <button type="button" onClick={() => navigator.clipboard?.writeText(r.value)} title="Copy" className="break-all text-left font-mono text-gray-800 hover:text-blue-600">{r.value}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-gray-500">Click a value to copy it. DNS changes usually apply within minutes, but can take up to an hour.</p>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- Video length */
export function VideoTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const [seconds, setSeconds] = useState(bundle.tenant.max_video_seconds);

  const save = useMutation<{ message: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "videoLimit", maxVideoSeconds: seconds }),
    onSuccess: (r) => { invalidate(); toast({ title: r.message }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const options = useMemo(() => Array.from(new Set([...VIDEO_OPTIONS, bundle.tenant.max_video_seconds])).sort((a, b) => a - b), [bundle.tenant.max_video_seconds]);

  return (
    <Panel title="Video length" hint="The longest a customer's video review may be. Applies to new recordings only.">
      <Field label="Maximum length">
        <select className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
          {options.map((s) => <option key={s} value={s}>{formatLen(s)}</option>)}
        </select>
      </Field>
      <SaveBar onSave={() => save.mutate()} pending={save.isPending} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- API access */
export function ApiTab({ base, businessId, bundle }: { base: string; businessId: string; bundle: Bundle }) {
  const { toast } = useToast();
  const invalidate = useInvalidate(businessId);
  const [copied, setCopied] = useState(false);

  const rotate = useMutation<{ apiKey: string; message: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "apiKey" }),
    onSuccess: (r) => { invalidate(); toast({ title: r.message }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const apiKey = bundle.tenant.api_key;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${origin}/api/v1/reviews`;

  return (
    <Panel title="API access" hint="A secret key for the client's own integrations. It returns every review, including PII — keep it on their server.">
      <Field label="Endpoint">
        <code className="block overflow-x-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">GET {endpoint}</code>
      </Field>
      <Field label="API key (secret)">
        <div className="flex items-start gap-2">
          <code className="flex-1 overflow-x-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">{apiKey}</code>
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </Field>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-xs leading-relaxed text-amber-900">
          This key returns pending and rejected reviews, and reviewer email addresses. It belongs on the client&apos;s server, never in their website&apos;s JavaScript. For a public testimonial wall they want the embed widget instead, which exposes only approved reviews with no personal data.
        </p>
      </div>

      <Field label="Example">
        <pre className="overflow-x-auto rounded-md border border-gray-200 bg-gray-50 px-3.5 py-3 font-mono text-xs leading-relaxed text-gray-800">{`curl -H "Authorization: Bearer ${apiKey}" \\
  "${endpoint}?status=approved&type=video&limit=50"`}</pre>
      </Field>

      <Field label="Filters">
        <dl className="overflow-hidden rounded-lg border border-gray-200 text-xs">
          {[
            ["status", "approved (default), pending, rejected, or all"],
            ["type", "video or text. Omit for both."],
            ["limit", "1 to 100. Defaults to 50."],
            ["offset", "For paging. The response returns total."],
          ].map(([name, meaning]) => (
            <div key={name} className="flex gap-3 border-b border-gray-100 px-3.5 py-2.5 last:border-0">
              <dt className="w-16 shrink-0 font-mono text-gray-800">{name}</dt>
              <dd className="text-gray-500">{meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="pt-2 text-xs leading-relaxed text-gray-500">
          Each video carries a <code className="font-mono">play_url</code> to link or send, an <code className="font-mono">embed_url</code> for an iframe, a thumbnail, and <code className="font-mono">ready</code>, which is false while Bunny is still encoding. The raw <code className="font-mono">url</code> is an HLS playlist for a player, not a link to open.
        </p>
      </Field>

      <div className="border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={() => { if (confirm("Rotate the API key? Every integration using the current key stops working immediately.")) rotate.mutate(); }} disabled={rotate.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" /> {rotate.isPending ? "Rotating…" : "Rotate key"}
        </Button>
        <p className="mt-2 text-xs text-gray-500">The old key stops working the instant a new one is generated.</p>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- shared bits */
function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-sm text-gray-700">{label}</Label>
      {children}
    </div>
  );
}
function SaveBar({ onSave, pending, label = "Save changes" }: { onSave: () => void; pending: boolean; label?: string }) {
  return (
    <div className="flex justify-end pt-1">
      <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : label}</Button>
    </div>
  );
}
