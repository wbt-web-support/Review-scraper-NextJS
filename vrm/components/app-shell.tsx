import Link from "next/link";
import { SignOutButton } from "@vrm/components/ui/sign-out-button";

export type NavItem = { href: string; label: string };

export function AppShell({
  title,
  email,
  nav = [],
  children,
}: {
  /** Omit when the nav already names the section -- a label repeating it is noise. */
  title?: string;
  email: string | null;
  nav?: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-base">
      <header className="border-b border-muted bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            {title && (
              <span className="text-sm font-semibold tracking-tight text-ink">
                {title}
              </span>
            )}
            {nav.length > 0 && (
              <nav className="flex items-center gap-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-field px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
