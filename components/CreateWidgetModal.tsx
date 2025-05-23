import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import WidgetPreview, {
  IWidgetSettingsFromForm as WidgetPreviewInputProps,
  IReviewItemFromAPI as ReviewItemForPreviewModal
} from "./WidgetPreview";
// import { Label } from "../components/ui/label";
import { IWidget } from "./WidgetCard";

interface IBusinessUrlForSelect {
  _id: string;
  name: string;
  url?: string;
  source: "google" | "facebook";
}
// interface IReviewItem {
//   _id?: string;
//   reviewId?: string;
//   author: string;
//   content: string;
//   rating?: number;
//   postedAt: string;
//   profilePicture?: string;
// }
interface CreateWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessUrls: IBusinessUrlForSelect[];
  isLoadingBusinessUrls?: boolean;
  onWidgetCreated: (newlyCreatedWidget: IWidget) => void; 
}

export interface IWidgetPreviewData {
  name: string;
  themeColor: string;
  layout: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  businessUrl?: IBusinessUrlForSelect;
  maxReviews?: number;
}

const createWidgetFormSchema = z.object({
  name: z.string().trim().min(2, "Widget name must be at least 2 characters long."),
  businessUrlId: z.string().min(1, "Please select a business source."),
  themeColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color."),
  layout: z.enum(["grid", "carousel", "list", "masonry", "badge"]),
  minRating: z.number().min(0).max(5, "Rating must be between 0 and 5."),
  maxReviews: z.number().min(1, "Please enter a number between 1 and 100.").max(100, "Max reviews cannot exceed 100."),
  showRatings: z.boolean(),
  showDates: z.boolean(),
  showProfilePictures: z.boolean(),
});

export type FormValues = z.infer<typeof createWidgetFormSchema>;

const CreateWidgetModal = ({
  isOpen,
  onClose,
  businessUrls,
  isLoadingBusinessUrls,
  onWidgetCreated,
}: CreateWidgetModalProps) => {
  console.log("CreateWidgetModal - Received businessUrls:", businessUrls); 
  console.log("CreateWidgetModal - isLoadingBusinessUrls:", isLoadingBusinessUrls);
  const [activeTab, setActiveTab] = useState<"settings" | "preview">("settings");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(createWidgetFormSchema),
  });

useEffect(() => {
    if (isOpen) {
        const defaultBusinessUrlId = businessUrls && businessUrls.length > 0 ? businessUrls[0]._id : ""; 
        form.reset({
            name: "",
            businessUrlId: defaultBusinessUrlId,
            themeColor: "#3182CE",
            layout: "grid",
            minRating: 0,
            maxReviews: 10,
            showRatings: true,
            showDates: true,
            showProfilePictures: true,
        });
        setActiveTab("settings");
    }
}, [isOpen, businessUrls, form]);

  const selectedBusinessUrlId = form.watch("businessUrlId");
  const currentMaxReviewsForForm = form.watch("maxReviews");
  const {
    data: previewReviewsQueryResult,
    isLoading: isPreviewReviewsLoading,
    error: previewReviewsError,
    refetch: triggerFetchReviewsForPreview,
  } = useQuery<{ reviews: ReviewItemForPreviewModal[] }>({
    queryKey: ["previewReviews", selectedBusinessUrlId, currentMaxReviewsForForm],
    queryFn: async () => {
      if (!selectedBusinessUrlId) return { reviews: [] };
      return apiRequest<{ reviews: ReviewItemForPreviewModal[] }>(
        "GET",
        `/api/business-urls/${selectedBusinessUrlId}/reviews?limit=${currentMaxReviewsForForm || 10}`
      );
    },
    enabled: false, 
  });

  const reviewsToPreview = previewReviewsQueryResult?.reviews || [];

  useEffect(() => {
    if (isOpen && selectedBusinessUrlId && activeTab === "preview") {
      triggerFetchReviewsForPreview();
    }
  }, [isOpen, selectedBusinessUrlId, activeTab, triggerFetchReviewsForPreview]);

   const { mutate: createWidgetMutate, isPending: isCreatingWidget } = useMutation<
    IWidget,
    Error,
    FormValues
  >({
     mutationFn: (widgetData: FormValues) => {
      const payload = {
        ...widgetData,
        showRatings: widgetData.showRatings ?? true,
        showDates: widgetData.showDates ?? true,
        showProfilePictures: widgetData.showProfilePictures ?? true,
        maxReviews: widgetData.maxReviews ?? 10,
      };
      return apiRequest<IWidget>("POST", "/api/widgets", payload);
    },
   onSuccess: (createdWidget) => {
      toast({
        title: "Widget Created!",
        description: `Widget "${createdWidget.name}" has been successfully created.`,
      });
      queryClient.invalidateQueries({ queryKey: ["widgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });

      onWidgetCreated(createdWidget); 
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create widget.",
        variant: "destructive",
      });
    },
  });

const processFormSubmit = (data: FormValues) => {
  console.log("SUBMITTING WIDGET FORM", data);
  if (!data.businessUrlId) {
    toast({ title: "Missing Information", description: "Please select a business source.", variant: "default"});
    setActiveTab("settings");
    form.setFocus("businessUrlId");
    return;
  }
  createWidgetMutate(data);
};

  const handleBusinessUrlSelectChange = (value: string) => {
    form.setValue("businessUrlId", value, { shouldValidate: true, shouldDirty: true });
  };

  const currentFormValuesForPreview = form.watch();
  const selectedBusinessUrlObjectForPreview = businessUrls.find(
    (b) => b._id === currentFormValuesForPreview.businessUrlId
  );

  const previewWidgetPropsForChild: WidgetPreviewInputProps = {
    name: currentFormValuesForPreview.name || "Sample Widget Preview",
    themeColor: currentFormValuesForPreview.themeColor,
    layout: currentFormValuesForPreview.layout,
    minRating: currentFormValuesForPreview.minRating,
    showRatings: currentFormValuesForPreview.showRatings ?? true,
    showDates: currentFormValuesForPreview.showDates ?? true,
    showProfilePictures: currentFormValuesForPreview.showProfilePictures ?? true,
    businessUrl: selectedBusinessUrlObjectForPreview,
    maxReviews: currentFormValuesForPreview.maxReviews,
  };

  const themeColors = [
    { name: "Blue", value: "#3182CE" },
    { name: "Green", value: "#38A169" },
    { name: "Red", value: "#E53E3E" },
    { name: "Purple", value: "#805AD5" },
    { name: "Pink", value: "#D53F8C" },
    { name: "Gray", value: "#4A5568" },
  ];
    const handleNextPreview = () => {
    form.trigger().then(isValid => { // Validate all fields
        if (isValid) {
            if (!form.getValues("businessUrlId")) { // Specific check after validation
                toast({ title: "Select Business", description: "Please select a business source for the preview.", variant: "default" });
                form.setFocus("businessUrlId");
                return;
            }
            setActiveTab("preview");
            // triggerFetchReviewsForPreview(); // This is now handled by useEffect watching activeTab
        } else {
            toast({ title: "Form Invalid", description: "Please correct errors in settings before previewing.", variant: "destructive"});
        }
    });
  };

  return (
 <Dialog open={isOpen} onOpenChange={(openValue) => { if (!openValue) onClose(); }}>
      <DialogContent className="max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Create New Review Widget</DialogTitle>
          <DialogDescription>Customize and preview your widget before saving.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "settings" | "preview")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Live Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="py-6 space-y-6 outline-none ring-0 focus:ring-0" tabIndex={-1}>
            <Form {...form}>
              <form id="createWidgetForm" onSubmit={form.handleSubmit(processFormSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Widget Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter widget name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="businessUrlId" render={({ field }) => ( <FormItem><FormLabel>Business Source</FormLabel><Select onValueChange={handleBusinessUrlSelectChange} value={field.value || ""} defaultValue={field.value || ""}><FormControl><SelectTrigger disabled={isLoadingBusinessUrls}><SelectValue placeholder={isLoadingBusinessUrls ? "Loading..." : "Select a business source"} /></SelectTrigger></FormControl><SelectContent>{isLoadingBusinessUrls && <SelectItem value="loadingplaceholder" disabled>Loading...</SelectItem>}{!isLoadingBusinessUrls && businessUrls.length === 0 && <div className="p-2 text-sm text-center text-muted-foreground">No sources found. Add one on the Reviews page.</div>}{!isLoadingBusinessUrls && businessUrls.map((business) => (<SelectItem key={business._id} value={business._id}>{business.name} ({business.source?.charAt(0).toUpperCase() + business.source?.slice(1)})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="themeColor" render={({ field }) => ( <FormItem><FormLabel>Theme Color</FormLabel><div className="flex items-center space-x-2 pt-1">{themeColors.map((color) => (<button type="button" key={color.value} title={color.name} onClick={() => form.setValue('themeColor', color.value, { shouldValidate: true, shouldDirty: true })} className={`w-7 h-7 rounded-full border-2 hover:opacity-80 transition-opacity ${field.value === color.value ? 'ring-2 ring-offset-background ring-primary border-primary' : 'border-transparent dark:border-slate-700'}`} style={{ backgroundColor: color.value }} />))}<FormControl><Input type="text" {...field} className="w-32 ml-2" /></FormControl></div><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="layout" render={({ field }) => ( <FormItem><FormLabel>Layout</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select layout" /></SelectTrigger></FormControl><SelectContent><SelectItem value="grid">Grid</SelectItem><SelectItem value="carousel">Carousel</SelectItem><SelectItem value="list">List</SelectItem><SelectItem value="masonry">Masonry</SelectItem><SelectItem value="badge">Badge</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="minRating" render={({ field }) => ( <FormItem><FormLabel>Minimum Rating to Display</FormLabel><Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder="Select minimum rating" /></SelectTrigger></FormControl><SelectContent><SelectItem value="0">All Ratings</SelectItem><SelectItem value="3">3+ Stars</SelectItem><SelectItem value="4">4+ Stars</SelectItem><SelectItem value="5">5 Stars Only</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="maxReviews" render={({ field }) => ( <FormItem><FormLabel>Max Reviews (in widget display)</FormLabel><FormControl><Input type="number" min="1" max="50" placeholder="e.g., 10" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-6 pt-2">
                    <FormField control={form.control} name="showRatings" render={({ }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Controller name="showRatings" control={form.control} render={({ field: checkboxField }) => (<Checkbox checked={checkboxField.value ?? true} onCheckedChange={checkboxField.onChange} id="showRatingsModal" />)} /></FormControl><FormLabel htmlFor="showRatingsModal" className="font-normal text-sm !mt-0 cursor-pointer">Show Star Ratings</FormLabel></FormItem> )} />
                    <FormField control={form.control} name="showDates" render={({  }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Controller name="showDates" control={form.control} render={({ field: checkboxField }) => (<Checkbox checked={checkboxField.value ?? true} onCheckedChange={checkboxField.onChange} id="showDatesModal" />)}/></FormControl><FormLabel htmlFor="showDatesModal" className="font-normal text-sm !mt-0 cursor-pointer">Show Review Dates</FormLabel></FormItem> )} />
                    <FormField control={form.control} name="showProfilePictures" render={({  }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Controller name="showProfilePictures" control={form.control} render={({ field: checkboxField }) => (<Checkbox checked={checkboxField.value ?? true} onCheckedChange={checkboxField.onChange} id="showProfilePicturesModal" />)}/></FormControl><FormLabel htmlFor="showProfilePicturesModal" className="font-normal text-sm !mt-0 cursor-pointer">Show Profile Pictures</FormLabel></FormItem> )} />
                </div>
                 <button type="submit" className="hidden">Submit Settings</button>
              </form>
            </Form>
            <DialogFooter className="pt-6 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => { form.reset(); onClose(); }}>Cancel</Button>
              <Button type="button" variant="default" onClick={handleNextPreview}>
                Next: Preview <i className="fas fa-arrow-right ml-2 text-xs"></i>
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="preview" className="py-6">
            <div className="min-h-[300px] max-h-[60vh] sm:min-h-[400px] md:min-h-[450px] p-4 border border-dashed border-border rounded-lg bg-slate-100 dark:bg-slate-800/50 overflow-auto flex flex-col items-center justify-start">
              {" "}
              {!selectedBusinessUrlId ? (
                <div className="text-center py-10 flex flex-col items-center justify-center h-full text-muted-foreground">
                  <i className="fas fa-search text-3xl mb-4"></i>
                  <p>Select a business source in settings to see a preview.</p>
                </div>
              ) : isPreviewReviewsLoading ? (
                <div className="text-center py-10 flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  <p className="mt-3">Loading Reviews for Preview...</p>
                </div>
              ) : previewReviewsError ? (
                <div className="text-center py-10 text-destructive">
                  Error loading preview: {(previewReviewsError as Error).message}. Please try again.
                </div>
              ) : (
                <WidgetPreview
                widget={previewWidgetPropsForChild}
                reviews={reviewsToPreview}
                isLoadingReviews={isPreviewReviewsLoading}
                />
              )}
            </div>
            <Form {...form}>
              <form id="createWidgetFormPreview" onSubmit={form.handleSubmit(processFormSubmit)}>
                <DialogFooter className="pt-6 sm:justify-between">
                  <Button type="button" variant="outline" onClick={() => { form.reset(); onClose(); }}>Cancel</Button>
                  <Button
                    type="submit"
                    disabled={isCreatingWidget || !form.formState.isDirty || !form.formState.isValid }
                  >
                    {isCreatingWidget ? (<><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</>) : "Create Widget"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
export default CreateWidgetModal;