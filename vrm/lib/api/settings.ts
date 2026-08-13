import "server-only";

import { createAdminClient } from "@vrm/lib/supabase/admin";
import {
  updateBranding,
  updateCollection,
  updateWidgetSettings,
} from "@/lib/tenantAdmin";

/**
 * The settings half of the tenant-facing API.
 *
 * Reads are local. Writes are NOT: they delegate to lib/tenantAdmin, which is
 * already the tenant-scoped implementation the business profile page writes
 * through. One writer per table means the API cannot quietly diverge from the
 * dashboard -- no second place that forgets to null an empty logo_url, or skips
 * the 10-question cap on prompts.
 *
 * Scope is deliberately "what the tenant can change about themselves". Custom
 * domain, video length, open mode and key rotation are left out: the first two
 * provision DNS and cost money, the last would let a caller sever the very key it
 * is calling with. Those stay in the dashboard where a human confirms them.
 */

export type ApiSettings = {
  branding: {
    name: string;
    brand_color: string;
    logo_url: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  };
  collection: {
    /** First step: the ask. */
    intro_title: string;
    intro_body: string;
    /** Second step: the brief, above the prompt questions. */
    welcome_text: string;
    description: string;
    thank_you_text: string;
    prompt_questions: string[];
  };
  widget: {
    layout: "grid" | "carousel" | "single";
    autoplay: boolean;
    /** Read-only here: the dashboard has no control for it, so the API grants none either. */
    theme: "light" | "dark" | "auto";
  };
};

/** Every field optional, at both levels: a caller sends only what it means to change. */
export type ApiSettingsPatch = {
  branding?: Partial<ApiSettings["branding"]>;
  collection?: Partial<ApiSettings["collection"]>;
  widget?: Partial<Omit<ApiSettings["widget"], "theme">>;
};

/**
 * What DELETE resets to.
 *
 * These are the Postgres column defaults, copied deliberately rather than left to
 * drift: a client who resets their collection page should land on the same wording
 * a brand new tenant gets, not on whatever an empty string renders as.
 */
export const COLLECTION_DEFAULTS: ApiSettings["collection"] = {
  intro_title: "We value your feedback",
  intro_body:
    "Client recommendations are at the heart of what we do.\n\n" +
    "We would be incredibly grateful if you could take 60 seconds to record a quick, " +
    "unscripted video review of our work together.\n\n" +
    "Thank you!",
  welcome_text: "We would love to hear from you.",
  description: "",
  thank_you_text: "Thank you for your review!",
  prompt_questions: [],
};

export const DEFAULT_BRAND_COLOR = "#8A9A5B";

/**
 * The three tables behind the settings tabs, read directly.
 *
 * Deliberately not getTenantBundle: that one resolves DNS through the Vercel API
 * on every call, which is a fine price for a settings page and a silly one for an
 * endpoint a client might poll.
 */
export async function getApiSettings(tenantId: string): Promise<ApiSettings> {
  const admin = createAdminClient();

  const [{ data: tenant, error: tenantError }, { data: collection }, { data: widget }] =
    await Promise.all([
      admin
        .from("tenants")
        .select("name, brand_color, logo_url, contact_email, contact_phone")
        .eq("id", tenantId)
        .maybeSingle(),
      admin
        .from("collection_settings")
        .select("welcome_text, description, thank_you_text, prompt_questions, intro_title, intro_body")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin
        .from("widget_settings")
        .select("layout, autoplay, theme")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

  if (tenantError) throw new Error(tenantError.message);
  if (!tenant) throw new Error("That tenant no longer exists.");

  const questions = collection?.prompt_questions;

  return {
    branding: {
      name: tenant.name,
      brand_color: tenant.brand_color,
      logo_url: tenant.logo_url,
      contact_email: tenant.contact_email,
      contact_phone: tenant.contact_phone,
    },
    collection: {
      intro_title: collection?.intro_title ?? COLLECTION_DEFAULTS.intro_title,
      intro_body: collection?.intro_body ?? "",
      welcome_text: collection?.welcome_text ?? "",
      description: collection?.description ?? "",
      thank_you_text: collection?.thank_you_text ?? "",
      prompt_questions: Array.isArray(questions)
        ? questions.filter((q): q is string => typeof q === "string")
        : [],
    },
    widget: {
      layout: widget?.layout ?? "grid",
      autoplay: widget?.autoplay ?? false,
      theme: widget?.theme ?? "light",
    },
  };
}

/**
 * Apply a partial patch and return the result.
 *
 * The writers underneath take whole sections, so anything the caller left out is
 * read back from the current row and passed through unchanged. Without that merge
 * a caller sending `{"branding":{"name":"X"}}` would silently blank their own logo
 * and phone number, which is a rough way to learn how an API works.
 *
 * Only sections that actually appear in the patch are written, so a name change
 * does not bump updated_at on the collection page and the widget too.
 */
export async function applyApiSettings(
  tenantId: string,
  patch: ApiSettingsPatch,
): Promise<ApiSettings> {
  const current = await getApiSettings(tenantId);

  if (patch.branding) {
    const next = { ...current.branding, ...patch.branding };
    await updateBranding(tenantId, {
      name: next.name,
      brandColor: next.brand_color,
      logoUrl: next.logo_url ?? "",
      contactEmail: next.contact_email ?? "",
      contactPhone: next.contact_phone ?? "",
    });
  }

  if (patch.collection) {
    const next = { ...current.collection, ...patch.collection };
    await updateCollection(tenantId, {
      welcomeText: next.welcome_text,
      description: next.description,
      thankYouText: next.thank_you_text,
      promptQuestions: next.prompt_questions,
      introTitle: next.intro_title,
      introBody: next.intro_body,
    });
  }

  if (patch.widget) {
    const next = { ...current.widget, ...patch.widget };
    await updateWidgetSettings(tenantId, {
      layout: next.layout,
      autoplay: next.autoplay,
    });
  }

  return getApiSettings(tenantId);
}

/** DELETE /collection: back to the wording a brand new tenant starts with. */
export async function resetApiCollection(tenantId: string): Promise<ApiSettings> {
  return applyApiSettings(tenantId, { collection: COLLECTION_DEFAULTS });
}

/**
 * DELETE /branding: clear the optional marks and go back to the default colour.
 *
 * The name survives, because a tenant without one has no collection page heading,
 * no widget attribution and nothing to show in the dashboard list. "Delete the
 * branding" means "take off what we added", not "leave the business nameless".
 */
export async function resetApiBranding(tenantId: string): Promise<ApiSettings> {
  return applyApiSettings(tenantId, {
    branding: {
      brand_color: DEFAULT_BRAND_COLOR,
      logo_url: null,
      contact_email: null,
      contact_phone: null,
    },
  });
}
