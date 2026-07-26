import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

/** The fields of the tenant bundle this settings panel needs. */
export interface ClientSettingsBundle {
  tenant: {
    name: string;
    logo_url: string | null;
    brand_color: string;
    contact_email: string | null;
    contact_phone: string | null;
    max_video_seconds: number;
  };
  collection: { welcome_text: string; description: string; thank_you_text: string; prompt_questions: string[] };
  limits: { min: number; max: number };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function ClientSettings({ base, businessId, bundle }: { base: string; businessId: string; bundle: ClientSettingsBundle }) {
  const { toast } = useToast();

  // --- Branding ---
  const [name, setName] = useState(bundle.tenant.name);
  const [brandColor, setBrandColor] = useState(bundle.tenant.brand_color || "#4f46e5");
  const [logoUrl, setLogoUrl] = useState(bundle.tenant.logo_url ?? "");
  const [phone, setPhone] = useState(bundle.tenant.contact_phone ?? "");

  const brandingSave = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, {
      section: "clientBranding", name, brandColor, logoUrl: logoUrl || undefined, contactPhone: phone || undefined,
    }),
    onSuccess: () => toast({ title: "Branding saved", description: "Your collection page and widget will reflect it shortly." }),
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  // --- Collection page ---
  const [welcome, setWelcome] = useState(bundle.collection.welcome_text);
  const [description, setDescription] = useState(bundle.collection.description);
  const [thanks, setThanks] = useState(bundle.collection.thank_you_text);
  const [questions, setQuestions] = useState(bundle.collection.prompt_questions.join("\n"));

  const collectionSave = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, {
      section: "collection", welcomeText: welcome, description, thankYouText: thanks,
      promptQuestions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
    }),
    onSuccess: () => toast({ title: "Collection page saved" }),
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  // --- Video length ---
  const [maxSeconds, setMaxSeconds] = useState(String(bundle.tenant.max_video_seconds));
  const lengthSave = useMutation<{ message?: string }, Error, void>({
    mutationFn: () => apiRequest("PUT", `${base}/settings`, { section: "videoLimit", maxVideoSeconds: Number(maxSeconds) }),
    onSuccess: (r) => toast({ title: "Saved", description: r?.message }),
    onError: (e) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  // --- Password ---
  const [newPassword, setNewPassword] = useState("");
  const passwordSave = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest("POST", `/api/video-businesses/${businessId}/reset-login`, { password: newPassword }),
    onSuccess: () => { setNewPassword(""); toast({ title: "Password updated", description: "Use your new password next time you sign in." }); },
    onError: (e) => toast({ title: "Could not update password", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Branding */}
      <Section title="Branding" hint="Shown on your collection page and review widget.">
        <Field label="Business name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-4">
          <Field label="Brand colour">
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-1" />
              <span className="font-mono text-xs text-gray-500">{brandColor.toUpperCase()}</span>
            </div>
          </Field>
          <div className="min-w-[12rem] flex-1">
            <Field label="Phone (optional)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07700 900123" /></Field>
          </div>
        </div>
        <Field label="Logo URL (optional)"><Input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" /></Field>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Login email: <span className="font-medium text-gray-700">{bundle.tenant.contact_email || "—"}</span> — this can&apos;t be changed here.
        </div>
        <div className="flex justify-end">
          <Button onClick={() => brandingSave.mutate()} disabled={brandingSave.isPending} style={{ backgroundColor: brandColor }}>{brandingSave.isPending ? "Saving…" : "Save branding"}</Button>
        </div>
      </Section>

      {/* Collection page */}
      <Section title="Collection page" hint="The words your customers see when leaving a review.">
        <Field label="Welcome text"><Input value={welcome} onChange={(e) => setWelcome(e.target.value)} /></Field>
        <Field label="Description (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Thank-you text"><Input value={thanks} onChange={(e) => setThanks(e.target.value)} /></Field>
        <Field label="Prompt questions (one per line)"><Textarea rows={5} value={questions} onChange={(e) => setQuestions(e.target.value)} /></Field>
        <div className="flex justify-end">
          <Button onClick={() => collectionSave.mutate()} disabled={collectionSave.isPending} style={{ backgroundColor: brandColor }}>{collectionSave.isPending ? "Saving…" : "Save collection page"}</Button>
        </div>
      </Section>

      {/* Video length */}
      <Section title="Video length" hint={`How long a customer's video can be (between ${bundle.limits.min} and ${bundle.limits.max} seconds).`}>
        <Field label="Maximum length (seconds)">
          <Input type="number" min={bundle.limits.min} max={bundle.limits.max} value={maxSeconds} onChange={(e) => setMaxSeconds(e.target.value)} className="w-40" />
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => lengthSave.mutate()} disabled={lengthSave.isPending} style={{ backgroundColor: brandColor }}>{lengthSave.isPending ? "Saving…" : "Save length"}</Button>
        </div>
      </Section>

      {/* Password */}
      <Section title="Password" hint="Change the password you use to sign in.">
        <Field label="New password (min 8 characters)">
          <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="max-w-sm font-mono" />
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => passwordSave.mutate()} disabled={passwordSave.isPending || newPassword.trim().length < 8} style={{ backgroundColor: brandColor }}>
            {passwordSave.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </Section>
    </div>
  );
}
