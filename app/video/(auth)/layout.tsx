export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-base px-6 py-16">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
