import Link from "next/link";
import type { TenantSettingsData } from "@vrm/lib/settings/queries";
import { collectUrl } from "@vrm/lib/widget/collect-url";
import { CopyField } from "@vrm/components/ui/copy-field";
import { WidgetPreview } from "@vrm/components/widget/widget-preview";
import { ApiAccess } from "./api-access";
import { BrandingForm, CollectionForm } from "./settings-forms";
import { DomainForm } from "./domain-form";
import { OpenModeForm } from "./open-mode-form";
import { VideoLimitForm } from "./video-limit-form";

/**
 * adminOnly tabs exist only on /admin/tenants/[id]. "Reviews" is one: a tenant
 * already has the whole of /dashboard for their reviews, so the tab would be a
 * duplicate for them, while the agency has no way to see a client's reviews
 * without impersonating them first.
 */
export const SETTINGS_TABS = [
  { key: "widget", label: "Widget & embed", adminOnly: false },
  { key: "reviews", label: "Reviews", adminOnly: true },
  { key: "collect", label: "Collection page", adminOnly: false },
  { key: "branding", label: "Branding", adminOnly: false },
  { key: "domain", label: "Custom domain", adminOnly: false },
  { key: "api", label: "API access", adminOnly: true },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

/** The tab shown when none is named. First in the list, so reordering moves it too. */
export const DEFAULT_SETTINGS_TAB: SettingsTab = SETTINGS_TABS[0].key;

export function isSettingsTab(value: unknown): value is SettingsTab {
  return SETTINGS_TABS.some((t) => t.key === value);
}

/** True for a tab a tenant must never land on, however they got the URL. */
export function isAdminOnlyTab(value: SettingsTab): boolean {
  return SETTINGS_TABS.some((t) => t.key === value && t.adminOnly);
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-muted bg-surface p-6 shadow-soft">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The tenant settings panel, as a sidebar + one visible tab.
 *
 * Rendered by BOTH /dashboard/settings (a tenant editing themselves) and
 * /admin/tenants/[id] (a super admin editing a tenant). One component, so the two
 * surfaces cannot drift apart -- and every form carries the tenantId, which the
 * server honours only for super admins (see resolveWritableTenantId).
 *
 * Tabs are links with a ?tab= param rather than client state, so a tab is
 * shareable, survives a reload, and needs no JavaScript.
 */
export function TenantSettings({
  data,
  origin,
  basePath,
  activeTab,
  isSuperAdmin = false,
  reviewsPanel,
}: {
  data: TenantSettingsData;
  origin: string;
  /** "/video/dashboard/settings" or "/video/admin/tenants/<id>" */
  basePath: string;
  activeTab: SettingsTab;
  /** Agency-only controls render only when true. */
  isSuperAdmin?: boolean;
  /**
   * The Reviews tab's contents, passed in rather than fetched here: only the admin
   * page supplies it, and only when that tab is actually open, so a visit to any
   * other tab does not pay for a review query it will not render.
   */
  reviewsPanel?: React.ReactNode;
}) {
  const { tenant, collection, widget, dns } = data;

  const tabs = SETTINGS_TABS.filter((t) => isSuperAdmin || !t.adminOnly);

  const reviewLink = collectUrl({
    origin,
    slug: tenant.slug,
    customDomain: tenant.custom_domain,
    customDomainVerified: tenant.custom_domain_verified,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <li key={tab.key} className="shrink-0">
                <Link
                  href={`${basePath}?tab=${tab.key}`}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-field px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sage-soft text-ink"
                      : "text-ink-muted hover:bg-sage-soft/50 hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div>
        {activeTab === "reviews" && isSuperAdmin && (
          <Panel
            title="Reviews"
            description="Everything this business has collected. Approving here is the same act as the tenant approving it themselves."
          >
            {reviewsPanel}
          </Panel>
        )}

        {activeTab === "api" && isSuperAdmin && (
          <Panel
            title="API access"
            description="Pull this business's reviews into their own system: their site, their CRM, an automation."
          >
            <div className="max-w-2xl">
              <ApiAccess
                tenantId={tenant.id}
                apiKey={tenant.api_key}
                origin={origin}
              />
            </div>
          </Panel>
        )}

        {activeTab === "collect" && (
          <div className="space-y-6">
            <Panel
              title="Share the collection page"
              description="Send this link to customers after a job."
            >
              <CopyField label="Collection page" value={`${origin}/c/${tenant.slug}`} />
            </Panel>

            <Panel
              title="Collection page"
              description="What customers see when they open the link."
            >
              <div className="max-w-xl">
                <CollectionForm
                  tenantId={tenant.id}
                  welcomeText={collection.welcome_text}
                  thankYouText={collection.thank_you_text}
                  promptQuestions={collection.prompt_questions}
                />
              </div>
            </Panel>

            {/* Agency-only. A tenant never sees this -- and could not write the
                column even if they did: max_video_seconds is absent from the
                `authenticated` column grants, so Postgres refuses it. */}
            {isSuperAdmin && (
              <Panel
                title="Video length"
                description="How long a customer's video review can run."
              >
                <div className="max-w-xl">
                  <VideoLimitForm
                    tenantId={tenant.id}
                    maxVideoSeconds={tenant.max_video_seconds}
                  />
                </div>
              </Panel>
            )}
          </div>
        )}

        {activeTab === "widget" && (
          <div className="space-y-6">
            {/* Agency-only. A tenant never sees this -- and could not write the
                column even if they did: review_open_mode is absent from the
                `authenticated` column grants, so Postgres refuses it. */}
            {isSuperAdmin && (
              <Panel
                title="Leave a review button"
                description="What happens when a visitor clicks it on the client's website."
              >
                <div className="max-w-xl">
                  <OpenModeForm
                    tenantId={tenant.id}
                    mode={tenant.review_open_mode}
                    collectUrl={reviewLink}
                    hasCustomDomain={Boolean(
                      tenant.custom_domain && tenant.custom_domain_verified,
                    )}
                  />
                </div>
              </Panel>
            )}

            <Panel
              title="Widget & embed"
              description="Pick a layout, then copy the embed code for it."
            >
              <WidgetPreview
                tenantId={tenant.id}
                embedKey={tenant.embed_key}
                origin={origin}
                initialLayout={widget.layout}
                initialAutoplay={widget.autoplay}
              />
            </Panel>
          </div>
        )}

        {activeTab === "branding" && (
          <Panel
            title="Branding"
            description="Shown on the collection page and the widget."
          >
            <div className="max-w-xl">
              <BrandingForm
                tenantId={tenant.id}
                name={tenant.name}
                brandColor={tenant.brand_color}
                logoUrl={tenant.logo_url}
                contactEmail={tenant.contact_email}
                contactPhone={tenant.contact_phone}
              />
            </div>
          </Panel>
        )}

        {activeTab === "domain" && (
          <div className="space-y-6">
            <Panel
              title="Custom domain"
              description="Host the reviews on the business's own domain."
            >
              <div className="max-w-2xl">
                <DomainForm
                  tenantId={tenant.id}
                  customDomain={tenant.custom_domain}
                  verified={tenant.custom_domain_verified}
                  records={dns.records}
                  serving={dns.serving}
                />
              </div>
            </Panel>

            <Panel
              title="On our domain"
              description="This always works, with no DNS setup."
            >
              <CopyField label="Review page" value={`${origin}/s/${tenant.subdomain}`} />
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
