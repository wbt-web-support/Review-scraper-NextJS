# Service categories (review filter)

Each scraped review can carry the service it is about: `boiler`, `ac`, `ev`,
`solar`, `heatpump`, `plumbing`, `electrical`, or a business's own list. A
widget can show one service's reviews, or offer buttons so a visitor chooses.
Reviews that name no service are **general feedback**: they have no category
and show under every button as well as under "All".

Nothing here uses a model. Categories come from word lists (`lib/reviewCategories.ts`)
run over the review text, the business's reply, and the service Google asked the
reviewer to pick. A category set by hand in the dashboard is never overwritten.

## Where the tags come from

| When | What happens |
|---|---|
| Every crawl | New reviews are tagged as they are saved (`mergeNewReviews`). A stored review that comes back is filled in with the owner reply, Google's service answer and the other fields the scraper now keeps, then re-tagged. |
| Services edited | Saving the Edit Business dialog re-tags that business's reviews at once. |
| "Re-tag reviews" on a business page | Same, on demand. `POST /api/business-urls/<id>/categorize`. |
| One-off backfill | `npx tsx --env-file=.env.local scripts/categorize-reviews.ts [--business <id>] [--dry]` tags every stored review. Reads only what is stored: no crawl, no Apify spend. |

A business without its own list uses `DEFAULT_SERVICES`. An empty list switches
categories off for that business.

## Embedding

Two optional attributes on the widget script tag (grid, list, carousel, masonry, wall).
Snippets without them behave exactly as before.

```html
<script async src="https://reviews.webuildtrades.com/widget-grid.js?v=..."
        data-widget-id="..." data-layout="grid" data-container-id="..."
        data-category="boiler"
        data-category-filter="true"></script>
```

- `data-category="boiler"`: only that service's reviews, plus general feedback.
  One widget can sit on the boiler page with `boiler` and on the EV page with `ev`.
- `data-category-filter="true"`: buttons above the reviews: All, then each
  service that has reviews, with counts. A count is that service plus general.

The Embed Code tab in the widget editor writes both attributes.

## Feeds

`GET /api/public/widget-data/<widget id>?category=boiler` (also `boiler,ev`).
The response gains `categories: [{ key, label, count }]`, `generalCount`,
`allCount` and `category` (the filter applied, or null). Every other field is
unchanged, and each review gains `categories: string[]`.

`GET /api/public/reviews?category=boiler` on the JSON API, and
`&general=exclude` to leave general feedback out. Each review has `categories`.

The scraper's other fields (owner reply, Google's context, likes, images,
translations, the raw item) are stored on each review but never sent by either
feed; see `PRIVATE_REVIEW_FIELDS` in `lib/storage.ts`. The business-level block
the scraper returns (address, Google's own count and score) is stored once per
review batch as `place`.
