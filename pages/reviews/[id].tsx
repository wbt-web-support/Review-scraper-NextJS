import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCcw, Download, Loader, Pencil, MapPin, ExternalLink, MessageSquare,
} from "lucide-react";
import Layout from "../../components/Layout";
import ReviewTable from "../../components/ReviewTable";
import { Button } from "../../components/ui/button";
import { EditBusinessDialog } from "../../components/EditBusinessDialog";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";

/**
 * A human-readable address out of a Google/Facebook business URL, best-effort. A raw
 * maps URL is noise on a profile header, so pull the place or destination out of it
 * and show that instead, with the URL kept only behind the "Google Maps" link. Falls
 * back to null (caller then hides the address line) rather than showing the raw URL.
 */
function readableAddress(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const fromParam = url.searchParams.get("daddr") || url.searchParams.get("destination") || url.searchParams.get("q");
    if (fromParam && !/^-?\d+\.\d+,/.test(fromParam)) {
      return clean(fromParam);
    }
    const placeMatch = url.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) return clean(placeMatch[1]);
    return null;
  } catch {
    return null;
  }
}
function clean(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();
}

interface IBusinessDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}
interface IBusinessUrl {
  _id: string;
  name: string;
  url: string;
  urlHash: string;
  source: "google" | "facebook";
  details?: IBusinessDetails;
}
interface IReviewItem {
  _id?: string;
  reviewId?: string;
  author: string;
  content?: string | null;
  rating?: number | null;
  postedAt?: string;
  source?: "google" | "facebook";
}

/**
 * A single business's profile: its scraped Google/Facebook reviews. Video testimonials
 * live in their own section (/video-reviews) as separate businesses.
 */
export default function BusinessProfile() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery<{ businessUrls: IBusinessUrl[] }>({
    queryKey: ["businessUrls"],
    queryFn: () => apiRequest("GET", "/api/business-urls/all"),
  });

  const business = useMemo(
    () => (data?.businessUrls ?? []).find((b) => b._id === id),
    [data, id],
  );

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{ reviews: IReviewItem[] }>({
    queryKey: ["reviews", id],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/business-urls/by-urlhash/${business!.urlHash}/${business!.source}/reviews`,
      ),
    enabled: Boolean(business?.urlHash),
  });
  const reviews = reviewsData?.reviews ?? [];

  const scrapeMutation = useMutation<{ message: string }, Error, void>({
    mutationFn: () => apiRequest("POST", `/api/business-urls/${id}/scrape?manual=true`),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", id] });
      toast({ title: "Scraping started", description: r?.message ?? "Review scraping started." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="h-40 animate-pulse rounded bg-gray-100" />
        </div>
      </Layout>
    );
  }

  if (!business) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link href="/reviews" className="text-sm text-gray-500 hover:text-gray-900">← Businesses</Link>
          <p className="mt-6 text-gray-500">This business could not be found.</p>
        </div>
      </Layout>
    );
  }

  const address = readableAddress(business.url);
  const sourceLabel = business.source === "google" ? "Google Maps" : "Facebook";

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/reviews" className="hover:text-gray-900">Businesses</Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-900">{titleCaseName(business.name)}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{titleCaseName(business.name)}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-gray-500">
                {address && <span>{address}</span>}
                <a href={business.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700">
                  {sourceLabel} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button onClick={() => scrapeMutation.mutate()} disabled={scrapeMutation.isPending} className="bg-gray-900 text-white hover:bg-gray-800">
              {scrapeMutation.isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Fetch reviews
            </Button>
          </div>
        </div>

        {/* Contact */}
        {(business.details?.firstName || business.details?.lastName || business.details?.email || business.details?.phone) && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Contact</h2>
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {(business.details.firstName || business.details.lastName) && (
                <Detail label="Name" value={[business.details.firstName, business.details.lastName].filter(Boolean).join(" ")} />
              )}
              {business.details.email && <Detail label="Email" value={business.details.email} />}
              {business.details.phone && <Detail label="Mobile" value={business.details.phone} />}
            </div>
          </section>
        )}

        {/* Scraped reviews */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              Scraped reviews
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{reviews.length}</span>
            </h2>
            <Button variant="outline" size="sm" onClick={() => scrapeMutation.mutate()} disabled={scrapeMutation.isPending}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Recrawl
            </Button>
          </div>
          {reviews.length === 0 && !reviewsLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="mt-3 font-medium text-gray-900">No reviews scraped yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Run a crawl to pull this business&apos;s public {sourceLabel} reviews into ReviewHub.
              </p>
            </div>
          ) : (
            <ReviewTable
              reviews={reviews}
              isLoading={reviewsLoading}
              urlHash={business.urlHash}
              onReviewDeleted={() => queryClient.invalidateQueries({ queryKey: ["reviews", id] })}
              emptyState={<div className="py-8 text-center text-gray-500">No reviews scraped yet.</div>}
            />
          )}
        </section>
      </div>

      {/* Edit business */}
      <EditBusinessDialog business={business} open={editOpen} onOpenChange={setEditOpen} />
    </Layout>
  );
}

/** A labelled value, label above (the profile's contact layout). */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
