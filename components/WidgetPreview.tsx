import { Rating } from "../components/ui/Rating";
import { formatRating } from "../lib/utils";
import { useMemo, useState, useEffect } from "react";
import SingleReviewCard from "./SingleReviewCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from "./ui/carousel";
import GoogleReviewsBadge from "./GoogleReviewsBadge";

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

interface ReviewCarouselProps {
  filteredReviews: any[];
  getReviewKey: (review: any, idx: number) => string;
  displaySettingsForCard: any;
  source: any;
}

function ReviewCarousel({ filteredReviews, getReviewKey, displaySettingsForCard, source }: ReviewCarouselProps) {
  const DOT_COUNT = 5;
  function getVisibleCount() {
    if (typeof window !== 'undefined' && window.innerWidth < 600) return 1;
    if (typeof window !== 'undefined' && window.innerWidth < 900) return 3;
    return 5;
  }
  const [visibleCount, setVisibleCount] = useState(getVisibleCount());
  const [current, setCurrent] = useState(0);
  const maxIndex = Math.max(0, filteredReviews.length - visibleCount);

  useEffect(() => {
    function handleResize() {
      setVisibleCount(getVisibleCount());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    setCurrent(prev => prev > maxIndex ? maxIndex : prev);
  }, [maxIndex]);

  function getDotIndexes() {
    let start = current - Math.floor(DOT_COUNT / 2);
    if (start < 0) start = 0;
    if (start > maxIndex - DOT_COUNT + 1) start = Math.max(0, maxIndex - DOT_COUNT + 1);
    return Array.from({ length: Math.min(DOT_COUNT, maxIndex + 1) }, (_, i) => start + i);
  }

  return (
    <div className="relative max-w-[1200px] mx-auto">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500"
          style={{
            transform: `translateX(-${current * (100 / visibleCount)}%)`,
            width: `${(filteredReviews.length * 100) / visibleCount}%`,
          }}
        >
          {filteredReviews.map((review: any, idx: number) => (
            <div
              key={getReviewKey(review, idx)}
              className="min-w-[90vw] sm:min-w-[50vw] md:min-w-[33.33vw] lg:min-w-[20vw] max-w-[320px] flex-shrink-0 px-2"
              style={{ width: `calc(100% / ${visibleCount})` }}
            >
              <div className="p-1 h-full">
                <SingleReviewCard review={review} displaySettings={displaySettingsForCard} sourcePlatform={source} widgetStyleCard />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Navigation Arrows */}
      {current > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm text-gray-700 shadow-md border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
          onClick={() => setCurrent(current - 1)}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15.5 19L9.5 12L15.5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {current < maxIndex && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm text-gray-700 shadow-md border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
          onClick={() => setCurrent(current + 1)}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 5L14.5 12L8.5 19" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {getDotIndexes().map((idx: number) => (
          <button
            key={idx}
            className={`w-2 h-2 rounded-full transition-colors duration-200
              ${idx === current
                ? 'bg-neutral-900 opacity-100'
                : 'bg-gray-500 opacity-60'
              }`}
            onClick={() => setCurrent(idx)}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
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
        <ReviewCarousel
          filteredReviews={filteredReviews}
          getReviewKey={getReviewKey}
          displaySettingsForCard={displaySettingsForCard}
          source={source}
        />
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
          <GoogleReviewsBadge
            businessName={businessName}
            rating={avgRating}
            reviewCount={filteredReviews.length}
            reviews={filteredReviews.map(r => ({
              name: r.author,
              avatar: r.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.author),
              date: r.postedAt,
              rating: r.rating || 0,
              text: r.content,
            }))}
            googleReviewUrl={widget.businessUrl?.url || ''}
          />
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