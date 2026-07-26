import type { CollectionPage } from "@vrm/lib/collect/queries";
import { brandVars } from "@vrm/lib/brand";
import { newsreader, hanken } from "@vrm/lib/fonts";
import { CollectForm } from "./collect-form";
import "./collect.css";

/** "nj designpark" -> "ND". One word -> its first two letters. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The page a customer lands on to leave a review.
 *
 * Shared by /c/[slug] (our domain) and /d/[host] (the tenant's own domain), so the
 * two cannot drift.
 *
 * EVERYTHING visible belongs to the tenant: their logo, name, brand colour, words.
 * This is the one page their customer sees, and it has to look like it belongs to
 * the business that just did the work -- not like a third-party tool they were
 * bounced into. Which is why brandVars() derives a whole palette from the single
 * hex they pick, rather than the design's hardcoded green.
 */
export function CollectPage({
  page,
  embedded = false,
}: {
  page: CollectionPage;
  /** Inside the widget's dialog: it already frames the page, so drop the backdrop. */
  embedded?: boolean;
}) {
  const { tenant } = page;
  const style = brandVars(tenant.brandColor);
  const fonts = `${newsreader.variable} ${hanken.variable}`;

  const header = (
    <div className="collect-brand">
      {tenant.logoUrl ? (
        // Plain <img>: the logo is an arbitrary per-tenant URL, so next/image would
        // need every client's host in remotePatterns up front -- which we cannot know.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logoUrl} alt={tenant.name} className="collect-logo" />
      ) : (
        <>
          <div className="collect-monogram">{monogram(tenant.name)}</div>
          <span className="collect-company">{tenant.name}</span>
        </>
      )}
    </div>
  );

  const footer = (
    <div className="collect-footer">
      <span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l7 3v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V5l7-3z"
            stroke="#9aa093"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="#9aa093"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Your review is checked by {tenant.name} before it appears anywhere.
      </span>
    </div>
  );

  // A single static layout for both the standalone page and the embedded dialog.
  // No animated backdrop, no cursor-driven tilt or glow, no brand-coloured blobs --
  // just the card on a static, neutral background. The brand colour lives on the
  // record button and nowhere in the scenery.
  return (
    <div
      className={`collect-root ${fonts}`}
      style={embedded ? { ...style, padding: "28px 20px", minHeight: "auto" } : style}
    >
      <div className="collect-card-wrap">
        {/* Logo sits above the card, centered -- a small hero, not tucked in a corner. */}
        <div className="collect-brand-outer">{header}</div>
        <div className="collect-card">
          <div className="collect-card-inner">
            <CollectForm page={page} />
          </div>
        </div>
        {footer}
      </div>
    </div>
  );
}
