import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "./ui/form";
import { CATEGORY_KEY, DEFAULT_SERVICES, servicesFor, type ServiceCategory } from "../lib/reviewCategories";

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
  /** Own service categories for reviews; absent means the default list. */
  services?: ServiceCategory[];
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

/** One editable service row. Keywords are kept as the typed text until save. */
interface ServiceRow {
  key: string;
  label: string;
  keywords: string;
  enabled: boolean;
}

/**
 * The business's services, then any default it does not have, switched off, so an
 * operator can bring a default back without retyping its words.
 */
function toRows(b: EditableBusiness | null): ServiceRow[] {
  const own = servicesFor(b);
  const rows: ServiceRow[] = own.map((s) => ({ key: s.key, label: s.label, keywords: s.keywords.join(", "), enabled: true }));
  const have = new Set(own.map((s) => s.key));
  for (const s of DEFAULT_SERVICES) {
    if (!have.has(s.key)) rows.push({ key: s.key, label: s.label, keywords: s.keywords.join(", "), enabled: false });
  }
  return rows;
}

const defaultRows = (): ServiceRow[] =>
  DEFAULT_SERVICES.map((s) => ({ key: s.key, label: s.label, keywords: s.keywords.join(", "), enabled: true }));

/** A category id from a label: lowercase, dashes, unique among the rows. */
function slugFor(label: string, taken: Set<string>): string | null {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);
  if (!CATEGORY_KEY.test(base)) return null;
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

interface RetagResult {
  checked: number;
  changed: number;
  manual: number;
  counts: Record<string, number>;
  general: number;
}

/** "Boilers & heating 120, EV charging 40, general 300" */
export function describeRetag(result: RetagResult, services: { key: string; label: string }[]): string {
  const parts = services
    .filter((s) => (result.counts[s.key] ?? 0) > 0)
    .map((s) => `${s.label} ${result.counts[s.key]}`);
  parts.push(`general ${result.general}`);
  return parts.join(", ");
}

/**
 * Edit a business's contact and branding details, and its service categories.
 *
 * The scraper app owns these details; when video reviews are on, saving also mirrors
 * the name, email, phone, colour and logo onto the Supabase tenant so the collection
 * page reflects them (the API does that half). firstName/lastName live only here.
 *
 * Services are the categories reviews are tagged with (lib/reviewCategories): each
 * has a label for the widget's button and the words that put a review under it.
 * Saving re-tags the stored reviews straight away; the toast says how many landed
 * where.
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
  const [rows, setRows] = useState<ServiceRow[]>(() => toRows(business));
  const [newLabel, setNewLabel] = useState("");

  const form = useForm<EditData>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(business),
  });

  // Re-seed whenever a different business is opened.
  useEffect(() => {
    if (open) {
      form.reset(toDefaults(business));
      setRows(toRows(business));
      setNewLabel("");
    }
  }, [open, business, form]);

  const mutation = useMutation<{ message?: string; categories?: RetagResult } | undefined, Error, EditData & { services: ServiceCategory[] }>({
    mutationFn: (values) => apiRequest("PUT", `${endpoint}/${business!._id}`, values),
    onSuccess: (result, values) => {
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      // The business's page also holds its own copies (the record and the video
      // tenant). Left stale, the Branding tab saved its old values over this edit.
      if (business) queryClient.invalidateQueries({ queryKey: ["videoBusiness", business._id] });
      if (business) queryClient.invalidateQueries({ queryKey: ["tenant", business._id] });
      if (business) queryClient.invalidateQueries({ queryKey: ["myTenant", business._id] });
      if (business) queryClient.invalidateQueries({ queryKey: ["reviews", business._id] });
      onOpenChange(false);
      const retag = result?.categories;
      toast({
        title: "Business updated",
        description: retag && values.services ? `Reviews tagged: ${describeRetag(retag, values.services)}` : undefined,
      });
    },
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const brandColor = form.watch("brandColor") || "#8A9A5B";
  // Services tag scraped reviews. A video business has none, so its dialog keeps
  // to the details and sends nothing new to its own endpoint.
  const hasServices = endpoint === "/api/business-urls";

  const updateRow = (key: string, patch: Partial<ServiceRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addService = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugFor(label, new Set(rows.map((r) => r.key)));
    if (!key) {
      toast({ title: "Use letters or numbers in the service name", variant: "destructive" });
      return;
    }
    setRows((prev) => [...prev, { key, label, keywords: "", enabled: true }]);
    setNewLabel("");
  };

  const submit = (values: EditData) => {
    if (!hasServices) {
      mutation.mutate(values as EditData & { services: ServiceCategory[] });
      return;
    }
    const services: ServiceCategory[] = [];
    for (const row of rows) {
      if (!row.enabled) continue;
      const label = row.label.trim();
      if (!label || label.length > 40) {
        toast({ title: "Each service needs a name of up to 40 characters", variant: "destructive" });
        return;
      }
      services.push({
        key: row.key,
        label,
        keywords: row.keywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean),
      });
    }
    mutation.mutate({ ...values, services });
  };

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
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-2">
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

            {/* Services: what reviews are tagged with, and the words that do it. */}
            {hasServices && <div className="space-y-3 border-t border-gray-200 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label>Services</Label>
                  <p className="mt-1 text-xs text-gray-500">
                    A review is tagged with every service whose words appear in it. Reviews that name no service are general feedback and show under every service.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setRows(defaultRows())}>
                  Reset to defaults
                </Button>
              </div>

              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.key} className={`rounded-lg border border-gray-200 p-3 ${row.enabled ? "" : "opacity-60"}`}>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(enabled) => updateRow(row.key, { enabled })}
                        aria-label={`${row.label || row.key} on or off`}
                      />
                      <Input
                        value={row.label}
                        onChange={(e) => updateRow(row.key, { label: e.target.value })}
                        placeholder="Service name"
                        className="h-8 flex-1"
                        disabled={!row.enabled}
                      />
                      <span className="shrink-0 font-mono text-[11px] text-gray-400">{row.key}</span>
                    </div>
                    {row.enabled && (
                      <Input
                        value={row.keywords}
                        onChange={(e) => updateRow(row.key, { keywords: e.target.value })}
                        placeholder="Words that mean this service, separated by commas"
                        className="mt-2 h-8 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
                  placeholder="New service, e.g. Underfloor heating"
                  className="h-9"
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={addService} disabled={!newLabel.trim()}>
                  Add a service
                </Button>
              </div>
            </div>}

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
