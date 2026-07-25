import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWidgetPayloadBySubdomain } from "@vrm/lib/widget/queries";
import { ReviewWall } from "@vrm/components/reviews/review-wall";

/**
 * A tenant's reviews on a subdomain of OURS: acme.reviews.ourdomain.com
 *
 * Reached two ways:
 *   - directly at /s/<subdomain> (which is how you test it without DNS)
 *   - at <subdomain>.<ROOT_DOMAIN>, which src/proxy.ts rewrites here
 *
 * For a tenant's own domain (review.theirdomain.com) see /d/[host].
 */

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const data = await getWidgetPayloadBySubdomain(subdomain);
  if (!data) return { title: "Not found" };

  return {
    title: `Reviews for ${data.tenant.name}`,
    description: `What customers say about ${data.tenant.name}.`,
  };
}

export default async function SubdomainPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const data = await getWidgetPayloadBySubdomain(subdomain);
  if (!data) notFound();

  return <ReviewWall data={data} />;
}
