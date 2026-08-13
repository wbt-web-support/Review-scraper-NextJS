import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWidgetPayloadByCustomDomain } from "@vrm/lib/widget/queries";
import { healDomainOnRequest } from "@vrm/lib/domains/verify";
import { ReviewWall } from "@vrm/components/reviews/review-wall";

/**
 * The wall of published reviews, on the tenant's own domain:
 *   review.njdesignpark.com/reviews
 *
 * The ROOT of their domain is the collection page -- that link gets sent to
 * customers who were asked to record something, and showing them other people's
 * testimonials first is a step in the way. This is where the wall lives instead,
 * for when they want to link to it from their site.
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
    title: `Reviews for ${data.tenant.name}`,
    description: `What customers say about ${data.tenant.name}.`,
  };
}

export default async function CustomDomainReviewsPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;

  // Same self-healing check as the collection page: a claimed domain whose DNS has
  // only just gone live verifies itself here rather than 404ing. See /d/[host].
  let data = await getWidgetPayloadByCustomDomain(host);
  if (!data && (await healDomainOnRequest(host))) {
    data = await getWidgetPayloadByCustomDomain(host);
  }
  if (!data) notFound();

  return <ReviewWall data={data} />;
}
