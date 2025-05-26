import { Rating } from "../components/ui/Rating";
import { formatRating } from "../lib/utils";
import { useMemo } from "react";
import SingleReviewCard from "./SingleReviewCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from "./ui/carousel";

export interface IReviewItemFromAPI {
  _id?: string;
  reviewId?: string; 
  author: string;
  content: string;
  rating?: number;
  postedAt: string;
  profilePicture?: string;
  recommendationStatus?: 'recommended' | 'not_recommended' | string;
}

export interface IWidgetSettingsFromForm {
  name?: string;
  themeColor: string;
  layout: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating: number;
  showRatings: boolean;
  showDates: boolean;
  showProfilePictures: boolean;
  businessUrl?: {
      _id: string;
      name: string;
      url?: string;
      source: 'google' | 'facebook';
  };
}
interface WidgetPreviewProps {
  widget: IWidgetSettingsFromForm; 
  reviews: IReviewItemFromAPI[];
  isLoadingReviews?: boolean;
}

const WidgetPreview = ({ 
  widget, 
  reviews,
  isLoadingReviews = false 
}: WidgetPreviewProps) => {
  const settings = widget;
  const MAX_PREVIEW_ITEMS = 50; // Show more reviews since we removed maxReviews limit

  const filteredReviews = useMemo(() => {
    if (!Array.isArray(reviews)) {
      console.warn("[WidgetPreview] 'reviews' prop is not an array, returning empty for filteredReviews. Received:", reviews);
      return [];
    }
    return reviews
      .filter(review => review.rating === undefined || review.rating === null || review.rating >= settings.minRating)
      .slice(0, MAX_PREVIEW_ITEMS);
  }, [reviews, settings.minRating, MAX_PREVIEW_ITEMS]);

  const avgRating = useMemo(() => {
    const ratedReviews = filteredReviews.filter(r => typeof r.rating === 'number');
    if (ratedReviews.length === 0) return 0;
    return ratedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedReviews.length;
  }, [filteredReviews]);

  const colorStyle = { "--widget-theme-color": settings.themeColor || "#3B82F6" } as React.CSSProperties;
  const source = settings.businessUrl?.source || "google";
  const businessName = settings.businessUrl?.name || "Business Name";
  const sourceIcon = source === 'google' ? 'fab fa-google' : 'fab fa-facebook-f';
  const getReviewKey = (review: IReviewItemFromAPI, index: number): string => review._id || review.reviewId || `review-${index}`;
  const displaySettingsForCard = {
    showRatings: settings.showRatings,
    showDates: settings.showDates,
    showProfilePictures: settings.showProfilePictures,
    themeColor: settings.themeColor,
  };

  const NoFilteredReviews = () => (
    <div style={colorStyle} className="text-center py-10 text-muted-foreground">
        <i className="fas fa-filter text-3xl mb-4"></i>
        <h4 className="font-semibold text-lg text-foreground">No Reviews Match Filters</h4>
        <p className="text-sm">Try adjusting the minimum rating in the settings.</p>
    </div>
  );

if (!isLoadingReviews && filteredReviews.length === 0 && settings.layout !== 'badge') { // Use the prop
    return (
        <div style={colorStyle} className="border border-border rounded-lg p-6 bg-card text-card-foreground text-center min-h-[200px] flex flex-col justify-center items-center">
            <i className="fas fa-star text-3xl text-muted-foreground mb-4"></i>
            <h4 className="font-semibold text-lg text-foreground">No Reviews Match Filters</h4>
            <p className="text-sm text-muted-foreground">
                Try adjusting the minimum rating or this source has no reviews that meet the criteria.
            </p>
        </div>
    );
  }
  return (
    <div 
      className="w-full max-w-full border border-border rounded-lg p-3 sm:p-4 bg-card text-card-foreground transition-theme"
      style={colorStyle}
    >
      {settings.layout === 'grid' && filteredReviews.length > 0 && (
      <>
          {isLoadingReviews && filteredReviews.length === 0 && <p className="text-center text-muted-foreground">Loading reviews...</p>}
          {!isLoadingReviews && filteredReviews.length === 0 && <NoFilteredReviews />}
          {filteredReviews.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredReviews.map((review, index) => (
                <SingleReviewCard key={getReviewKey(review, index)} review={review} displaySettings={displaySettingsForCard} sourcePlatform={source} />
              ))}
            </div>
          )}
      </>
      )
      }
      {settings.layout === 'carousel' && filteredReviews.length > 0 && (
        <Carousel
          opts={{ align: "start", loop: filteredReviews.length > (filteredReviews.length < 3 ? 1 : 2) }} 
          className="w-full max-w-full"
        >
          <CarouselContent className="-ml-2 py-1"> 
            {filteredReviews.map((review, index) => (
              <CarouselItem key={getReviewKey(review, index)} className="pl-2 basis-full md:basis-1/2"> 
                <div className="p-1 h-full">
                  <SingleReviewCard review={review} displaySettings={displaySettingsForCard} sourcePlatform={source} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {filteredReviews.length > 1 && (
            <>
              <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 z-10 
                                          h-8 w-8 rounded-full 
                                          bg-card/80 backdrop-blur-sm text-card-foreground 
                                          shadow-md border-border 
                                          hover:bg-accent disabled:opacity-30 
                                          sm:left-1" 
              />
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 z-10 
                                        h-8 w-8 rounded-full 
                                        bg-card/80 backdrop-blur-sm text-card-foreground 
                                        shadow-md border-border 
                                        hover:bg-accent disabled:opacity-30 
                                        sm:right-1"
              />
            </>
          )}
        </Carousel>
      )}

      {settings.layout === 'list' && filteredReviews.length > 0 && (
        <div className="space-y-3">
          {filteredReviews.map((review, index) => (
            <SingleReviewCard key={getReviewKey(review, index)} review={review} displaySettings={displaySettingsForCard} sourcePlatform={source} />
          ))}
        </div>
      )}
      
     {settings.layout === 'masonry' && filteredReviews.length > 0 && (
        <div className="columns-1 sm:columns-2 gap-3 space-y-3"> 
          {filteredReviews.map((review, index) => (
            <div key={getReviewKey(review, index)} className="break-inside-avoid-column">
              <SingleReviewCard review={review} displaySettings={displaySettingsForCard} sourcePlatform={source} />
            </div>
          ))}
        </div>
      )}
      
        {settings.layout === 'badge' && (
        <div className="flex justify-center items-center py-4">
            <div className="w-full max-w-[280px] sm:max-w-xs mx-auto flex flex-col shadow-lg rounded-lg overflow-hidden border-2 border-[var(--widget-theme-color)]">
              <div className="bg-[var(--widget-theme-color)] text-white px-3 py-2 flex items-center justify-between">
                <div className="flex items-center">
                  <i className={`${sourceIcon} text-lg mr-1.5`}></i>
                  <span className="font-semibold text-xs sm:text-sm">{businessName}</span>
                </div>
                {widget.businessUrl?.url && <a href={widget.businessUrl.url} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white text-xs hover:underline"><i className="fas fa-external-link-alt text-xs"></i></a>}
              </div>
              <div className="bg-card p-3 text-center">
                <div className="flex justify-center items-center mb-1.5">
                  <div className="rounded-full bg-[var(--widget-theme-color)] text-white text-lg w-8 h-8 flex items-center justify-center mr-2 font-bold">
                    {formatRating(avgRating)}
                  </div>
                  <Rating value={avgRating} size="default" color={settings.themeColor} />
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Based on {filteredReviews.length} review{filteredReviews.length !== 1 && 's'}
                </div>
              </div>
            </div>
        </div>
      )}
      {settings.layout !== 'badge' && filteredReviews.length > 0 && (
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-[var(--widget-theme-color)]">ReviewHub</span>
        </div>
      )}
    </div>
  );
};

export default WidgetPreview;