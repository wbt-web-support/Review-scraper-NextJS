import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTenantContext } from "@vrm/lib/auth/dal";
import { getTenantSettings } from "@vrm/lib/settings/queries";
import {
  TenantSettings,
  isSettingsTab,
  isAdminOnlyTab,
  DEFAULT_SETTINGS_TAB,
  type SettingsTab,
} from "@vrm/components/settings/tenant-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ tab?: string }>;
}) {
  // getTenantContext is the auth gate. It also lets an impersonating super admin
  // land here scoped to the tenant they're viewing.
  const { tenantId } = await getTenantContext();

  const [data, { tab }] = await Promise.all([
    getTenantSettings(tenantId),
    searchParams,
  ]);
  if (!data) notFound();

  // An admin-only tab is not merely hidden here, it is refused: a tenant typing
  // ?tab=reviews lands on the default tab, not on an empty panel.
  const activeTab: SettingsTab =
    isSettingsTab(tab) && !isAdminOnlyTab(tab) ? tab : DEFAULT_SETTINGS_TAB;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your collection page, widget, branding, and domain.
      </p>

      <div className="mt-8">
        <TenantSettings
          data={data}
          origin={`${proto}://${host}`}
          basePath="/video/dashboard/settings"
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}
