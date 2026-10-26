# Agency API (Command HQ only)

Command HQ uses this to connect each of its clients to the right business here,
without anyone copying `vrm_` keys between dashboards. It is not for clients and
must never be given to one.

Base: `https://reviews.webuildtrades.com/api/agency/v1`

## Switching it on

Set `AGENCY_API_SECRET` on this app (Vercel, Production) to a long random value,
at least 32 characters; 64 hex characters is the expected shape:

```bash
openssl rand -hex 32
```

Command HQ holds the same value as `VIDEO_REVIEWS_AGENCY_SECRET`. Neither side
may give it a `NEXT_PUBLIC_` prefix. Unset or too short, every route below
answers 404.

To rotate: set a new value on both apps, then redeploy both. Requests fail in
between, and nothing else is affected.

## Signing

Every request carries two headers:

| Header | Value |
|---|---|
| `X-WBT-Timestamp` | Unix seconds, now |
| `X-WBT-Signature` | Hex HMAC-SHA256 of the canonical string, keyed with the secret |

```
canonical = timestamp + "\n" + METHOD + "\n" + path_and_query + "\n" + hex(sha256(body))
```

`path_and_query` is what the server sees, for example
`/api/agency/v1/tenants/9f1c.../api-key`. A GET has an empty body, whose SHA-256
is `e3b0c442...b855`.

A request older or newer than 5 minutes is refused, and so is one whose method,
path or body differs from what was signed. Every refusal is
`401 {"error":"Not authorised."}`. More than 60 requests a minute from one
address is a 429.

## Routes

| Method | Path | Returns |
|---|---|---|
| GET | `/tenants` | `{"tenants":[{"id","name","slug","created_at"}]}`, A to Z |
| POST | `/tenants/{id}/api-key` | `{"tenant":{"id","name","slug"},"api_key":"vrm_..."}`, 404 if no such business |

Each key read is logged by tenant id (never the key) as
`Agency API: Command HQ read the API key of tenant <id>.`
