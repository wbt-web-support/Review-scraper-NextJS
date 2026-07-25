import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWidgetPayloadByCustomDomain } from "@vrm/lib/widget/queries";
import { getCollectionPage } from "@vrm/lib/collect/queries";
import { CollectPage } from "@vrm/components/collect/collect-page";

/**
 * The tenant's own domain: review.njdesignpark.com
 *
 * This is the LINK THEY SEND CUSTOMERS after a job, so the root is the page where
 * you leave a review -- not a wall of ones already left. A visitor arriving here
 * was asked to record something; showing them other people's testimonials first is
 * a step in the way.
 *
 * The wall still exists, at /reviews on the same domain, and is what the embedded
 * widget pulls from.
 *
 * src/proxy.ts rewrites any host that isn't ours onto this route. The tenant never
 * sees /d/<host> -- they see their own domain, which is the point.
 *
 * getWidgetPayloadByCustomDomain only matches a DNS-VERIFIED domain. Claiming a
 * hostname in settings is not enough: without that check, anyone could type
 * "review.bbc.co.uk" and have us serve their content on the BBC's domain.
 */

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host } = await params;
  const data = await getWidgetPayloadByCustomDomain(host);
  if (!data) return { title: "Not found" };

  return {
    title: `Leave a review for ${data.tenant.name}`,
    description: `Tell ${data.tenant.name} how they did.`,
    // Not indexable: this link is sent to specific customers, not published.
    robots: { index: false, follow: false },
  };
}

export default async function CustomDomainPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;

  // Resolve the tenant from the verified domain, then load their collection page by
  // slug. The domain check is what authorizes this; the slug is just the lookup.
  const tenant = await getWidgetPayloadByCustomDomain(host);
  if (!tenant) notFound();

  const page = await getCollectionPage(tenant.tenant.slug);
  if (!page) notFound();

  return <CollectPage page={page} />;
}
