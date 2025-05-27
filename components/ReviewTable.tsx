import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "./ui/table";
import { Rating } from "./ui/Rating";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { formatTimeAgo } from "../lib/utils";
import Image from "next/image";

export interface IReviewItem {
  _id?: string;       
  reviewId?: string;   
  source?: 'google' | 'facebook'; 
  businessUrl?: {       
    source: 'google' | 'facebook';
  };
  author: string;
  rating?: number | null;
  recommendationStatus?: 'recommended' | 'not_recommended' | string; 
  content?: string | null;
  postedAt?: string;   
  scrapedAt?: string | Date; 
  profilePicture?: string; 
  userProfile?: string;
}
interface ReviewTableProps {
  reviews: IReviewItem[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  error?: Error | null;
}

const ReviewTable = ({  reviews, isLoading = false, emptyState, error }: ReviewTableProps) => {
  const [selectedReview, setSelectedReview] = useState<IReviewItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openReviewModal = (review: IReviewItem) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const closeReviewModal = () => {
    setSelectedReview(null);
    setIsModalOpen(false);
  };

  // Function to truncate text and determine if "Read more" is needed
  const getTruncatedContent = (content: string | null | undefined, maxLength: number = 100) => {
    if (!content) return { text: "", needsReadMore: false };
    if (content.length <= maxLength) return { text: content, needsReadMore: false };
    return { text: content.substring(0, maxLength) + "...", needsReadMore: true };
  };

  // Default empty state if none provided
  const defaultEmptyState = (
    <div className="text-center py-10"> {/* Increased padding */}
      <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-slate-100  text-slate-400 mb-4">
        <i className="fas fa-star text-2xl"></i> {/* Increased icon size */}
      </div>
      <h3 className="text-lg font-medium text-slate-800  mb-1">No Reviews Found</h3>
      <p className="text-slate-500 text-sm">
        There are no reviews to display for the current selection.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="bg-white  rounded-xl shadow-sm border border-red-300  overflow-hidden">
        <div className="p-6 text-center text-red-600 ">
          <i className="fas fa-exclamation-triangle fa-2x mb-3"></i>
          <h3 className="text-lg font-medium mb-1">Error Loading Reviews</h3>
          <p className="text-sm">{error.message || "An unexpected error occurred."}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white  rounded-xl shadow-sm border border-slate-200  overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200  rounded"></div> {/* Header placeholder */}
            {[...Array(3)].map((_, i) => ( // Skeleton for 3 rows
              <div key={i} className="h-16 bg-slate-200  rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="bg-white  rounded-xl shadow-sm border border-slate-200  overflow-hidden">
        <div className="p-6">
          {emptyState || defaultEmptyState}
        </div>
      </div>
    );
  }

  const getReviewSource = (review: IReviewItem): 'google' | 'facebook' | 'unknown' => {
    return review.source || review.businessUrl?.source || 'unknown';
  };

  const getDisplayDate = (review: IReviewItem): string => {
    if (review.postedAt) return formatTimeAgo(review.postedAt);
    if (review.scrapedAt) {
      try {
        return formatTimeAgo(
          typeof review.scrapedAt === 'string' ? review.scrapedAt : review.scrapedAt.toISOString()
        );
      } catch (error) {
        console.error("Error parsing date:", error);
        return "Invalid Date";
      }
    }
    return "N/A";
  };

  // Helper to get initials from author name
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const words = name.trim().split(' ').filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <div className="bg-white  rounded-xl shadow-md border border-slate-200  overflow-hidden">
      {/* review-widget-slide-in class removed as its definition is unknown, add if needed */}
      <div className="overflow-x-auto"> {/* Removed hide-scrollbar, manage with global CSS if needed */}
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[130px] px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Source</TableHead>
              <TableHead className="px-4 py-3 text-xs font-medium text-slate-500  uppercase tracking-wider">Reviewer</TableHead>
              <TableHead className="w-[120px] px-4 py-3 text-xs font-medium text-slate-500  uppercase tracking-wider">Rating</TableHead>
              <TableHead className="px-4 py-3 text-xs font-medium text-slate-500  uppercase tracking-wider">Review</TableHead>
              <TableHead className="w-[150px] px-4 py-3 text-xs font-medium text-slate-500  uppercase tracking-wider text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-200 ">
            {reviews.map((review: IReviewItem, index: number) => {
              const source = getReviewSource(review);

              return (
                <TableRow key={review._id || review.reviewId || `review-${index}`} className="hover:bg-slate-50/50  transition-colors">
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center">
                      {source === 'google' ? (
                        <div className="relative w-6 h-6">
                          <Image 
                            src="/google_logo.png" 
                            alt="Google" 
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      ) : source === 'facebook' ? (
                        <div className="relative w-6 h-6">
                          <Image 
                            src="/facebook-logo.png" 
                            alt="Facebook" 
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm bg-slate-100 text-slate-600">
                          <i className="fas fa-store-alt"></i>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        {(() => {
                          const profilePic = review.profilePicture || review.userProfile;
                          const isFacebook = getReviewSource(review) === 'facebook';
                          if (profilePic) {
                            if (isFacebook) {
                              // Use <img> for Facebook
                              return (
                                <Image
                                  src={profilePic}
                                  alt={`${review.author || 'Anonymous'}'s profile`}
                                  className="w-full h-full object-cover rounded-full"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; const fallback = e.currentTarget.nextElementSibling as HTMLElement; if (fallback) fallback.style.display = 'flex'; }}
                                />
                              );
                            } else {
                              // Use <Image> for Google
                              return (
                                <Image
                                  src={profilePic}
                                  alt={`${review.author || 'Anonymous'}'s profile`}
                                  width={32}
                                  height={32}
                                  className="object-cover rounded-full"
                                  onError={(e: any) => { e.target.onerror = null; e.target.style.display = 'none'; const fallback = e.target.nextElementSibling; if (fallback) fallback.style.display = 'flex'; }}
                                />
                              );
                            }
                          }
                          return null;
                        })()}
                        {/* Initials fallback, hidden if image loads */}
                        <span
                          className="absolute inset-0 flex items-center justify-center text-base font-semibold text-slate-500 bg-slate-100"
                          style={{ display: (review.profilePicture || review.userProfile) ? 'none' : 'flex' }}
                        >
                          {getInitials(review.author)}
                        </span>
                      </div>
                      <span className="font-medium">{review.author && review.author !== '' ? review.author : 'Anonymous Reviewer'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {/* Facebook: always show recommendation status if present, else rating, else fallback */}
                    {source === 'facebook' && review.recommendationStatus === 'recommended' ? (
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Recommended</span>
                    ) : source === 'facebook' && review.recommendationStatus === 'not_recommended' ? (
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Not Recommended</span>
                    ) : typeof review.rating === 'number' ? (
                      <Rating value={review.rating} size="xs"/>
                    ) : (
                      <span className="text-slate-400 text-xs italic">No Rating</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {(() => {
                      const { text, needsReadMore } = getTruncatedContent(review.content);
                      return (
                        <div className="text-sm text-slate-700 max-w-sm lg:max-w-md xl:max-w-lg">
                          {review.content ? (
                            <div>
                              <span>{text}</span>
                              {needsReadMore && (
                                <button
                                  onClick={() => openReviewModal(review)}
                                  className="ml-1 text-blue-600 hover:text-blue-800 font-medium cursor-pointer underline"
                                >
                                  Read more
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">No content provided.</span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 text-right">
                    {getDisplayDate(review)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Review Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeReviewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {selectedReview && (() => {
                  const source = getReviewSource(selectedReview);
                  return (
                    <div className="flex items-center gap-2">
                      {source === 'google' ? (
                        <div className="relative w-5 h-5">
                          <Image 
                            src="/google_logo.png" 
                            alt="Google" 
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                      ) : source === 'facebook' ? (
                        <div className="relative w-5 h-5">
                          <Image 
                            src="/facebook-logo.png" 
                            alt="Facebook" 
                            width={20}
                            height={20}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs bg-slate-100 text-slate-600">
                          <i className="fas fa-store-alt"></i>
                        </div>
                      )}
                      <span className="font-medium text-slate-900">
                        {selectedReview.author || "Anonymous"}
                      </span>
                      <span className="text-blue-500">
                        <i className="fas fa-check-circle text-sm"></i>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedReview && (
            <div className="space-y-4">
              {/* Rating */}
              {typeof selectedReview.rating === 'number' ? (
                <div className="flex items-center gap-2">
                  <Rating value={selectedReview.rating} size="sm"/>
                  <span className="text-sm text-slate-600">
                    {getDisplayDate(selectedReview)}
                  </span>
                </div>
              ) : selectedReview.recommendationStatus === 'recommended' ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Recommended
                  </span>
                  <span className="text-sm text-slate-600">
                    {getDisplayDate(selectedReview)}
                  </span>
                </div>
              ) : selectedReview.recommendationStatus === 'not_recommended' ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    Not Recommended
                  </span>
                  <span className="text-sm text-slate-600">
                    {getDisplayDate(selectedReview)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm italic">No Rating</span>
                  <span className="text-sm text-slate-600">
                    {getDisplayDate(selectedReview)}
                  </span>
                </div>
              )}

              {/* Review Content */}
              <div className="text-slate-700 leading-relaxed">
                {selectedReview.content || (
                  <span className="italic text-slate-400">No content provided.</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewTable;
