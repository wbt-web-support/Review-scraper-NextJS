import { z } from 'zod';
export const businessUrlSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters long.").max(100, "Business name cannot exceed 100 characters."),
  url: z.string().trim().url({ message: "Please enter a valid URL (e.g., https://example.com)." }),
  source: z.enum(["google", "facebook"], {
    required_error: "Please select a source (Google or Facebook).",
    invalid_type_error: "Invalid source selected.",
  }),
});
export type BusinessUrlFormData = z.infer<typeof businessUrlSchema>;