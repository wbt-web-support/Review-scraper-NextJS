import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import Layout from "../components/Layout";
import ReviewTable from "../components/ReviewTable";
import { useToast } from "../hooks/use-toast";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useRef } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "../components/ui/command";
import { Combobox, ComboboxOption } from "../components/ui/combobox";
import { Trash2 } from "lucide-react";
import { Loader, RefreshCcw } from "lucide-react";

interface IBusinessUrl {
  _id: string;
  userId?: string; 
  name: string;
  url: string;
  urlHash: string;
  source: 'google' | 'facebook';
  addedAt?: Date;
  lastScrapedAt?: Date; 
}

interface IReviewItem {
  _id?: string;
  reviewId?: string;
  author: string;
  content?: string | null;
  rating?: number | null;
  postedAt?: string;
  profilePicture?: string;
  recommendationStatus?: string;
  source?: 'google' | 'facebook';
  businessUrl?: {
    source: 'google' | 'facebook';
  };
  scrapedAt?: string | Date;
}

const businessUrlSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  url: z.string().url("Must be a valid URL."),
  source: z.enum(["google", "facebook"], { required_error: "Please select a source." })
});

type BusinessUrlFormData = z.infer<typeof businessUrlSchema>;

const _fetcher = (url: string) => fetch(url).then((res) => res.json());

const Reviews = () => {
  const [activeTab, setActiveTab] = useState<"all" | "google" | "facebook">("all");
  const [selectedBusinessUrl, setSelectedBusinessUrl] = useState<string>("");
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<IBusinessUrl | null>(null);
  const [newBusinessId, setNewBusinessId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Removed authentication redirect since data is not user-specific
    // if (authStatus === 'loading') return;
    // if (authStatus === 'unauthenticated') {
    //   router.push('/login?callbackUrl=/reviews');
    // }
  }, [authStatus, router]);

  const { data: businessUrlsData, isLoading: isBusinessUrlsLoading } = useQuery<{ businessUrls: IBusinessUrl[] }>({
    queryKey: ['businessUrls'],
    queryFn: () => apiRequest<{ businessUrls: IBusinessUrl[] }>("GET", '/api/business-urls/all'),
    enabled: true // Removed authentication requirement
  });

  const allBusinessUrls = useMemo(() => businessUrlsData?.businessUrls || [], [businessUrlsData]);
  
  const filteredBusinessUrls = useMemo(() => {
    let urls = allBusinessUrls;
    if (activeTab !== "all") {
      urls = urls.filter((url: IBusinessUrl) => url.source === activeTab);
    }
    if (searchText.trim()) {
      const lower = searchText.trim().toLowerCase();
      urls = urls.filter((url: IBusinessUrl) => url.name.toLowerCase().includes(lower));
    }
    return urls;
  }, [allBusinessUrls, activeTab, searchText]);

  useEffect(() => {
    if (filteredBusinessUrls.length > 0) {
      if (!selectedBusinessUrl || !filteredBusinessUrls.find(b => b._id === selectedBusinessUrl)) {
        setSelectedBusinessUrl(filteredBusinessUrls[0]._id);
      }
    } else {
      setSelectedBusinessUrl("");
    }
  }, [filteredBusinessUrls, selectedBusinessUrl]);

  const { data: reviewsData, isLoading: isReviewsLoading, error: reviewsError } = useQuery<{ reviews: IReviewItem[] }>({
    queryKey: ['reviews', selectedBusinessUrl],
    queryFn: async () => {
      if (!selectedBusinessUrl) return Promise.resolve({ reviews: [] });
      const selectedBusiness = allBusinessUrls.find(b => b._id === selectedBusinessUrl);
      if (!selectedBusiness) return Promise.resolve({ reviews: [] });
      
      console.log('Fetching reviews for business:', selectedBusiness);
      console.log('API URL:', `/api/business-urls/by-urlhash/${selectedBusiness.urlHash}/${selectedBusiness.source}/reviews`);
      
      try {
        const result = await apiRequest<{ reviews: IReviewItem[] }>("GET", `/api/business-urls/by-urlhash/${selectedBusiness.urlHash}/${selectedBusiness.source}/reviews`);
        console.log('API response:', result);
        console.log('Reviews count:', result?.reviews?.length || 0);
        return result;
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    },
    enabled: !!selectedBusinessUrl,
    retry: 1, // Only retry once
    retryDelay: 1000, // Wait 1 second before retry
  });

  const reviews = reviewsData?.reviews || [];
  console.log('Reviews to render:', reviews);
  
  // Log any errors
  if (reviewsError) {
    console.error('Reviews query error:', reviewsError);
  }

  const form = useForm<BusinessUrlFormData>({
    resolver: zodResolver(businessUrlSchema),
    defaultValues: { name: "", url: "", source: "google" }
  });

  const addBusinessUrlMutation = useMutation<
    { _id: string }, // Expecting the API to return the new business _id
    Error,
    BusinessUrlFormData
  >({
    mutationFn: async (newData: BusinessUrlFormData) => {
      const result = await apiRequest<{ _id: string }>("POST", "/api/business-urls", newData);
      // Expect result to have _id of new business
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['businessUrls'] });
      setNewBusinessId(data._id); // Save new business id for scraping
      // Don't close modal yet, show scrape button
      form.reset();
      toast({ title: "Success", description: "Business URL added successfully. You can now scrape reviews." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add business URL.", variant: "destructive" });
    }
  });

  const scrapeReviewsMutation = useMutation<{ message: string }, Error, string>({ 
    mutationFn: async (businessUrlId: string): Promise<{ message: string }> => {
      interface ApiScrapeResponse {
        success: boolean;
        message: string;
        reviews?: IReviewItem[]; 
      }
      const result = await apiRequest<ApiScrapeResponse>("POST", `/api/business-urls/${businessUrlId}/scrape`);
      if (!result || !result.success || typeof result.message !== 'string') {
        console.error("Invalid scrape response format or scraping failed:", result);
        throw new Error(result?.message || 'Scraping process reported an issue or returned an invalid format.');
      }
      return { message: result.message }; 
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', selectedBusinessUrl] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] }); 
      queryClient.invalidateQueries({ queryKey: ['latestReviews'] }); 
      toast({ title: "Scraping Initiated", description: data?.message || "Review scraping process started." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to scrape reviews.", variant: "destructive" });
    }
  });

  const deleteBusinessMutation = useMutation<void, Error, string>({
    mutationFn: async (businessUrlId: string) => {
      await apiRequest("DELETE", `/api/business-urls/${businessUrlId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessUrls'] });
      toast({
        title: "Success",
        description: "Business deleted successfully.",
      });
      setIsDeleteModalOpen(false);
      setBusinessToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete business.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (business: IBusinessUrl) => {
    setBusinessToDelete(business);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (businessToDelete) {
      deleteBusinessMutation.mutate(businessToDelete._id);
    }
  };

  const onSubmit = (data: BusinessUrlFormData) => {
    addBusinessUrlMutation.mutate(data);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
            <Button onClick={() => setIsAddBusinessModalOpen(true)}>Add Business</Button>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "google" | "facebook")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="facebook">Facebook</TabsTrigger>
            </TabsList>
          </Tabs>

          {isBusinessUrlsLoading ? (
            <div className="animate-pulse flex h-10 bg-gray-200 rounded"></div>
          ) : allBusinessUrls.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No businesses found. Add a business to start viewing reviews.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
              <div className="w-full sm:w-auto sm:min-w-[250px]">
                <Label htmlFor="business-combobox" className="mb-1 block">Select Business</Label>
                <Combobox
                  options={filteredBusinessUrls.map((url) => ({
                    value: url._id,
                    label: `${url.name ? url.name : "Unnamed Business"} (${url.source.charAt(0).toUpperCase() + url.source.slice(1)})`,
                  }))}
                  value={selectedBusinessUrl}
                  onChange={(val) => {
                    setSelectedBusinessUrl(val);
                    setSearchText(""); // Clear search on select
                  }}
                  placeholder="Search business by name..."
                  onInputChange={setSearchText}
                />
              </div>

              <div className="flex gap-2">
                {selectedBusinessUrl && (
                  <>
                    <Button 
                      onClick={() => scrapeReviewsMutation.mutate(selectedBusinessUrl)}
                      disabled={scrapeReviewsMutation.isPending}
                      className="bg-secondary-500 hover:bg-secondary-600 text-gray-800"
                    >
                      {scrapeReviewsMutation.isPending ? (
                        <>
                          <Loader className="mr-2 animate-spin text-gray-800" />
                          Recrawling...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="mr-2 text-gray-800" />
                          Recrawl Reviews
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDeleteClick(filteredBusinessUrls.find(b => b._id === selectedBusinessUrl)!)}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700 text-white  cursor-pointer" 
                    >
                      <Trash2 className="mr-2 text-white" />
                      Delete Business
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          <ReviewTable
            reviews={reviews}
            isLoading={isReviewsLoading}
            emptyState={
              <div className="text-center py-8">
                <p className="text-gray-500">No reviews found for this business.</p>
              </div>
            }
          />
        </div>
      </div>

      <Dialog open={isAddBusinessModalOpen} onOpenChange={(open) => { setIsAddBusinessModalOpen(open); if (!open) setNewBusinessId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Business</DialogTitle>
            <DialogDescription>
              Add a business from Google or Facebook to start scraping reviews.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. My Awesome Business" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={form.watch("source") === "google" ? "Google Maps URL..." : "Facebook Page Reviews URL..."}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={addBusinessUrlMutation.isPending || !!newBusinessId}>
                  {addBusinessUrlMutation.isPending ? "Adding..." : "Add Business"}
                </Button>
                {newBusinessId && (
                  <Button
                    type="button"
                    className="ml-2 bg-secondary-500 hover:bg-secondary-600 text-gray-800"
                    disabled={scrapeReviewsMutation.isPending}
                    onClick={async () => {
                      await scrapeReviewsMutation.mutateAsync(newBusinessId);
                      setIsAddBusinessModalOpen(false);
                      setNewBusinessId(null);
                    }}
                  >
                    {scrapeReviewsMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2 text-gray-800"></i>
                        Scraping...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync-alt mr-2 text-gray-800"></i>
                        Scrape Reviews
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Business</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {businessToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setBusinessToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteBusinessMutation.isPending}
            >
              {deleteBusinessMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Reviews;
