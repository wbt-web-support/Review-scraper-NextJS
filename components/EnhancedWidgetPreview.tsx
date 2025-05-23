import Image from "next/image";
import { Rating } from "../components/ui/Rating";
import { formatRating } from "../lib/utils";
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "./ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

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
  customizations?: {
    themeColor?: string;
    layout?: string;
    minRating?: number;
    showRatings?: boolean;
    showDates?: boolean;
    showProfilePictures?: boolean;
  };
}

const EnhancedWidgetPreview = ({ 
  widget, 
  reviews,  
}: WidgetPreviewProps) => {
  const settings = widget;

  const filteredReviews = useMemo(() => {
    return reviews.filter(review =>
      review.rating === undefined || review.rating === null || review.rating >= settings.minRating
    );
  }, [reviews, settings.minRating]);

  const avgRating = useMemo(() => {
    const ratedReviews = filteredReviews.filter(r => typeof r.rating === 'number');
    if (ratedReviews.length === 0) return 0;
    return ratedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedReviews.length;
  }, [filteredReviews]);

  const colorStyle = {
    "--widget-theme-color": settings.themeColor || "#3182CE", 
  } as React.CSSProperties;

  const source = settings.businessUrl?.source || "google"; 
  const businessName = settings.businessUrl?.name || "Your Business Name";

  const [carouselTranslateX, setCarouselTranslateX] = useState(0);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const carouselItemRef = useRef<HTMLDivElement>(null);
  const CAROUSEL_ITEMS_TO_SHOW = 1;
  const MAX_CAROUSEL_SLIDES = 10; 
  const CAROUSEL_SLIDE_WIDTH = 330;

  const visibleReviewsForCarousel = useMemo(() => filteredReviews.slice(0, MAX_CAROUSEL_SLIDES), [filteredReviews]);

  const getSlideWidth = () => {
    return 330 + 16;
  };

  const handleCarouselPrev = () => {
    const slideWidth = getSlideWidth();
    setCarouselTranslateX(prev => Math.min(0, prev + slideWidth));
    setCurrentCarouselIndex(prev => Math.max(0, prev - 1));
};


const handleCarouselNext = () => {
    const slideWidth = getSlideWidth();
    const numSlides = visibleReviewsForCarousel.length;
    const maxOffset = -((numSlides - CAROUSEL_ITEMS_TO_SHOW) * slideWidth);
    setCarouselTranslateX(prev => Math.max(maxOffset, prev - slideWidth));
    setCurrentCarouselIndex(prev => Math.min(numSlides - CAROUSEL_ITEMS_TO_SHOW, prev + 1));
};

useEffect(() => { 
    setCarouselTranslateX(0);
    setCurrentCarouselIndex(0);
}, [settings.layout, visibleReviewsForCarousel]);

  const getReviewKey = (review: IReviewItemFromAPI, index: number): string => {
    return review._id || review.reviewId || `review-${index}`;
  };

  return (
    <div 
      className="border border-border rounded-lg p-6 mb-5 bg-card transition-theme"
      style={colorStyle}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center min-w-0">
          <div className="w-12 h-12 rounded-full bg-[var(--widget-theme-color)] flex items-center justify-center text-white flex-shrink-0">
            <i className={`fab fa-${source === 'google' ? 'google' : 'facebook-f'} text-lg`}></i>
          </div>
          <div className="ml-3">
          <h4 className="font-semibold text-card-foreground transition-theme truncate" title={businessName}>{businessName}</h4>
            <div className="flex items-center">
              <Rating value={avgRating} size="lg"/>
              <span className="ml-2 text-sm font-medium text-card-muted-foreground transition-theme">
                {formatRating(avgRating)} out of 5
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          <span className="text-card-muted-foreground mr-2 text-sm transition-theme text-right">
            Based on {filteredReviews.length} review{filteredReviews.length !== 1 && 's'}
          </span>
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`fab fa-${source === 'google' ? 'google' : 'facebook-f'} text-[var(--widget-theme-color)]`}></i>
          </div>
        </div>
      </div>
      {settings.layout === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {filteredReviews.slice(0, 6).map((review: IReviewItemFromAPI, index) => (
            <div key={getReviewKey(review, index)} className="bg-accent/50 shadow-sm rounded-lg p-4 transition-theme border border-border/50">
              <div className="flex items-center mb-3">
                {settings.showProfilePictures && (
                  <div className="w-10 h-10 rounded-full border border-border/50  overflow-hidden bg-muted flex items-center justify-center text-muted-foreground transition-theme">
                    {review.profilePicture ? (
                      <Image src={review.profilePicture} alt={review.author} className="w-full h-full object-cover" width={40} height={40} />
                    ) : (
                      <i className="fas fa-user"></i>
                    )}
                  </div>
                )}
                 <div className={settings.showProfilePictures ? "ml-3" : ""}>
                  <h5 className="font-semibold text-card-foreground text-sm transition-theme">{review.author}</h5>
                  {settings.showDates && (<span className="text-card-muted-foreground text-xs transition-theme">{review.postedAt}</span>)}
                </div>
              </div>
              {settings.showRatings && (
                <div className="flex mb-2">
                  {review.rating ? (
                    <Rating value={review.rating} size="sm" />
                  ) : review.recommendationStatus === 'recommended' ? (
                    <span className="text-success text-xs font-medium transition-theme">
                      <i className="fas fa-thumbs-up mr-1"></i> Recommended
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs transition-theme">No Rating</span>
                  )}
                </div>
              )}
              <p className="text-card-foreground text-sm leading-relaxed transition-theme line-clamp-4">{review.content}</p>
            </div>
          ))}
        </div>
      )}

      {settings.layout === 'carousel' && visibleReviewsForCarousel.length > 0 && (
        <div className="mb-4">
          <div className="relative w-full group">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCarouselPrev}
              className="absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm text-card-foreground shadow-md border-border hover:bg-accent disabled:opacity-30 md:opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Previous review"
              disabled={carouselTranslateX === 0}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="overflow-hidden px-8 mx-8 sm:mx-10">
              <div 
                className="flex transition-transform duration-300 ease-in-out" 
                id="enhancedReviewCarousel"
                style={{ transform: `translateX(${carouselTranslateX}px)` }}
              >
                {visibleReviewsForCarousel.map((review, index) => (
                  <div 
                    ref={index === 0 ? carouselItemRef : null}
                    key={getReviewKey(review, index)} 
                    className="carousel-slide px-2 flex-shrink-0"
                    style={{ width: `${CAROUSEL_SLIDE_WIDTH}px` }}
                  >
                    <div className="bg-white rounded-md p-4 shadow-sm border border-gray-100 flex flex-col h-full">
                      <div className="flex items-start mb-2">
                        <div className="mr-2 text-xl">
                          <span className="inline-block w-6 h-6">
                            {source === 'google' ? (
                              <i className="fab fa-google text-blue-500"></i>
                            ) : (
                              <i className="fab fa-facebook text-blue-600"></i>
                            )}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center">
                            {settings.showProfilePictures && (
                              <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                                {review.profilePicture ? (
                                  <Image src={review.profilePicture} alt={review.author} className="w-full h-full object-cover" width={40} height={40} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                    <i className="fas fa-user text-gray-400"></i>
                                  </div>
                                )}
                              </div>
                            )}
                            <div>
                              <h5 className="font-medium text-gray-800">{review.author}</h5>
                              {settings.showDates && (
                                <div className="text-gray-500 text-xs">{review.postedAt}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {settings.showRatings && (
                        <div className="mb-2">
                          {review.rating ? (
                            <Rating value={review.rating} size="sm" color="#FFC107" />
                          ) : review.recommendationStatus === 'recommended' ? (
                            <span className="text-green-500 text-xs font-medium">
                              <i className="fas fa-thumbs-up mr-1"></i> Recommended
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">No Rating</span>
                          )}
                        </div>
                      )}
                      <p className="text-gray-700 text-sm flex-grow mb-0 line-clamp-5">{review.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={handleCarouselNext}
              className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm text-card-foreground shadow-md border-border hover:bg-accent disabled:opacity-30 md:opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Next review"
              disabled={carouselTranslateX <= -((visibleReviewsForCarousel.length - CAROUSEL_ITEMS_TO_SHOW) * getSlideWidth()) && visibleReviewsForCarousel.length > CAROUSEL_ITEMS_TO_SHOW}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          {visibleReviewsForCarousel.length > CAROUSEL_ITEMS_TO_SHOW && (
            <div className="flex justify-center items-center mt-4 space-x-2">
              {Array.from({ length: Math.ceil(visibleReviewsForCarousel.length / CAROUSEL_ITEMS_TO_SHOW) - (CAROUSEL_ITEMS_TO_SHOW -1) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                      const slideWidth = getSlideWidth();
                      setCarouselTranslateX(-(index * slideWidth * CAROUSEL_ITEMS_TO_SHOW));
                      setCurrentCarouselIndex(index);
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-colors 
                    ${currentCarouselIndex === index ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/50'}`}
                />
              ))}
            </div>
          )}
          <div className="flex justify-center items-center mt-4 space-x-1">
            <button className="w-6 h-6 flex items-center justify-center text-sm text-gray-400 hover:text-gray-600">
              <i className="fa fa-chevron-left"></i>
            </button>
            <button className="w-2 h-2 rounded-full bg-blue-500"></button>
            <button className="w-2 h-2 rounded-full bg-gray-300"></button>
            <button className="w-2 h-2 rounded-full bg-gray-300"></button>
            <button className="w-2 h-2 rounded-full bg-gray-300"></button>
            <button className="w-6 h-6 flex items-center justify-center text-sm text-gray-400 hover:text-gray-600">
              <i className="fa fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
      {settings.layout === 'list' && (
        <div className="space-y-4 mb-4">
          {filteredReviews.slice(0, 6).map((review, index) => (
            <div key={review._id || index} className="bg-accent/50  shadow-sm rounded-lg p-4 border border-border/50 transition-theme">
              <div className="flex items-center mb-3">
                {settings.showProfilePictures && (
                  <div className="w-10 h-10 rounded-full border border-border/50  overflow-hidden bg-muted items-center justify-center text-muted-foreground  transition-theme">
                    {review.profilePicture ? (
                      <Image src={review.profilePicture} alt={review.author} className="w-full h-full object-cover" width={40} height={40} />
                    ) : (
                      <i className="fas fa-user"></i>
                    )}
                  </div>
                )}
                <div className="ml-3">
                  <h5 className="font-semibold text-card-foreground  text-sm transition-theme">{review.author}</h5>
                  {settings.showDates && (
                    <span className="text-card-muted-foreground text-xs transition-theme">{review.postedAt}</span>
                  )}
                </div>
                {settings.showRatings && (
                  <div className="ml-auto flex">
                    {review.rating ? (
                      <Rating value={review.rating} size="sm" />
                    ) : review.recommendationStatus === 'recommended' ? (
                      <span className="text-success  text-xs font-medium transition-theme">
                        <i className="fas fa-thumbs-up mr-1"></i> Recommended
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs transition-theme">No Rating</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-card-foreground text-sm leading-relaxed transition-theme">{review.content}</p>
            </div>
          ))}
        </div>
      )}
      
      {settings.layout === 'masonry' && (
        <div className="mb-4">
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filteredReviews.slice(0, 15).map((review, index) => {
              return (
                <div 
                  key={getReviewKey(review, index)} 
                  className="bg-accent/50 shadow-sm rounded-lg p-4 border border-border/50  transition-theme break-inside-avoid mb-4 relative"
                >
                  <div className="flex items-center space-x-3">
                    {settings.showProfilePictures && (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted flex-shrink-0">
                        {review.profilePicture ? (
                          <Image src={review.profilePicture} alt={review.author} className="w-full h-full object-cover" width={40} height={40} style={{ objectFit: 'cover' }} fill />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <i className="fas fa-user text-xl"></i>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h5 className="font-semibold text-sm truncate text-foreground" title={review.author}>
                        {review.author || "Anonymous"}
                      </h5>
                      {settings.showDates && (
                        <p className="text-xs text-muted-foreground truncate" title={review.postedAt}>
                          {review.postedAt || "Recently"}
                        </p>
                      )}
                    </div>
                  </div>
                  {settings.showRatings && review.rating !== undefined && review.rating !== null && (
                    <div className="flex items-center">
                      <Rating value={review.rating} size="sm" />
                    </div>
                  )}
                  {settings.showRatings && review.recommendationStatus === 'recommended' && (
                    <div className="flex items-center text-xs font-medium text-green-600 dark:text-green-400">
                      <i className="fas fa-thumbs-up mr-1.5"></i> Recommended
                    </div>
                  )}
                  <p className="text-sm text-foreground/90 dark:text-foreground/80 leading-relaxed review-content">
                    {review.content && review.content.length > 150 
                      ? <>{review.content.substring(0, 150)}... <button type="button" className="text-primary text-xs hover:underline">Read more</button></>
                      : review.content || <span className="italic text-muted-foreground">No content provided.</span>
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {settings.layout === 'badge' && (
        <div className="mb-4">
          <div className="w-full max-w-xs mx-auto flex flex-col shadow-lg rounded-lg overflow-hidden border-2 border-[var(--widget-theme-color)]">
            <div className="bg-[var(--widget-theme-color)] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <i className={`fab fa-${source === 'google' ? 'google' : 'facebook-f'} text-xl mr-2`}></i>
                <span className="font-bold text-sm">{source === 'google' ? 'Google' : 'Facebook'} Rating</span>
              </div>
              <a 
                href={widget.businessUrl?.url || "#"} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white/90 hover:text-white hover:underline text-xs font-medium transition-all"
              >
                <i className="fas fa-external-link-alt mr-1"></i> View
              </a>
            </div>
            <div className="bg-white  p-4 text-center">
              <h4 className="font-bold text-card-foreground  text-sm mb-2 transition-theme">{businessName}</h4>
              <div className="flex justify-center items-center mb-2">
                <div className="rounded-full bg-[var(--widget-theme-color)] text-white text-xl w-10 h-10 flex items-center justify-center mr-2 font-bold">
                  {formatRating(avgRating)}
                </div>
                <Rating value={avgRating} size="lg" color={settings.themeColor} />
              </div>
              
              <div className="text-sm font-semibold text-card-foreground transition-theme">
                Based on {filteredReviews.length} {filteredReviews.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
            <div className="bg-[var(--widget-theme-color)]/10  p-2 text-center border-t border-[var(--widget-theme-color)]/30">
              <div className="text-xs text-card-foreground transition-theme">
                <span className="font-bold">Verified</span> by <span className="text-[var(--widget-theme-color)] font-semibold">ReviewHub</span>
              </div>
            </div>
          </div>
          <div className="w-full max-w-xs mx-auto mt-4 bg-white shadow-md rounded-md overflow-hidden border border-[var(--widget-theme-color)]/30 flex items-center transition-all hover:shadow-lg cursor-pointer">
            <div className="bg-[var(--widget-theme-color)] text-white p-3 flex-shrink-0">
              <div className="font-bold text-xl">{formatRating(avgRating)}</div>
              <div className="text-xs font-medium">out of 5</div>
            </div>
            <div className="p-3 flex-1">
              <div className="flex items-center mb-1">
                <Rating value={avgRating} size="sm" />
                <span className="ml-2 text-xs text-card-muted-foreground transition-theme">
                  ({filteredReviews.length})
                </span>
              </div>
              <div className="text-xs text-card-foreground truncate transition-theme font-medium">
                {businessName}
              </div>
            </div>
            <div className="pr-3 flex items-center justify-center">
              <i className={`fab fa-${source === 'google' ? 'google' : 'facebook-f'} text-lg text-[var(--widget-theme-color)]`}></i>
            </div>
          </div>
          <div className="w-full max-w-xs mx-auto mt-4 flex items-center justify-center bg-white shadow-sm rounded-full border border-[var(--widget-theme-color)]/30 py-1.5 px-3">
            <i className={`fab fa-${source === 'google' ? 'google' : 'facebook-f'} text-[var(--widget-theme-color)] mr-2`}></i>
            <Rating value={avgRating} size="sm" />
            <span className="mx-1 text-xs text-card-muted-foreground transition-theme">
              {formatRating(avgRating)}/5
            </span>
            <span className="text-xs text-card-foreground transition-theme font-medium">
              • ReviewHub
            </span>
          </div>
        </div>
      )}
      <div className="mt-6 text-center text-card-muted-foreground text-xs transition-theme">
        Powered by <span className="font-semibold text-[var(--widget-theme-color)]">Review Scraper</span>
      </div>
    </div>
  );
};
export default EnhancedWidgetPreview;