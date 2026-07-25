import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { RefreshCw } from "lucide-react";
import { suggestPassword } from "@vrm/lib/tenants/password";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

/**
 * The zod fields for a video tenant (zod v3, matching the scraper's forms). Spread
 * into a schema at each call site, and matched by the field names VideoReviewFields
 * renders. The messages mirror videoTenantSchema in lib/videoTenant.ts, the v4 schema
 * the API validates with -- keep the two in step.
 */
export const videoReviewZodFields = {
  contactEmail: z.string().trim().email("Enter a valid business email."),
  contactPhone: z.string().trim().max(40).optional(),
  adminPassword: z.string().min(8, "The login password must be at least 8 characters."),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand colour must be a hex value like #8A9A5B."),
  rootDomain: z.string().trim().max(255).optional(),
  logoUrl: z.union([z.string().url("Enter a valid URL."), z.literal("")]).optional(),
};

/** Sensible starting values for the video fields, including a spoken-word password. */
export function videoReviewDefaults() {
  return {
    contactEmail: "",
    contactPhone: "",
    adminPassword: suggestPassword(),
    brandColor: "#8A9A5B",
    rootDomain: "",
    logoUrl: "",
  };
}

/**
 * The Video Review Manager tenant fields, the exact set the New Tenant dialog
 * collects. Shared by the Add Business dialog (create a business with video reviews)
 * and the Enable Video dialog (turn video reviews on for an existing business), so the
 * two ask for the same things in the same way.
 *
 * The parent form must have these field names: contactEmail, contactPhone,
 * adminPassword, brandColor, rootDomain, logoUrl. Typed loosely because the two
 * parent schemas differ in their non-video fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function VideoReviewFields({ form }: { form: UseFormReturn<any> }) {
  const brandColor: string = form.watch("brandColor") || "#8A9A5B";

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business email (this is their login)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="owner@acme.co.uk" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="w-40">
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="07700 900123" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <FormField
            control={form.control}
            name="adminPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary password</FormLabel>
                <FormControl>
                  {/* type=text on purpose: you read this out to the client, so hiding
                      it behind dots helps nobody. */}
                  <Input type="text" className="font-mono" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => form.setValue("adminPassword", suggestPassword(), { shouldValidate: true })}
          title="Generate a new password"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <FormField
          control={form.control}
          name="brandColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand colour</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-gray-200 bg-white p-1"
                  />
                  <span className="font-mono text-xs text-gray-500">{brandColor.toUpperCase()}</span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <FormField
            control={form.control}
            name="rootDomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Their website (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="njdesignpark.com" autoComplete="off" spellCheck={false} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex-1">
          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo URL (optional)</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://…/logo.png" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
