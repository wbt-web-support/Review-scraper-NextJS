import { getSessionClaims, getTenantContext } from "@vrm/lib/auth/dal";
import { stopImpersonating } from "@vrm/lib/tenants/actions";
import { AppShell } from "@vrm/components/app-shell";

// The review queue lives on /dashboard itself now, so there is no separate
// "Reviews" tab -- one fewer click to the only thing a tenant logs in to do.
const NAV = [
  { href: "/video/dashboard", label: "Reviews" },
  { href: "/video/dashboard/settings", label: "Settings" },
];

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getTenantContext, not requireRole('tenant_admin'): a super_admin viewing a
  // tenant belongs here too. It bounces anyone without a tenant.
  const { impersonating } = await getTenantContext();
  const claims = await getSessionClaims();

  return (
    <>
      {impersonating && (
        <div className="border-b border-sage/30 bg-sage-soft">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
            <p className="text-sm text-ink">
              Viewing as a tenant. Changes you make here affect their live data.
            </p>
            <form action={stopImpersonating}>
              <button
                type="submit"
                className="rounded-field px-3 py-1 text-sm font-medium text-ink underline underline-offset-4 transition-colors hover:text-sage-hover"
              >
                Exit
              </button>
            </form>
          </div>
        </div>
      )}
      {/* No brand label: the nav already says "Reviews". */}
      <AppShell email={claims?.email ?? null} nav={NAV}>
        {children}
      </AppShell>
    </>
  );
}
