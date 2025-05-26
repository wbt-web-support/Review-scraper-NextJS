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
  };
  return (
    <Dialog open={isOpen} onOpenChange={(openValue: boolean) => { if (!openValue) onClose(); }}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] overflow-y-auto"> 
        <DialogHeader>
          <DialogTitle className="text-lg">Widget Preview: {widget.name}</DialogTitle>
          <DialogDescription className="text-sm">
            See how your widget will look and adjust settings. These changes are for preview only.
          </DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-1 space-y-4"> 
            <h4 className="font-medium text-base text-foreground dark:text-white mb-2 border-b pb-1">
              Customize Preview
            </h4>
            <div>
              <Label className="block text-xs font-medium mb-1">Theme Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {themeColors.map((color) => (
                  <button
                    type="button"
                    key={color.value}
                    title={color.name}
                    onClick={() => setCustomizations(prev => ({ ...prev, themeColor: color.value }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${customizations.themeColor === color.value ? 'ring-2 ring-offset-1 ring-primary border-primary' : 'border-gray-300 hover:border-gray-400'}`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="block text-xs font-medium mb-1">Layout</Label>
              <Select value={customizations.layout} onValueChange={(value) => setCustomizations(prev => ({ ...prev, layout: value as ICustomizationState['layout'] }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select layout" /></SelectTrigger>
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
              <Label className="block text-xs font-medium mb-1">Minimum Rating</Label>
                <Select
                  value={customizations.minRating.toString()}
                  onValueChange={(value: string) => setCustomizations(prev => ({...prev, minRating: parseInt(value)}))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select minimum rating" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="5">5 Stars Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
          <div className="lg:col-span-2 p-4 rounded-lg min-h-[450px] overflow-auto">
            {isLoadingReviews ? (
              <div className="text-center flex items-center justify-center h-full">
                <div>
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">Loading Reviews...</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full">
                <WidgetPreview
                  widget={dataForActualPreview}
                  reviews={reviewsToPreview}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} className="h-8 px-4 text-sm">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetPreviewModal;
