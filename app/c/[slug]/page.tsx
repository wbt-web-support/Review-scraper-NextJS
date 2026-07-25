import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionPage } from "@vrm/lib/collect/queries";
import { CollectPage } from "@vrm/components/collect/collect-page";

// Public and unauthenticated. Reviewers never log in -- the slug is the entry point.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCollectionPage(slug);
  if (!page) return { title: "Not found" };

  return {
    title: `Leave a review for ${page.tenant.name}`,
    description: page.welcomeText,
    // Not indexable: these links are sent to specific customers, not published.
    robots: { index: false, follow: false },
  };
}

export default async function CollectionPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const [{ slug }, { embed }] = await Promise.all([params, searchParams]);

  const page = await getCollectionPage(slug);
  if (!page) notFound();

  return <CollectPage page={page} embedded={embed === "1"} />;
}
