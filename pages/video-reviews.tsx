import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Video, Eye, Trash2, Plus, Search, Pencil, MoreVertical } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { VideoReviewFields, videoReviewZodFields, videoReviewDefaults } from "../components/VideoReviewFields";
import { EditBusinessDialog } from "../components/EditBusinessDialog";
import { titleCaseName } from "@vrm/lib/tenants/display-name";

interface IVideoBusiness {
  _id: string;
  name: string;
  video: { tenantId: string; slug: string; embedKey: string; collectUrl: string };
  details?: { firstName?: string; lastName?: string; email?: string; phone?: string; brandColor?: string; logoUrl?: string };
}

const addSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  ...videoReviewZodFields,
});
type AddData = z.infer<typeof addSchema>;

const VideoReviews = () => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IVideoBusiness | null>(null);
  const [editTarget, setEditTarget] = useState<IVideoBusiness | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ videoBusinesses: IVideoBusiness[] }>({
    queryKey: ["videoBusinesses"],
    queryFn: () => apiRequest("GET", "/api/video-businesses"),
  });
  const businesses = useMemo(() => data?.videoBusinesses ?? [], [data]);

  const { data: counts } = useQuery<{ video: Record<string, number> }>({
    queryKey: ["businessCounts"],
    queryFn: () => apiRequest("GET", "/api/business-urls/counts"),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return businesses;
    const q = search.trim().toLowerCase();
    return businesses.filter((b) => b.name.toLowerCase().includes(q));
  }, [businesses, search]);

  const form = useForm<AddData>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", ...videoReviewDefaults() },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["videoBusinesses"] });
    queryClient.invalidateQueries({ queryKey: ["businessCounts"] });
  };

  const addMutation = useMutation<IVideoBusiness, Error, AddData>({
    mutationFn: (values) => apiRequest("POST", "/api/video-businesses", values),
    onSuccess: () => {
      invalidate();
      setIsAddOpen(false);
      form.reset({ name: "", ...videoReviewDefaults() });
      toast({ title: "Video business added", description: "Its collection page and login are ready." });
    },
    onError: (e) => toast({ title: "Could not add the business", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiRequest("DELETE", `/api/video-businesses/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Video business deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Video Reviews</h1>
            <p className="mt-1 text-sm text-gray-500">Businesses that collect video testimonials from their customers.</p>
          </div>
          <Button onClick={() => { form.reset({ name: "", ...videoReviewDefaults() }); setIsAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Business
          </Button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search video businesses…" className="pl-9" />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-500">
              <Video className="h-6 w-6" />
            </div>
            <p className="mt-3 font-medium text-gray-900">No video businesses yet</p>
            <p className="mt-1 text-sm text-gray-500">Add one to give a client a branded video-review collection page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 text-center font-medium">Video reviews</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <Link href={`/video-reviews/${b._id}`} className="group flex items-center gap-3">
                        {b.details?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.details.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 bg-white object-contain" />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                            <Video className="h-4 w-4" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-900 group-hover:text-blue-600">{titleCaseName(b.name)}</span>
                          <span className="block max-w-[20rem] truncate text-xs text-gray-400">/c/{b.video.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{b.details?.email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Video className="h-3.5 w-3.5 text-purple-500" />
                        {counts?.video[b.video.tenantId] ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Actions">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem asChild>
                              <Link href={`/video-reviews/${b._id}`} className="cursor-pointer"><Eye className="mr-2 h-4 w-4" /> View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditTarget(b)} className="cursor-pointer"><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(b)} className="cursor-pointer text-red-600 focus:text-red-700"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Video Business */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Business</DialogTitle>
            <DialogDescription>
              Creates the collection page, embed key, subdomain, and the owner&apos;s login.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => addMutation.mutate(v))} className="space-y-4 pt-2">
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
              <VideoReviewFields form={form} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? "Adding…" : "Add Business"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <EditBusinessDialog
        business={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        endpoint="/api/video-businesses"
        invalidateKey="videoBusinesses"
      />

      {/* Delete */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete video business</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name}? Its video reviews, collection page and login are removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default VideoReviews;
