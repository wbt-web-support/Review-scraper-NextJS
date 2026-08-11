# Video Reviews API v1

For a client's developer. Read reviews into your own system, moderate them from
your own tools, and change your settings without logging into the dashboard.

**Base URL:** `https://reviews.webuildtrades.com/api/v1`

## Authentication

Every request needs the business's API key, found on the API access tab of that
business's settings.

```
Authorization: Bearer vrm_your_key_here
```

If your tooling can't set headers, `?key=vrm_...` works instead.

The key identifies the business. There's no tenant or business id to pass, and
nothing you send can point the request at another business.

**Server side only.** This key reads pending reviews and reviewer email
addresses, and it can permanently delete testimonials. It must never appear in a
website's JavaScript. There are no CORS headers, on purpose, so a browser call
fails loudly in development instead of quietly handing every visitor a copy of the
key.

For a public testimonial wall, use the embed widget instead. That feed is
browser safe: approved reviews only, no personal data.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/reviews` | List reviews |
| GET | `/reviews/{id}` | One review |
| PATCH | `/reviews/{id}` | Approve, reject, or set back to pending |
| DELETE | `/reviews/{id}` | Delete the review and its video |
| GET | `/reviews/{id}/download` | Download the video file |
| GET | `/settings` | Branding, collection page, widget together |
| PATCH | `/settings` | Change any of those |
| GET PUT PATCH DELETE | `/collection` | The collection page, on its own |
| GET PUT PATCH DELETE | `/branding` | Branding, on its own |

`/collection` and `/branding` are the same fields `/settings` exposes, reachable
directly so you don't have to nest a one-field change inside a settings envelope.
Use whichever suits your code.

**PUT replaces, PATCH merges.** On PUT, any optional field you leave out is
**cleared**. On PATCH, anything you leave out is untouched. When in doubt, PATCH.

### GET /reviews

Query parameters, all optional:

| Parameter | Values |
|---|---|
| `status` | `approved` (default), `pending`, `rejected`, `all` |
| `type` | `video` or `text`. Omit for both. |
| `limit` | 1 to 100. Defaults to 50. |
| `offset` | For paging. The response returns `total`. |

```bash
curl -H "Authorization: Bearer $KEY" \
  "$BASE/reviews?status=approved&type=video&limit=50"
```

```json
{
  "tenant": { "name": "Acme Renewables", "slug": "acme-renewables" },
  "total": 128,
  "limit": 50,
  "offset": 0,
  "reviews": [
    {
      "id": "9f1c...",
      "reviewer_name": "Molly Leopold",
      "reviewer_email": "molly@example.com",
      "rating": 5,
      "type": "video",
      "status": "approved",
      "text_review": null,
      "video": {
        "provider": "bunny",
        "id": "5b7e...",
        "play_url": "https://iframe.mediadelivery.net/play/...",
        "embed_url": "https://iframe.mediadelivery.net/embed/...",
        "url": "https://.../playlist.m3u8",
        "thumbnail_url": "https://.../thumbnail.jpg",
        "ready": true
      },
      "created_at": "2026-08-01T09:14:22.000Z"
    }
  ]
}
```

On the video object: `play_url` is the one to open or send to someone.
`embed_url` goes in an iframe. `url` is a machine URL, an HLS playlist for your
own player, and it 403s if a human opens it. `ready` is false while the video is
still encoding, and `url` and `thumbnail_url` are null until it flips true.

### GET /reviews/{id}

```bash
curl -H "Authorization: Bearer $KEY" "$BASE/reviews/$REVIEW_ID"
```

Returns `{ "review": { ... } }` with the same review shape as above.

### PATCH /reviews/{id}

```bash
curl -X PATCH -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}' "$BASE/reviews/$REVIEW_ID"
```

`status` must be `approved`, `rejected`, or `pending`. Returns the updated review.

Only approved reviews appear in the embed widget, so this is the call that puts a
testimonial live.

### DELETE /reviews/{id}

```bash
curl -X DELETE -H "Authorization: Bearer $KEY" "$BASE/reviews/$REVIEW_ID"
```

```json
{ "deleted": true, "id": "9f1c..." }
```

**This is permanent and it deletes the video too.** There's no undo and no
confirmation step, because the caller is a program.

Rejecting is not deleting. A rejected review is hidden but kept, which is the
right move for "we're not using this one". Delete is for when a review must not
exist: a customer withdrawing consent, or a recording made by mistake.

### GET /reviews/{id}/download

Downloads the video file itself, for saving a copy or feeding it into your own
editing or marketing workflow.

```bash
curl -H "Authorization: Bearer $KEY" \
  -o testimonial.mp4 \
  "$BASE/reviews/$REVIEW_ID/download"
```

Comes back as `video/mp4` with a `Content-Disposition: attachment` and a filename
built from the reviewer's name, for example `review-molly-leopold.mp4`. The bytes
stream, so large files don't sit in memory at either end.

| Status | Means |
|---|---|
| 200 | The file, streaming |
| 404 | No such review for you, it's a text review, or it has no video |
| 409 | The video is still encoding. Try again shortly. |

The 409 is worth handling. A video uploaded moments ago has no downloadable MP4
until the encode finishes. Poll `ready` on the review, or just retry.

### GET /settings

```bash
curl -H "Authorization: Bearer $KEY" "$BASE/settings"
```

```json
{
  "tenant": { "name": "Acme Renewables", "slug": "acme-renewables" },
  "branding": {
    "name": "Acme Renewables",
    "brand_color": "#8A9A5B",
    "logo_url": "https://.../logo.png",
    "contact_email": "owner@example.com",
    "contact_phone": "07700 900123"
  },
  "collection": {
    "welcome_text": "We would love to hear from you.",
    "description": "Share your experience in a quick video.",
    "thank_you_text": "Thank you for your review!",
    "prompt_questions": ["What job did we do for you?", "How did we do?"]
  },
  "widget": { "layout": "grid", "autoplay": false, "theme": "light" }
}
```

### PATCH /settings

Send only what you want to change. Everything else is left alone.

```bash
curl -X PATCH -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"collection":{"welcome_text":"Tell us how we did"}}' \
  "$BASE/settings"
```

Writable fields:

| Section | Fields |
|---|---|
| `branding` | `name` (1 to 120 chars), `brand_color` (hex like `#8A9A5B`), `logo_url`, `contact_email`, `contact_phone` |
| `collection` | `welcome_text`, `description`, `thank_you_text` (up to 300 chars each), `prompt_questions` (up to 10 strings) |
| `widget` | `layout` (`grid`, `carousel`, `single`), `autoplay` (boolean) |

Send `null` or `""` to clear `logo_url`, `contact_email`, or `contact_phone`.
Omitting a field leaves it as it was. `widget.theme` is read only.

Returns the full settings object after the change.

### /collection

The collection page wording, as its own resource.

```bash
curl -H "Authorization: Bearer $KEY" "$BASE/collection"

# change one line, leave the rest alone
curl -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"welcome_text":"Tell us how we did"}' "$BASE/collection"

# replace the page. description and prompt_questions omitted here, so both are cleared
curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"welcome_text":"Hello there","thank_you_text":"Thanks!"}' "$BASE/collection"

# back to the default wording a new business starts with
curl -X DELETE -H "Authorization: Bearer $KEY" "$BASE/collection"
```

| Field | Rules |
|---|---|
| `welcome_text` | 1 to 300 chars. Required on PUT. |
| `thank_you_text` | 1 to 300 chars. Required on PUT. |
| `description` | Up to 300 chars. The line under the heading. |
| `prompt_questions` | Up to 10 strings. More than 10 is a 400, not a silent trim. |

DELETE resets rather than removes. Every business always has a `/c/<slug>` page
and it always has to render something, so "delete" can only sensibly mean "put the
default wording back".

### /branding

```bash
curl -H "Authorization: Bearer $KEY" "$BASE/branding"

curl -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"brand_color":"#123456"}' "$BASE/branding"

# clear one field: null and "" both work
curl -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"logo_url":null}' "$BASE/branding"

curl -X DELETE -H "Authorization: Bearer $KEY" "$BASE/branding"
```

| Field | Rules |
|---|---|
| `name` | 1 to 120 chars. Required on PUT. |
| `brand_color` | Hex like `#8A9A5B`. Required on PUT. |
| `logo_url` | A URL, or null/`""` to clear |
| `contact_email` | An email, or null/`""` to clear |
| `contact_phone` | Up to 40 chars, or null to clear |

DELETE clears the logo and contact details and puts the colour back to the
default. **The name survives**, because a business with no name has no page
heading, no widget attribution and nothing to show in a list.

**Not exposed anywhere here:** custom domain, video length limit, review open mode, and API
key rotation. The first three provision DNS or change what a recording costs, and
rotation would cut off the key making the request. Those stay in the dashboard
where a human confirms them.

## Errors

Every error is JSON: `{ "error": "a sentence explaining it" }`.

| Status | Means |
|---|---|
| 400 | Bad request body, unknown status value, malformed id, or an empty settings patch |
| 401 | Missing, malformed, or unknown API key |
| 404 | No such review, **or** it belongs to another business |
| 409 | Download only: the video is still encoding |
| 500 | Something failed our side |

A review belonging to another business returns 404 rather than 403, on read,
moderate, and delete alike. There's nothing to learn from guessing ids.

## Notes

- Responses are `Cache-Control: no-store`. Moderate a review and the next call
  reflects it immediately.
- Rotating the key in the dashboard breaks anything built against the old one the
  instant the new key is generated.
- Changes made through this API show up in the dashboard, and dashboard changes
  show up here. It's one set of data, not a copy.
