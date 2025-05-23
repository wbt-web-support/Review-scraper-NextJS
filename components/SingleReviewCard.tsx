import Image from 'next/image';
import { useState } from 'react';
import { Rating } from './ui/Rating'; 
import { IReviewItemFromAPI } from './WidgetPreview';

interface SingleReviewCardProps {
  review: IReviewItemFromAPI;
  displaySettings: {
    showRatings: boolean;
    showDates: boolean;
    showProfilePictures: boolean;
    themeColor: string; 
  };
  sourcePlatform: 'google' | 'facebook'; 
}
const SingleReviewCard = ({ review, displaySettings, sourcePlatform }: SingleReviewCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = review.content || "";
  const canReadMore = content.length > 120; 
  const platformIcon = sourcePlatform === 'google' ? 'fab fa-google' : 'fab fa-facebook-f';
  const platformIconColor = sourcePlatform === 'google' ? 'text-red-500' : 'text-blue-600'; 
  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-lg p-4 sm:p-5 flex flex-col space-y-3 border border-border hover:shadow-xl transition-shadow duration-300 h-full">
      <div className="flex items-start space-x-3">
        {displaySettings.showProfilePictures && (
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border bg-muted flex-shrink-0">
            {review.profilePicture ? (
              <Image
                src={review.profilePicture}
                alt={review.author || 'Reviewer'}
                fill
                style={{ objectFit: 'cover' }}
                sizes="40px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <i className="fas fa-user text-xl"></i>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h5 className="font-semibold text-sm text-foreground truncate" title={review.author}>
            {review.author || "Anonymous"}
          </h5>
          {displaySettings.showDates && (
            <p className="text-xs text-muted-foreground truncate" title={review.postedAt}>
              {review.postedAt || "Recently"}
            </p>
          )}
        </div>
        <div className={`text-lg ${platformIconColor}`}>
          <i className={platformIcon}></i>
        </div>
      </div>
      {displaySettings.showRatings && (
        <div className="flex items-center">
          {typeof review.rating === 'number' ? (
            <>
              <Rating value={review.rating} size="sm"/>
              <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                {review.rating.toFixed(1)}
              </span>
            </>
          ) : review.recommendationStatus === 'recommended' ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
              <i className="fas fa-thumbs-up mr-1.5"></i> Recommended
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">No Star Rating</span>
          )}
        </div>
      )}
      <p className="text-sm text-foreground/80 dark:text-foreground/70 leading-relaxed flex-grow">
        {isExpanded ? content : `${content.substring(0, 120)}${canReadMore ? "..." : ""}`}
        {canReadMore && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary text-xs hover:underline ml-1 font-medium"
          >
            {isExpanded ? "Read Less" : "Read More"}
          </button>
        )}
        {(content === "" || !content) && <span className="italic text-muted-foreground">No content provided.</span>}
      </p>
    </div>
  );
};
export default SingleReviewCard;