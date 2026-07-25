import { requireRole } from "@vrm/lib/auth/dal";
import { AppShell } from "@vrm/components/app-shell";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireRole("super_admin");

  return (
    <AppShell title="Platform Admin" email={email}>
      {children}
    </AppShell>
  );
}
