import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { Rating } from "../components/ui/Rating";

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
}
interface ReviewTableProps {
  reviews: IReviewItem[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  error?: Error | null;
}

const ReviewTable = ({  reviews, isLoading = false, emptyState, error }: ReviewTableProps) => {
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
    if (review.postedAt) return review.postedAt;
    if (review.scrapedAt) {
      try {
        return new Date(review.scrapedAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
      } catch (error) {
        console.error("Error parsing date:", error);
        return "Invalid Date";
      }
    }
    return "N/A";
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
              const sourceIcon = source === 'google' ? 'google' : source === 'facebook' ? 'facebook-f' : 'store-alt';
              const sourceColorClasses = source === 'google'
                ? 'bg-red-100 text-red-600'
                : source === 'facebook'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-slate-100  text-slate-600';

              return (
                <TableRow key={review._id || review.reviewId || `review-${index}`} className="hover:bg-slate-50/50  transition-colors">
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-sm ${sourceColorClasses}`}>
                        <i className={`fab fa-${sourceIcon}`}></i>
                      </div>
                      <span className="ml-2.5 text-sm font-medium text-slate-700 capitalize">
                        {source}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{review.author || "Anonymous"}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {typeof review.rating === 'number' ? (
                      <Rating value={review.rating} size="xs"/>
                    ) : review.recommendationStatus === 'recommended' ? (
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Recommended</span>
                    ) : review.recommendationStatus === 'not_recommended' ? (
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Not Recommended</span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">No Rating</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-sm text-slate-700 max-w-sm Lg:max-w-md xl:max-w-lg truncate" title={review.content || undefined}>
                      {review.content || <span className="italic text-slate-400">No content provided.</span>}
                    </div>
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
    </div>
  );
};

export default ReviewTable;
