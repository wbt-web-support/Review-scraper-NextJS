import Image from 'next/image';
import { useState } from 'react';
import { Rating } from './ui/Rating'; 
import { IReviewItemFromAPI } from './WidgetPreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const content = review.content || "";
  const canReadMore = content.length > 180; 
  const platformIcon = sourcePlatform === 'google' ? 'fab fa-google' : 'fab fa-facebook-f';
  const platformIconColor = sourcePlatform === 'google' ? 'text-red-500' : 'text-blue-600'; 
  
  // Get author initials for fallback avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 flex flex-col space-y-4 border border-gray-100 h-full group">
        {/* Header Section */}
        <div className="flex items-start space-x-4">
          {displaySettings.showProfilePictures && (
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-3 border-gray-100 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
              {review.profilePicture ? (
                <Image
                  src={review.profilePicture}
                  alt={review.author || 'Reviewer'}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="48px"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(review.author || 'A')}
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-bold text-gray-900 text-lg truncate" title={review.author}>
                {review.author || "Anonymous"}
              </h5>
              <div className={`w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center ${platformIconColor} border border-gray-200`}>
                <i className={`${platformIcon} text-sm`}></i>
              </div>
            </div>
            
            {displaySettings.showRatings && (
              <div className="flex items-center mb-2">
                {typeof review.rating === 'number' ? (
                  <>
                    <Rating value={review.rating} size="sm"/>
                    <span className="ml-2 text-sm font-bold text-amber-600">
                      {review.rating.toFixed(1)}
                    </span>
                  </>
                ) : review.recommendationStatus === 'recommended' ? (
                  <span className="text-sm font-bold text-green-600 flex items-center">
                    <i className="fas fa-thumbs-up mr-2"></i> Recommended
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 italic">No Star Rating</span>
                )}
              </div>
            )}
            
            {displaySettings.showDates && (
              <p className="text-sm text-gray-500 font-medium" title={review.postedAt}>
                {review.postedAt || "Recently"}
              </p>
            )}
          </div>
        </div>

        {/* Review Content */}
        <div className="flex-grow">
          <p className="text-gray-700 leading-relaxed text-base">
            {canReadMore ? `${content.substring(0, 180)}...` : content}
            {canReadMore && (
              <span
                onClick={() => setIsModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-1 hover:underline cursor-pointer transition-colors duration-200"
              >
                Read more
              </span>
            )}
            {(content === "" || !content) && (
              <span className="italic text-gray-400">No content provided.</span>
            )}
          </p>
        </div>
      </div>

      {/* Modal for full review */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start space-x-4 mb-4">
              {displaySettings.showProfilePictures && (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-3 border-gray-100 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
                  {review.profilePicture ? (
                    <Image
                      src={review.profilePicture}
                      alt={review.author || 'Reviewer'}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="48px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                      {getInitials(review.author || 'A')}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <DialogTitle className="font-bold text-gray-900 text-lg truncate" title={review.author}>
                    {review.author || "Anonymous"}
                  </DialogTitle>
                  <div className={`w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center ${platformIconColor} border border-gray-200`}>
                    <i className={`${platformIcon} text-sm`}></i>
                  </div>
                </div>
                
                {displaySettings.showRatings && (
                  <div className="flex items-center mb-2">
                    {typeof review.rating === 'number' ? (
                      <>
                        <Rating value={review.rating} size="sm"/>
                        <span className="ml-2 text-sm font-bold text-amber-600">
                          {review.rating.toFixed(1)}
                        </span>
                      </>
                    ) : review.recommendationStatus === 'recommended' ? (
                      <span className="text-sm font-bold text-green-600 flex items-center">
                        <i className="fas fa-thumbs-up mr-2"></i> Recommended
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No Star Rating</span>
                    )}
                  </div>
                )}
                
                {displaySettings.showDates && (
                  <p className="text-sm text-gray-500 font-medium" title={review.postedAt}>
                    {review.postedAt || "Recently"}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <div className="mt-4">
            <p className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
              {content || "No content provided."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SingleReviewCard;