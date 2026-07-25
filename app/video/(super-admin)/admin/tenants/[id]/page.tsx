import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireRole } from "@vrm/lib/auth/dal";
import { getTenantSettings } from "@vrm/lib/settings/queries";
import { createClient } from "@vrm/lib/supabase/server";
import { impersonateTenant } from "@vrm/lib/tenants/actions";
import { getBunnyConfig } from "@vrm/lib/bunny/client";
import {
  listReviewsForTenant,
  reviewCountsForTenant,
  type ReviewStatus,
} from "@vrm/lib/reviews/queries";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { Button } from "@vrm/components/ui/button";
import { DeleteTenant } from "@vrm/components/settings/delete-tenant";
import { TenantReviews } from "@vrm/components/reviews/tenant-reviews";
import {
  TenantSettings,
  isSettingsTab,
  DEFAULT_SETTINGS_TAB,
  type SettingsTab,
} from "@vrm/components/settings/tenant-settings";

const REVIEW_STATUSES = ["pending", "approved", "rejected", "all"] as const;

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  // Next 16: params and searchParams are Promises.
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  await requireRole("super_admin");

  const [{ id }, { tab, status }] = await Promise.all([params, searchParams]);

  // Same loader and same panel the tenant sees on /dashboard/settings. RLS decides
  // who may read what, so there is no second implementation to keep in sync.
  const data = await getTenantSettings(id);
  if (!data) notFound();

  const activeTab: SettingsTab = isSettingsTab(tab) ? tab : DEFAULT_SETTINGS_TAB;
  const { tenant } = data;

  // Pending first: it is the only filter with work in it. Matches /dashboard.
  const reviewStatus: ReviewStatus | "all" = REVIEW_STATUSES.includes(
    status as (typeof REVIEW_STATUSES)[number],
  )
    ? (status as ReviewStatus | "all")
    : "pending";

  // Only when the tab is actually open. Every other tab would be paying for two
  // queries it never renders.
  const reviewData =
    activeTab === "reviews"
      ? await Promise.all([
          listReviewsForTenant(id, {
            status: reviewStatus === "all" ? undefined : reviewStatus,
          }),
          reviewCountsForTenant(id),
        ])
      : null;

  // So the delete confirmation can say exactly what is about to be destroyed.
  const supabase = await createClient();
  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <div>
      <Link href="/video/admin" className="text-sm text-ink-muted transition-colors hover:text-ink">
        ← Tenants
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-muted pb-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="size-11 shrink-0 rounded-full border border-muted"
            style={{ backgroundColor: tenant.brand_color }}
          />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{titleCaseName(tenant.name)}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {[tenant.contact_email, tenant.contact_phone, `/c/${tenant.slug}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* A form + server action, not a link: impersonating sets a cookie, and a
            mutation must never happen during a render. */}
        <form action={impersonateTenant}>
          <input type="hidden" name="tenantId" value={tenant.id} />
          <Button type="submit" variant="ghost" className="border border-muted">
            View as this tenant
          </Button>
        </form>
      </div>

      <div className="mt-8">
        <TenantSettings
          data={data}
          origin={`${proto}://${host}`}
          basePath={`/video/admin/tenants/${tenant.id}`}
          activeTab={activeTab}
          isSuperAdmin
          reviewsPanel={
            reviewData && (
              <TenantReviews
                reviews={reviewData[0]}
                counts={reviewData[1]}
                status={reviewStatus}
                basePath={`/video/admin/tenants/${tenant.id}`}
                libraryId={getBunnyConfig()?.libraryId ?? null}
              />
            )
          }
        />
      </div>

      {/* Well away from the everyday controls, and only on the admin surface -- a
          tenant can never delete themselves. */}
      <section className="mt-12 rounded-card border border-red-200 bg-surface p-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Danger zone</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Deleting this business removes its reviews, videos, login, and embed key.
          Any widget already on their website stops working. This cannot be undone.
        </p>
        <div className="mt-5">
          <DeleteTenant
            tenantId={tenant.id}
            tenantName={tenant.name}
            reviewCount={reviewCount ?? 0}
          />
        </div>
      </section>
    </div>
  );
}
