import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Braces, Check, Copy, Eye, EyeOff, KeyRound, Loader, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

type Lang = "curl" | "node" | "php";
const LANGS: { key: Lang; label: string }[] = [
  { key: "curl", label: "cURL" },
  { key: "node", label: "JavaScript (server)" },
  { key: "php", label: "PHP (WordPress)" },
];

/** Shows the start and end of a key, so two keys can be told apart without revealing either. */
function mask(key: string): string {
  return `${key.slice(0, 6)}${"•".repeat(20)}${key.slice(-4)}`;
}

function example(lang: Lang, endpoint: string, key: string): string {
  switch (lang) {
    case "curl":
      return `curl ${endpoint} \\
  -H "Authorization: Bearer ${key}"`;
    case "node":
      return `// Run this on your server, never in the browser.
const res = await fetch("${endpoint}", {
  headers: { Authorization: "Bearer ${key}" },
});
const { business, totalReviews, averageRating, reviews } = await res.json();`;
    case "php":
      return `<?php
$res = wp_remote_get("${endpoint}", [
  "headers" => ["Authorization" => "Bearer ${key}"],
]);
$data = json_decode(wp_remote_retrieve_body($res), true);
$reviews = $data["reviews"];`;
  }
}

const SAMPLE_RESPONSE = `{
  "business": { "id": "…", "name": "…", "url": "…", "source": "google", "lastScrapedAt": "…" },
  "totalReviews": 219,
  "averageRating": 4.8,
  "recommendedPercentage": null,
  "total": 219, "limit": 2000, "offset": 0, "hasMore": false,
  "reviews": [
    {
      "id": "…", "author": "Jane Smith", "rating": 5,
      "content": "Great service…", "postedAt": "2 weeks ago",
      "profilePicture": "https://…", "profileUrl": null,
      "recommendationStatus": null, "source": "google"
    }
  ]
}`;

/**
 * The JSON reviews API for one business, in the widget's Embed Code tab.
 *
 * The key is per business, not per widget: every widget for the business shares
 * it, and rotating it here changes it for all of them. Saying so on the screen
 * keeps someone from regenerating it and breaking an integration they didn't know
 * about.
 */
export function ReviewsApiPanel({ businessId, businessName, domain }: { businessId: string; businessName?: string; domain: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["business-api-key", businessId];
  const [revealed, setRevealed] = useState(false);
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState<string | null>(null);

  const endpoint = `${domain}/api/public/reviews`;

  const { data, isLoading, error } = useQuery<{ apiKey: string | null }, Error>({
    queryKey,
    queryFn: () => apiRequest<{ apiKey: string | null }>("GET", `/api/business-urls/${businessId}/api-key`),
    enabled: Boolean(businessId),
  });
  const apiKey = data?.apiKey ?? null;

  const rotate = useMutation<{ apiKey: string }, Error, void>({
    mutationFn: () => apiRequest("POST", `/api/business-urls/${businessId}/api-key`),
    onSuccess: (r) => {
      queryClient.setQueryData(queryKey, r);
      setRevealed(true);
      toast({ title: apiKey ? "New key generated" : "API key created", description: apiKey ? "The old key stopped working immediately." : undefined });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const revoke = useMutation<{ apiKey: null }, Error, void>({
    mutationFn: () => apiRequest("DELETE", `/api/business-urls/${businessId}/api-key`),
    onSuccess: (r) => {
      queryClient.setQueryData(queryKey, r);
      setRevealed(false);
      toast({ title: "API key revoked", description: "The reviews API is now off for this business." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copy = (what: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(what); setTimeout(() => setCopied(null), 1500); },
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  };

  const CopyBtn = ({ id, text, label = "Copy" }: { id: string; text: string; label?: string }) => (
    <Button variant="outline" size="sm" onClick={() => copy(id, text)} className={copied === id ? "border-green-300 bg-green-50 text-green-700" : ""}>
      {copied === id ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
      {copied === id ? "Copied!" : label}
    </Button>
  );

  const busy = rotate.isPending || revoke.isPending;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4">
        <h4 className="flex items-center gap-2 font-semibold text-gray-900">
          <Braces className="h-5 w-5 text-blue-600" />
          Reviews API (JSON)
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          Fetch every review for {businessName ? <strong>{businessName}</strong> : "this business"} as JSON from your own server.
          The key belongs to this business only and is shared by all of its widgets.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !apiKey ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">No API key yet. Create one to switch the reviews API on for this business.</p>
          <Button size="sm" onClick={() => rotate.mutate()} disabled={busy}>
            <KeyRound className="mr-1 h-4 w-4" />
            {rotate.isPending ? "Creating…" : "Create API key"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
                <span className="font-semibold text-green-700">GET</span> {endpoint}
              </code>
              <CopyBtn id="endpoint" text={endpoint} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Secret API key</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
                {revealed ? apiKey : mask(apiKey)}
              </code>
              <Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)}>
                {revealed ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                {revealed ? "Hide" : "Show"}
              </Button>
              <CopyBtn id="key" text={apiKey} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg bg-gray-100 p-1">
                {LANGS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLang(l.key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium ${lang === l.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <CopyBtn id={`ex-${lang}`} text={example(lang, endpoint, apiKey)} label="Copy example" />
            </div>
            <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-900 p-4 text-sm text-gray-100">
              <code>{example(lang, endpoint, revealed ? apiKey : mask(apiKey))}</code>
            </pre>
          </div>

          <details className="group rounded-lg border border-gray-200">
            <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-gray-700">
              Response and options
            </summary>
            <div className="space-y-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
              <pre className="overflow-x-auto rounded-lg border bg-gray-50 p-3 text-xs text-gray-800"><code>{SAMPLE_RESPONSE}</code></pre>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>Returns every review by default, including star ratings left without a comment.</li>
                <li><code className="rounded bg-gray-100 px-1">?limit=50&amp;offset=0</code> pages through the reviews, up to 2000 per request.</li>
                <li><code className="rounded bg-gray-100 px-1">?minRating=4</code> keeps only 4 and 5 star reviews. On Facebook, 2 or more keeps recommended reviews only.</li>
              </ul>
            </div>
          </details>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <ShieldCheck className="h-4 w-4" /> Keep this key secret
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-amber-800">
              <li>Call the API from a server. Browser requests are blocked, so the key never reaches a visitor.</li>
              <li>Send the key in the <code className="rounded bg-amber-100 px-1">Authorization</code> header. Keys put in a URL are refused.</li>
              <li>Each business has its own key. If one leaks, regenerate it: the old key stops working at once.</li>
            </ul>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Revoke this key? The reviews API stops working for this business until a new key is created.")) revoke.mutate();
              }}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {revoke.isPending ? "Revoking…" : "Revoke"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Generate a new key? The current key stops working immediately, and anything using it must be updated.")) rotate.mutate();
              }}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${rotate.isPending ? "animate-spin" : ""}`} />
              {rotate.isPending ? "Generating…" : "Regenerate key"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
