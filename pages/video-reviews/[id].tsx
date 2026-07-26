import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { Video, Copy, Check, Pencil, LogIn, KeyRound, Eye, EyeOff, RefreshCw } from "lucide-react";
import Layout from "../../components/Layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { EditBusinessDialog } from "../../components/EditBusinessDialog";
import { TenantManager, TENANT_TABS, TENANT_BASE, VideoTab, ApiTab, type TenantTabKey, type Bundle } from "../../components/TenantManager";
import { apiRequest } from "../../lib/queryClient";
import { titleCaseName } from "@vrm/lib/tenants/display-name";

type ProfileTab = "overview" | TenantTabKey;

interface IVideoBusiness {
  _id: string;
  name: string;
  video: { tenantId: string; slug: string; embedKey: string; collectUrl: string };
  details?: { firstName?: string; lastName?: string; email?: string; phone?: string; brandColor?: string; logoUrl?: string };
  loginPassword?: string;
}

export default function VideoBusinessProfile() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: business, isLoading } = useQuery<IVideoBusiness>({
    queryKey: ["videoBusiness", id],
    queryFn: () => apiRequest("GET", `/api/video-businesses/${id}`),
    enabled: Boolean(id),
  });

  const { data: bundle } = useQuery<Bundle>({
    queryKey: ["tenant", id],
    queryFn: () => apiRequest("GET", TENANT_BASE(id)),
    enabled: Boolean(business),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (isLoading) {
    return <Layout><div className="mx-auto max-w-6xl px-6 py-8"><div className="h-40 animate-pulse rounded bg-gray-100" /></div></Layout>;
  }
  if (!business) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link href="/video-reviews" className="text-sm text-gray-500 hover:text-gray-900">← Video Reviews</Link>
          <p className="mt-6 text-gray-500">This business could not be found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* No Referer, so Bunny's hotlink protection doesn't 403 the video files. */}
      <Head><meta name="referrer" content="no-referrer" /></Head>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/video-reviews" className="hover:text-gray-900">Video Reviews</Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-900">{titleCaseName(business.name)}</span>
        </nav>

        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
            {TENANT_TABS.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
                {t.label}
                {t.key === "reviews" && (bundle?.counts.pending ?? 0) > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{bundle!.counts.pending}</span>
                )}
              </TabButton>
            ))}
          </aside>

          <div className="min-w-0 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Video className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">{titleCaseName(business.name)}</h1>
                  <p className="mt-0.5 text-sm text-gray-500">Video reviews</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
            </div>

            {activeTab === "overview" ? (
              <>
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

                <section className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-purple-600" />
                    <h2 className="text-base font-semibold text-gray-900">Video reviews</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Enabled
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">Collection link</span>
                    <code className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-800">{business.video.collectUrl.replace(/^https?:\/\//, "")}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(business.video.collectUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
                    {(["pending", "approved", "rejected"] as const).map((k) => (
                      <button key={k} onClick={() => setActiveTab("reviews")} className="p-4 text-left transition-colors hover:bg-gray-50">
                        <div className="text-2xl font-semibold text-gray-900">{bundle ? bundle.counts[k] : "–"}</div>
                        <div className="mt-0.5 text-xs capitalize text-gray-400">{k}</div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Business login -- what to hand off so the client can see and manage
                    their own video reviews (same as Video Review Manager). */}
                <section className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5 text-gray-500" />
                    <h2 className="text-base font-semibold text-gray-900">Business login</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Give these to the business so they can sign in and approve, reject and manage their own video reviews.
                  </p>
                  <div className="mt-4 space-y-3">
                    <LoginRow label="Login page" value={`${origin.replace(/^https?:\/\//, "")}/video/login`} copyValue={`${origin}/video/login`} />
                    <LoginRow label="Email" value={business.details?.email || "—"} copyValue={business.details?.email || ""} />
                    <PasswordManager businessId={id} currentPassword={business.loginPassword} />
                  </div>
                </section>

                {bundle && (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <VideoTab base={TENANT_BASE(id)} businessId={id} bundle={bundle} />
                    <ApiTab base={TENANT_BASE(id)} businessId={id} bundle={bundle} />
                  </div>
                )}
              </>
            ) : (
              <TenantManager businessId={id} origin={origin} tab={activeTab} />
            )}
          </div>
        </div>
      </div>

      <EditBusinessDialog
        business={business}
        open={editOpen}
        onOpenChange={setEditOpen}
        endpoint="/api/video-businesses"
        invalidateKey="videoBusinesses"
      />
    </Layout>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-sm font-medium transition-colors ${
        active ? "border border-gray-200 bg-white text-gray-900 shadow-sm" : "border border-transparent text-gray-500 hover:bg-gray-100/70 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

/** A copyable login field (label + value + copy button). */
function LoginRow({ label, value, copyValue }: { label: string; value: string; copyValue: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-gray-400">{label}</div>
        <div className="truncate font-mono text-sm text-gray-800">{value}</div>
      </div>
      {copyValue && (
        <button
          onClick={() => { navigator.clipboard.writeText(copyValue); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

/**
 * Shows the business's current sign-in password and lets the operator change it.
 *
 * The current password comes from our own record (Supabase can't return it). "Change"
 * opens a field to type a specific password or generate a random one; saving applies
 * it to the real auth user and re-fetches so the shown value stays truthful.
 */
function PasswordManager({ businessId, currentPassword }: { businessId: string; currentPassword?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const mutation = useMutation<{ password: string }, Error, string | undefined>({
    mutationFn: (password) => apiRequest("POST", `/api/video-businesses/${businessId}/reset-login`, password ? { password } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videoBusiness", businessId] });
      queryClient.invalidateQueries({ queryKey: ["videoBusinesses"] });
      setEditing(false);
      setDraft("");
      setRevealed(true);
      toast({ title: "Password updated", description: "Share the new password with the business." });
    },
    onError: (e) => toast({ title: "Could not change the password", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-400">Password</div>
          {currentPassword ? (
            <div className="truncate font-mono text-sm text-gray-800">{revealed ? currentPassword : "•".repeat(Math.min(currentPassword.length, 12))}</div>
          ) : (
            <div className="text-sm text-gray-400">Not stored — set one below</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentPassword && (
            <>
              <button onClick={() => setRevealed((v) => !v)} className="text-gray-500 hover:text-gray-800" title={revealed ? "Hide" : "Show"}>
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(currentPassword); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
            </>
          )}
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => { setEditing(true); setDraft(""); }}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Change
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="h-9 w-56 bg-white font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => mutation.mutate(undefined)}
            disabled={mutation.isPending}
            title="Generate a random password"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => mutation.mutate(draft.trim())}
            disabled={mutation.isPending || draft.trim().length < 8}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(""); }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
