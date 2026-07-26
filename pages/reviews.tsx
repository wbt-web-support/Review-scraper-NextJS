import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Chrome, Facebook, Eye, Trash2, Plus, Search, Pencil, MoreVertical, MessageSquare,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "../components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { EditBusinessDialog } from "../components/EditBusinessDialog";
import { titleCaseName } from "@vrm/lib/tenants/display-name";

interface IBusinessDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}
interface IBusinessUrl {
  _id: string;
  name: string;
  url: string;
  urlHash: string;
  source: "google" | "facebook";
  details?: IBusinessDetails;
}

const addBusinessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  url: z.string().url("Must be a valid URL."),
  source: z.enum(["google", "facebook"], { required_error: "Please select a source." }),
});
type AddBusinessData = z.infer<typeof addBusinessSchema>;

const Reviews = () => {
  const [activeTab, setActiveTab] = useState<"all" | "google" | "facebook">("all");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IBusinessUrl | null>(null);
  const [editTarget, setEditTarget] = useState<IBusinessUrl | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ businessUrls: IBusinessUrl[] }>({
    queryKey: ["businessUrls"],
    queryFn: () => apiRequest("GET", "/api/business-urls/all"),
  });
  const businesses = useMemo(() => data?.businessUrls ?? [], [data]);

  // Scraped review counts for every row, in one batch query.
  const { data: counts } = useQuery<{ scraped: Record<string, number> }>({
    queryKey: ["businessCounts"],
    queryFn: () => apiRequest("GET", "/api/business-urls/counts"),
  });

  const filtered = useMemo(() => {
    let list = businesses;
    if (activeTab !== "all") list = list.filter((b) => b.source === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    return list;
  }, [businesses, activeTab, search]);

  const form = useForm<AddBusinessData>({
    resolver: zodResolver(addBusinessSchema),
    defaultValues: { name: "", url: "", source: "google" },
  });

  const addMutation = useMutation<IBusinessUrl, Error, AddBusinessData>({
    mutationFn: (values) => apiRequest("POST", "/api/business-urls", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businessUrls"] });
      queryClient.invalidateQueries({ queryKey: ["businessCounts"] });
      setIsAddOpen(false);
      form.reset({ name: "", url: "", source: "google" });
      toast({ title: "Business added" });
    },
    onError: (e) => toast({ title: "Could not add the business", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiRequest("DELETE", `/api/business-urls/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businessUrls"] });
      queryClient.invalidateQueries({ queryKey: ["businessCounts"] });
      setDeleteTarget(null);
      toast({ title: "Business deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
            <p className="text-sm text-gray-500">Every business you scrape Google and Facebook reviews for, in one place.</p>
          </div>
          <Button onClick={() => { form.reset({ name: "", url: "", source: "google" }); setIsAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Business
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "google" | "facebook")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="facebook">Facebook</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search businesses…"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-gray-500">No businesses yet. Add one to start collecting reviews.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Business</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 text-center font-medium">Reviews</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const scraped = counts?.scraped[b.urlHash];
                  return (
                    <tr key={b._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                      <td className="px-5 py-3">
                        <Link href={`/reviews/${b._id}`} className="group flex items-center gap-3">
                          {b.details?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.details.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-gray-200 object-contain bg-white" />
                          ) : (
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${b.source === "google" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                              {b.source === "google" ? <Chrome className="h-4 w-4" /> : <Facebook className="h-4 w-4" />}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-gray-900 group-hover:text-blue-600" title={b.name}>{titleCaseName(b.name)}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs capitalize text-gray-400">{b.source}</span>
                            </span>
                            <span className="block max-w-[20rem] truncate text-xs text-gray-400" title={b.url}>{b.url}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {b.details?.email ? <span className="truncate">{b.details.email}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                          {scraped === undefined ? <span className="text-gray-300">·</span> : scraped}
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
                                <Link href={`/reviews/${b._id}`} className="cursor-pointer">
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditTarget(b)} className="cursor-pointer">
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteTarget(b)} className="cursor-pointer text-red-600 focus:text-red-700">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Business (scraping) */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Business</DialogTitle>
            <DialogDescription>
              Connect a Google or Facebook review source to start scraping. For video
              testimonials, use the Video Reviews section instead.
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
              <div className="flex gap-3">
                <div className="w-40">
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business URL</FormLabel>
                        <FormControl>
                          <Input placeholder={form.watch("source") === "google" ? "Google Maps URL…" : "Facebook reviews URL…"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Adding…" : "Add Business"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit business */}
      <EditBusinessDialog
        business={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete business</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Reviews;
