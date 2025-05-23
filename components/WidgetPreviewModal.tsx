import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import WidgetPreview, {
  IWidgetSettingsFromForm as WidgetPreviewInputProps, 
  IReviewItemFromAPI as ReviewItemForPreviewModal
} from "./WidgetPreview";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export interface IWidgetForPreviewModal  {
  _id: string;
  name: string;
  businessUrlId: string;
  businessUrl?: WidgetPreviewInputProps['businessUrl'];
  themeColor: string;
  layout: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  maxReviews?: number;
}

interface WidgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: IWidgetForPreviewModal;
}

interface ICustomizationState {
  themeColor: string;
  layout: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  maxReviews?: number;
  ratingDisplay?: "stars" | "number" | "stars_number";
}

const WidgetPreviewModal = ({ isOpen, onClose, widget }: WidgetPreviewModalProps) => {
  const [customizations, setCustomizations] = useState<ICustomizationState>(() => ({
    themeColor: widget.themeColor,
    layout: widget.layout,
    minRating: widget.minRating,
    ratingDisplay: "stars",
    maxReviews: widget.maxReviews || 10,
    showRatings: widget.showRatings,
    showDates: widget.showDates,
    showProfilePictures: widget.showProfilePictures,
  }));

  useEffect(() => {
    if (isOpen) {
      setCustomizations({
        themeColor: widget.themeColor,
        layout: widget.layout,
        minRating: widget.minRating,
        ratingDisplay: "stars", 
        maxReviews: widget.maxReviews || 10,
        showRatings: widget.showRatings,
        showDates: widget.showDates,
        showProfilePictures: widget.showProfilePictures,
      });
    }
  }, [isOpen, widget]);

 const { data: reviewsData, isLoading: isLoadingReviews } = useQuery<{ reviews: ReviewItemForPreviewModal[] }>({
    queryKey: ['widgetPreviewReviews', widget.businessUrlId],
    queryFn: async () => {
      if (!widget.businessUrlId) { 
        console.log("[PreviewQuery] No businessUrlId, returning empty reviews.");
        return { reviews: [] };
      }
      console.log(`[PreviewQuery] Fetching reviews for ID: ${widget.businessUrlId}`);
      return apiRequest<{ reviews: ReviewItemForPreviewModal[] }>(
        "GET",
        `/api/business-urls/${widget.businessUrlId}/reviews?limit=${customizations.maxReviews || 10}` 
      );
    },
    enabled: isOpen && !!widget.businessUrlId,
  });
  const reviewsToPreview = reviewsData?.reviews || [];

  const themeColors = [
    { name: "Blue", value: "#3182CE" },
    { name: "Green", value: "#38A169" },
    { name: "Red", value: "#E53E3E" },
    { name: "Purple", value: "#805AD5" },
    { name: "Pink", value: "#D53F8C" },
    { name: "Gray", value: "#4A5568" },
  ];
  const dataForActualPreview: WidgetPreviewInputProps = {
    name: widget.name,
    businessUrl: widget.businessUrl, 
    themeColor: customizations.themeColor,
    layout: customizations.layout,
    minRating: customizations.minRating,
    showRatings: customizations.showRatings,
    showDates: customizations.showDates,
    showProfilePictures: customizations.showProfilePictures,
    maxReviews: customizations.maxReviews,
  };
  return (
    <Dialog open={isOpen} onOpenChange={(openValue: boolean) => { if (!openValue) onClose(); }}>
      <DialogContent className="max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl"> 
        <DialogHeader>
          <DialogTitle>Widget Preview: {widget.name}</DialogTitle>
          <DialogDescription>
            See how your widget will look and adjust settings. These changes are for preview only.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 mt-4">
          <div className="md:col-span-1 space-y-6 p-1"> 
            <h4 className="font-semibold text-lg text-foreground dark:text-white mb-3 border-b pb-2">
              Customize Preview
            </h4>
            <div>
              <Label className="block text-sm font-medium mb-1.5">Theme Color</Label>
              <div className="flex flex-wrap gap-2">
                {themeColors.map((color) => (
                  <button
                    type="button"
                    key={color.value}
                    title={color.name}
                    onClick={() => setCustomizations(prev => ({ ...prev, themeColor: color.value }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${customizations.themeColor === color.value ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-primary border-primary' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium mb-1.5">Layout</Label>
              <Select value={customizations.layout} onValueChange={(value) => setCustomizations(prev => ({ ...prev, layout: value as ICustomizationState['layout'] }))}>
                <SelectTrigger><SelectValue placeholder="Select layout" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="masonry">Masonry</SelectItem>
                  <SelectItem value="badge">Badge</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label className="block text-sm font-medium mb-1.5">Minimum Rating</Label>
                <Select
                  value={customizations.minRating.toString()}
                  onValueChange={(value: string) => setCustomizations(prev => ({...prev, minRating: parseInt(value)}))}
                >
                  <SelectTrigger><SelectValue placeholder="Select minimum rating" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="5">5 Stars Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
          <div className="md:col-span-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg min-h-[400px] flex items-center justify-center">
            {isLoadingReviews ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                <p className="mt-3 text-slate-600 dark:text-slate-400">Loading Reviews for Preview...</p>
              </div>
            ) : (
              <WidgetPreview
                widget={dataForActualPreview}
                reviews={reviewsToPreview}
              />
            )}
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetPreviewModal;
