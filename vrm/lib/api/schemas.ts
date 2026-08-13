import { z } from "zod/v4";

/**
 * Field rules for the settings half of the API, defined once.
 *
 * Three routes accept these now: /settings (both sections at once), /collection
 * and /branding (each on its own, with the full set of verbs). Three copies of
 * "name is 1 to 120 characters" is three chances for one of them to drift, and the
 * drift would show up as a value the API accepts and the dashboard then refuses to
 * display.
 *
 * Every limit here matches the dashboard form it mirrors, deliberately. An API
 * that accepts an eleventh prompt question the UI will silently drop is worse than
 * one that says no.
 */

const name = z.string().trim().min(1).max(120);

const brandColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: "Use a hex colour like #8A9A5B." });

/**
 * Null and "" both mean "remove it". JSON callers reach for null, form-shaped
 * callers send the empty string, and both are clearer than omitting the key, which
 * a merge has to read as "leave it alone".
 */
const optionalUrl = z.union([z.url(), z.literal(""), z.null()]);
const optionalEmail = z.union([z.email(), z.literal(""), z.null()]);
const optionalPhone = z.union([z.string().trim().max(40), z.null()]);

const introTitle = z.string().trim().min(1).max(120);
// Several paragraphs, one per blank line, so it needs more room than the one-liners.
const introBody = z.string().trim().max(1500);
const welcomeText = z.string().trim().min(1).max(300);
const description = z.string().trim().max(300);
const thankYouText = z.string().trim().min(1).max(300);

// Ten is the cap the dashboard enforces. Say so here rather than silently
// dropping the eleventh question the caller thought it had saved.
const promptQuestions = z
  .array(z.string().trim().min(1).max(300))
  .max(10, { error: "No more than 10 prompt questions." });

/** PATCH: every field optional, and only what is sent gets changed. */
export const BrandingPatchSchema = z.object({
  name: name.optional(),
  brand_color: brandColor.optional(),
  logo_url: optionalUrl.optional(),
  contact_email: optionalEmail.optional(),
  contact_phone: optionalPhone.optional(),
});

/**
 * PUT: a full replacement, so the required fields are genuinely required and
 * anything omitted is cleared rather than kept. That is the difference between PUT
 * and PATCH, and it is the whole reason to offer both.
 */
export const BrandingPutSchema = z.object({
  name,
  brand_color: brandColor,
  logo_url: optionalUrl.optional(),
  contact_email: optionalEmail.optional(),
  contact_phone: optionalPhone.optional(),
});

export const CollectionPatchSchema = z.object({
  intro_title: introTitle.optional(),
  intro_body: introBody.optional(),
  welcome_text: welcomeText.optional(),
  description: description.optional(),
  thank_you_text: thankYouText.optional(),
  prompt_questions: promptQuestions.optional(),
});

export const CollectionPutSchema = z.object({
  intro_title: introTitle,
  welcome_text: welcomeText,
  thank_you_text: thankYouText,
  intro_body: introBody.optional(),
  description: description.optional(),
  prompt_questions: promptQuestions.optional(),
});

export const WidgetPatchSchema = z.object({
  layout: z
    .enum(["grid", "carousel", "single"], {
      error: "layout must be one of: grid, carousel, single.",
    })
    .optional(),
  autoplay: z.boolean().optional(),
});

/** An empty body is a caller bug, and a silent 200 hides it. */
export function requireSomeKey<T extends z.ZodObject<z.ZodRawShape>>(schema: T, fields: string) {
  return schema.refine((v) => Object.keys(v as object).length > 0, {
    error: `Send at least one of: ${fields}.`,
  });
}
