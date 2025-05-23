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

interface IBusinessUrl {
  _id: string;
  userId: string; 
  name: string;
  url: string;
  urlHash: string;
  source: 'google' | 'facebook';
  addedAt: Date;
  lastScrapedAt?: Date; 
}

interface IReviewItem {
  reviewId?: string; 
  author: string;
  content: string;
  rating?: number; 
  postedAt: string; 
  profilePicture?: string; 
  recommendationStatus?: string; 
  userProfile?: string; 
  scrapedAt?: Date; 
}

const businessUrlSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  url: z.string().url("Must be a valid URL."),
  source: z.enum(["google", "facebook"], { required_error: "Please select a source." })
});

type BusinessUrlFormData = z.infer<typeof businessUrlSchema>;

const fetcher = async <T = unknown,>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: `Request to ${url} failed with status ${res.status}` }));
    throw new Error(errorData.message || `An error occurred while fetching ${url}`);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json() as Promise<T>;
  }
  return undefined as T; 
};

const Reviews = () => {
  const [activeTab, setActiveTab] = useState<"all" | "google" | "facebook">("all");
  const [selectedBusinessUrl, setSelectedBusinessUrl] = useState<string>("");
  const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.push('/login?callbackUrl=/reviews');
    }
  }, [authStatus, router]);

  const { data: businessUrlsData, isLoading: isBusinessUrlsLoading } = useQuery<{ businessUrls: IBusinessUrl[] }>({
    queryKey: ['businessUrls'],
    queryFn: () => apiRequest<{ businessUrls: IBusinessUrl[] }>("GET", '/api/business-urls'),
    enabled: authStatus === 'authenticated'
  });
  const allBusinessUrls = useMemo(() => businessUrlsData?.businessUrls || [], [businessUrlsData]);
  const filteredBusinessUrls = useMemo(() => {
    if (activeTab === "all") return allBusinessUrls;
    return allBusinessUrls.filter((url: IBusinessUrl) => url.source === activeTab);
  }, [allBusinessUrls, activeTab]);

  useEffect(() => {
    if (filteredBusinessUrls.length > 0) {
      if (!selectedBusinessUrl || !filteredBusinessUrls.find(b => b._id === selectedBusinessUrl)) {
        setSelectedBusinessUrl(filteredBusinessUrls[0]._id);
      }
    } else {
      setSelectedBusinessUrl(""); 
    }
  }, [filteredBusinessUrls, selectedBusinessUrl]);

  const { data: reviewsData, isLoading: isReviewsLoading } = useQuery<{ reviews: IReviewItem[] }>({
    queryKey: ['reviews', selectedBusinessUrl],
    queryFn: () => {
      if (!selectedBusinessUrl) return Promise.resolve({ reviews: [] }); 
      return fetcher<{ reviews: IReviewItem[] }>(`/api/business-urls/${selectedBusinessUrl}/reviews`);
    },
    enabled: authStatus === 'authenticated' && !!selectedBusinessUrl,
  });
  const reviews = reviewsData?.reviews || [];

  const form = useForm<BusinessUrlFormData>({
    resolver: zodResolver(businessUrlSchema),
    defaultValues: { name: "", url: "", source: "google" }
  });

  const addBusinessUrlMutation = useMutation<unknown, Error, BusinessUrlFormData>({ 
    mutationFn: (newData: BusinessUrlFormData) => apiRequest("POST", "/api/business-urls", newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessUrls'] });
      setIsAddBusinessModalOpen(false);
      form.reset();
      toast({ title: "Success", description: "Business URL added successfully." });
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

  const onSubmit = (data: BusinessUrlFormData) => {
    addBusinessUrlMutation.mutate(data);
  };

  if (authStatus === 'loading' || authStatus === 'unauthenticated') { 
    return (
      <Layout><div className="flex justify-center items-center h-screen"><p>Loading...</p></div></Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5">
          <h1 className="text-2xl font-heading font-bold text-gray-800 mb-4 sm:mb-0">
            Manage Review Sources
          </h1>
          <Button 
            onClick={() => setIsAddBusinessModalOpen(true)}
            className="bg-primary-500 hover:bg-primary-600"
          >
            <i className="fas fa-plus mr-2"></i>
            Add Business
          </Button>
        </div>

        <div className="bg-white  rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6">
          <Tabs 
            defaultValue="all" 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as "all" | "google" | "facebook")}
          >
              <TabsList className="mb-6">
                <TabsTrigger value="all">All Reviews</TabsTrigger>
                <TabsTrigger value="google">Google</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
              </TabsList>
            </Tabs>

            {isBusinessUrlsLoading ? (
              <div className="animate-pulse flex h-10 bg-gray-200 rounded"></div>
            ) : filteredBusinessUrls.length > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                <div className="w-full sm:w-auto sm:min-w-[250px]">
                <Label htmlFor="business-select" className="mb-1 block">Select Business Source</Label>
                  <Select
                    value={selectedBusinessUrl}
                    onValueChange={setSelectedBusinessUrl}
                  >
                    <SelectTrigger id="business-select">
                      <SelectValue placeholder="Select a source to view reviews" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBusinessUrls.map((url: IBusinessUrl) => (
                        <SelectItem key={url._id} value={url._id}>
                          {url.name} ({url.source.charAt(0).toUpperCase() + url.source.slice(1)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBusinessUrl && (
                  <Button 
                    onClick={() => scrapeReviewsMutation.mutate(selectedBusinessUrl)}
                    disabled={scrapeReviewsMutation.isPending}
                    className="bg-secondary-500 hover:bg-secondary-600 mt-4 sm:mt-0 self-start sm:self-end text-gray-800"
                  >
                    {scrapeReviewsMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2 text-gray-800"></i>
                        Scraping...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync-alt mr-2 text-gray-800"></i>
                        Refresh Reviews
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:text-gray-500 mb-5">
                  <i className="fas fa-store text-xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">No Businesses Found</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {activeTab === "all"
                      ? "You haven't added any business sources yet."
                      : `No ${activeTab} business sources found.`}
                </p>
                <Button 
                  onClick={() => setIsAddBusinessModalOpen(true)}
                  className="bg-primary-500 hover:bg-primary-600 text-gray-800"
                >
                  <i className="fas fa-plus mr-2 text-gray-800"></i>
                  Add First Business
                </Button>
              </div>
            )}

            {selectedBusinessUrl && (
              <ReviewTable 
                reviews={reviews} 
                isLoading={isReviewsLoading}
                emptyState={
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-400  mb-5">
                      <i className="fas fa-star text-xl"></i>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800  mb-2">No Reviews Found</h3>
                    <p className="text-gray-500  mb-6 max-w-md mx-auto">
                      This business does not have any reviews yet. Click the button below to scrape reviews.
                    </p>
                    <Button 
                      onClick={() => scrapeReviewsMutation.mutate(selectedBusinessUrl)}
                      disabled={scrapeReviewsMutation.isPending}
                      className="bg-secondary-500 hover:bg-secondary-600 text-gray-800"
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
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Add Business Modal */}
      <Dialog open={isAddBusinessModalOpen} onOpenChange={setIsAddBusinessModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Business</DialogTitle>
            <DialogDescription>
              Add a business from Google or Facebook to start scraping reviews.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Business Name</FormLabel> <FormControl><Input placeholder="e.g. My Awesome Business" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
            <FormField control={form.control} name="source" render={({ field }) => ( <FormItem> <FormLabel>Review Source</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger></FormControl> <SelectContent><SelectItem value="google">Google</SelectItem><SelectItem value="facebook">Facebook</SelectItem></SelectContent> </Select> <FormMessage /> </FormItem>)} />
            <FormField control={form.control} name="url" render={({ field }) => ( <FormItem> <FormLabel>Business URL</FormLabel> <FormControl><Input placeholder={form.watch("source") === "google" ? "Google Maps URL..." : "Facebook Page Reviews URL..."} {...field} /></FormControl> <FormMessage /> </FormItem>)} />
              
            <DialogFooter className="pt-4">
                <Button type="button" onClick={() => { setIsAddBusinessModalOpen(false); form.reset(); }}>Cancel</Button>
                <Button type="submit" className="bg-primary-500 hover:bg-primary-600" disabled={addBusinessUrlMutation.isPending}>
                  {addBusinessUrlMutation.isPending ? (<><i className="fas fa-spinner fa-spin mr-2"></i>Adding...</>) : "Add Source"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Reviews;
