import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "./ui/form";

export interface EditableBusiness {
  _id: string;
  name: string;
  video?: { tenantId: string };
  details?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    brandColor?: string;
    logoUrl?: string;
  };
}

const schema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters."),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Brand colour must be a hex value like #8A9A5B."),
  logoUrl: z.union([z.string().url("Enter a valid URL."), z.literal("")]).optional(),
});
type EditData = z.infer<typeof schema>;

function toDefaults(b: EditableBusiness | null): EditData {
  return {
    name: b?.name ?? "",
    firstName: b?.details?.firstName ?? "",
    lastName: b?.details?.lastName ?? "",
    email: b?.details?.email ?? "",
    phone: b?.details?.phone ?? "",
    brandColor: b?.details?.brandColor ?? "#8A9A5B",
    logoUrl: b?.details?.logoUrl ?? "",
  };
}

/**
 * Edit a business's contact and branding details.
 *
 * The scraper app owns these details; when video reviews are on, saving also mirrors
 * the name, email, phone, colour and logo onto the Supabase tenant so the collection
 * page reflects them (the API does that half). firstName/lastName live only here.
 */
export function EditBusinessDialog({
  business,
  open,
  onOpenChange,
  endpoint = "/api/business-urls",
  invalidateKey = "businessUrls",
}: {
  business: EditableBusiness | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Base path to PUT to. `${endpoint}/${id}`. Video businesses use /api/video-businesses. */
  endpoint?: string;
  /** Query key to invalidate after a save. */
  invalidateKey?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditData>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(business),
  });

  // Re-seed whenever a different business is opened.
  useEffect(() => {
    if (open) form.reset(toDefaults(business));
  }, [open, business, form]);

  const mutation = useMutation<unknown, Error, EditData>({
    mutationFn: (values) => apiRequest("PUT", `${endpoint}/${business!._id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      onOpenChange(false);
      toast({ title: "Business updated" });
    },
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const brandColor = form.watch("brandColor") || "#8A9A5B";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit business</DialogTitle>
          <DialogDescription>
            {business?.video
              ? "Saved changes also update this business's video collection page."
              : "Update the business's contact and branding details."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl><Input placeholder="Acme Renewables" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl><Input placeholder="Jane" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="owner@acme.co.uk" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="w-44">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile number</FormLabel>
                      <FormControl><Input type="tel" placeholder="07700 900123" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="brandColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme colour</FormLabel>
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
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl><Input type="url" placeholder="https://…/logo.png" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
