import Link from "next/link";
import { requireRole } from "@vrm/lib/auth/dal";
import { listTenants, listRecentReviews } from "@vrm/lib/tenants/queries";
import { Stars } from "@vrm/components/reviews/stars";
import { titleCaseName } from "@vrm/lib/tenants/display-name";
import { NewTenantDialog } from "./new-tenant-dialog";

export const metadata = { title: "Tenants" };

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-sage-soft text-ink",
  rejected: "bg-red-50 text-red-800",
} as const;

export default async function AdminPage() {
  // Checked again in the page, not just the layout: layouts do not re-render on
  // client-side navigation, so a layout-only check goes stale. cache() makes it free.
  await requireRole("super_admin");

  const [tenants, recent] = await Promise.all([listTenants(), listRecentReviews()]);

  const totalPending = tenants.reduce((sum, t) => sum + t.pending_count, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Tenants</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {tenants.length === 0
              ? "No client businesses yet."
              : `${tenants.length} client ${tenants.length === 1 ? "business" : "businesses"}` +
                (totalPending > 0
                  ? ` · ${totalPending} review${totalPending === 1 ? "" : "s"} awaiting approval`
                  : "")}
          </p>
        </div>
        <NewTenantDialog />
      </div>

      {tenants.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-muted bg-surface p-12 text-center">
          <p className="text-sm text-ink-muted">
            Create your first tenant to generate a collection page and embed widget.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-card border border-muted bg-surface shadow-soft">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-muted text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Collection URL</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 text-right font-medium">Reviews</th>
                <th className="px-5 py-3 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-muted/60 last:border-0 hover:bg-sage-soft/40"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/video/admin/tenants/${t.id}`}
                      className="flex items-center gap-3 font-medium text-ink hover:text-sage"
                    >
                      <span
                        aria-hidden
                        className="size-6 shrink-0 rounded-full border border-muted"
                        style={{ backgroundColor: t.brand_color }}
                      />
                      {titleCaseName(t.name)}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-ink-muted">/c/{t.slug}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-ink">
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-ink">
                    {t.review_count}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {t.pending_count > 0 ? (
                      <span className="font-medium text-ink">{t.pending_count}</span>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            Recent reviews
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            The latest submissions across every client.
          </p>

          <ul className="mt-5 divide-y divide-muted/60 rounded-card border border-muted bg-surface shadow-soft">
            {recent.map((review) => (
              <li
                key={review.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {review.reviewer_name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[review.status]}`}
                    >
                      {review.status}
                    </span>
                    <span className="text-xs capitalize text-ink-muted">
                      {review.type}
                    </span>
                  </div>
                  <Link
                    href={`/video/admin/tenants/${review.tenant_id}`}
                    className="mt-0.5 block text-xs text-ink-muted transition-colors hover:text-sage"
                  >
                    {titleCaseName(review.tenant_name)}
                  </Link>
                </div>

                <div className="flex items-center gap-4">
                  <Stars rating={review.rating} />
                  <span className="w-20 text-right text-xs text-ink-muted">
                    {new Date(review.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
