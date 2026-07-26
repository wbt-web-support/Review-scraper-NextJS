import { useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video, Star, Check, X, Trash2, Download, LogOut, Clock, CheckCircle2, XCircle, FileDown, HardDrive,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { bunnyPlayUrl } from "@vrm/lib/bunny/urls";
import { ReviewVideo } from "../components/ReviewVideo";
import { ClientSettings } from "../components/ClientSettings";
import { formatBytes, formatDuration } from "../lib/utils";

type ReviewStatus = "pending" | "approved" | "rejected";

interface TenantReview {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
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
}

interface Bundle {
  tenant: {
    id: string; name: string; logo_url: string | null; brand_color: string;
    contact_email: string | null; contact_phone: string | null; max_video_seconds: number;
  };
  collection: { welcome_text: string; description: string; thank_you_text: string; prompt_questions: string[] };
  counts: Record<ReviewStatus | "all", number>;
  bunnyLibraryId: string | null;
  limits: { min: number; max: number };
}

type Filter = "all" | ReviewStatus;

const FILTERS: { key: Filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: Video },
  { key: "pending", label: "Pending", icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
];

export default function MyReviews() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("all");
  const [deleteTarget, setDeleteTarget] = useState<TenantReview | null>(null);
  const [view, setView] = useState<"reviews" | "settings">("reviews");

  const role = session?.user?.role;
  const businessId = session?.user?.videoBusinessId ?? "";

  // Guard: only clients belong here. Operators go to their app; anyone else to login.
  if (status === "unauthenticated") { if (typeof window !== "undefined") router.replace("/login"); }
  if (status === "authenticated" && role !== "client") { if (typeof window !== "undefined") router.replace("/dashboard"); }

  const base = businessId ? `/api/business-urls/${businessId}/tenant` : "";

  const { data: bundle } = useQuery<Bundle>({
    queryKey: ["myTenant", businessId],
    queryFn: () => apiRequest("GET", base),
    enabled: Boolean(businessId) && role === "client",
  });

  const { data: reviewsData, isLoading } = useQuery<{ reviews: TenantReview[] }>({
    queryKey: ["myReviews", businessId, filter],
    queryFn: () => apiRequest("GET", `${base}/reviews${filter === "all" ? "" : `?status=${filter}`}`),
    enabled: Boolean(businessId) && role === "client",
  });
  const reviews = useMemo(() => reviewsData?.reviews ?? [], [reviewsData]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["myReviews", businessId] });
    queryClient.invalidateQueries({ queryKey: ["myTenant", businessId] });
  };

  const statusMutation = useMutation<void, Error, { reviewId: string; status: ReviewStatus }>({
    mutationFn: ({ reviewId, status }) => apiRequest("PATCH", `${base}/review`, { reviewId, status }),
    onSuccess: (_d, v) => { refresh(); toast({ title: v.status === "approved" ? "Review approved" : "Review rejected" }); },
    onError: (e) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (reviewId) => apiRequest("DELETE", `${base}/review`, { reviewId }),
    onSuccess: () => { refresh(); setDeleteTarget(null); toast({ title: "Review deleted" }); },
    onError: (e) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  const exportCsv = () => {
    const rows = [
      ["Reviewer", "Email", "Rating", "Status", "Date", "Transcript / Text", "Video URL"],
      ...reviews.map((r) => [
        r.reviewer_name,
        r.reviewer_email ?? "",
        String(r.rating ?? ""),
        r.status,
        new Date(r.created_at).toISOString(),
        (r.transcript || r.text_review || "").replace(/\s+/g, " ").trim(),
        r.video_url ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviews-${filter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading" || (status === "authenticated" && role !== "client")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const brand = bundle?.tenant.brand_color || "#4f46e5";
  const businessName = bundle ? titleCaseName(bundle.tenant.name) : "My Reviews";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* No Referer on this page's requests, so Bunny's hotlink protection doesn't 403
          the video files (it blocks a referer not on the Allowed-domains list). */}
      <Head><meta name="referrer" content="no-referrer" /></Head>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {bundle?.tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bundle.tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 bg-white object-contain" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: brand }}>
                <Video className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold">{businessName}</div>
              <div className="text-xs text-gray-400">Video reviews</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* View switch: reviews vs settings */}
        <div className="mb-6 flex w-fit gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["reviews", "settings"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={view === v ? { backgroundColor: brand } : undefined}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? "text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view === "settings" ? (
          bundle ? (
            <ClientSettings base={base} businessId={businessId} bundle={bundle} />
          ) : (
            <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
          )
        ) : (
        <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Your reviews</h1>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={reviews.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Filter tabs with counts */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count = bundle?.counts[f.key] ?? 0;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={active ? { backgroundColor: brand, borderColor: brand } : undefined}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? "text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <f.icon className="h-4 w-4" />
                {f.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Reviews */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Video className="h-6 w-6" />
            </div>
            <p className="mt-3 font-medium">No {filter === "all" ? "" : filter} reviews yet</p>
            <p className="mt-1 text-sm text-gray-500">Video reviews your customers submit will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                base={base}
                libraryId={bundle?.bunnyLibraryId ?? null}
                busy={statusMutation.isPending || deleteMutation.isPending}
                onApprove={() => statusMutation.mutate({ reviewId: r.id, status: "approved" })}
                onReject={() => statusMutation.mutate({ reviewId: r.id, status: "rejected" })}
                onDelete={() => setDeleteTarget(r)}
              />
            ))}
          </div>
        )}
        </>
        )}
      </main>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.reviewer_name}&apos;s review and its video. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}>{status}</span>;
}

function ReviewCard({
  review, base, libraryId, busy, onApprove, onReject, onDelete,
}: {
  review: TenantReview;
  base: string;
  libraryId: string | null;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  const text = review.transcript || review.text_review;
  // A real downloadable file (marketing copy). Falls back to the Bunny play page only
  // if there's no file yet (e.g. still encoding), so the button is never dead.
  const downloadUrl = review.download_url;
  const openUrl = !downloadUrl && review.video_guid && libraryId
    ? bunnyPlayUrl(libraryId, review.video_guid)
    : null;
  const length = formatDuration(review.duration_seconds ?? duration);
  const size = formatBytes(review.size_bytes);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Media */}
      <div className="relative aspect-video">
        <ReviewVideo
          videoGuid={review.video_guid}
          fileUrl={review.download_url}
          thumbnailUrl={review.thumbnail_url}
          libraryId={libraryId}
          reviewerName={review.reviewer_name}
          onDuration={setDuration}
        />
        <div className="absolute right-2 top-2 z-10"><StatusBadge status={review.status} /></div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{review.reviewer_name}</div>
            {review.reviewer_email && <div className="truncate text-xs text-gray-400">{review.reviewer_email}</div>}
          </div>
          {review.rating > 0 && (
            <div className="flex shrink-0 items-center gap-0.5 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-current" : "text-gray-200"}`} />
              ))}
            </div>
          )}
        </div>
        {text && <p className="mt-2 line-clamp-3 text-sm text-gray-600">{text}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
          <span>{new Date(review.created_at).toLocaleDateString()}</span>
          {length && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {length}</span>}
          {size && <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" /> {size}</span>}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {review.status !== "approved" && (
            <Button size="sm" onClick={onApprove} disabled={busy} className="bg-green-600 text-white hover:bg-green-700">
              <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {review.status !== "rejected" && (
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Reject
            </Button>
          )}
          {downloadUrl ? (
            <a
              href={`${base}/download?reviewId=${review.id}`}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </a>
          ) : openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Open
            </a>
          ) : null}
          <button
            onClick={onDelete}
            disabled={busy}
            className="ml-auto inline-flex items-center rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
