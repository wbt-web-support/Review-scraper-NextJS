import { redirect } from "next/navigation";
import { getSessionClaims } from "@vrm/lib/auth/dal";
import { HOME_FOR_ROLE } from "@vrm/lib/auth/claims";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ error?: string }>;
}) {
  // The real check. The proxy also bounces logged-in users away from /login, but
  // that is an optimistic convenience, not the gate.
  const claims = await getSessionClaims();
  if (claims?.role) redirect(HOME_FOR_ROLE[claims.role]);

  const { error } = await searchParams;

  return (
    <div className="rounded-card border border-muted bg-surface p-8 shadow-soft">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Manage your customer video reviews.
      </p>

      {error === "no_tenant" && (
        <p
          role="alert"
          className="mt-6 rounded-field bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          Your account isn&apos;t linked to a business. Contact an administrator.
        </p>
      )}

      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
