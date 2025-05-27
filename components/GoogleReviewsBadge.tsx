import Image from 'next/image';
import React, { useState } from 'react';

export interface GoogleReview {
  name: string;
  avatar: string;
  date: string;
  rating: number;
  text: string;
}

interface GoogleReviewsBadgeProps {
  businessName?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: GoogleReview[];
  googleReviewUrl?: string;
}

const defaultReviews: GoogleReview[] = [
  {
    name: 'Mark Beecroft-Stretton',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    date: '1 month ago',
    rating: 5,
    text: 'Jay and his team are marvellous. They walk you through the best solar solution for the individual needs of the customer and deploy...'
  },
  {
    name: 'Shi Victoria',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    date: '1 month ago',
    rating: 5,
    text: 'What a fantastic service. Jay quickly and efficiently installed our new electric charger. He talked me through the app and explaine...'
  }
];

const GoogleReviewsBadge: React.FC<GoogleReviewsBadgeProps> = ({
  businessName = 'Your Business Name',
  rating = 5.0,
  reviewCount = 59,
  reviews = defaultReviews,
  googleReviewUrl = 'https://www.google.com/search?q=Your+Business+Name+Google+Reviews',
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Badge UI */}
      <div
        className="inline-flex flex-col items-center cursor-pointer bg-white rounded-xl shadow-lg px-6 py-4 border border-gray-200 hover:shadow-xl transition"
        onClick={() => setOpen(true)}
        style={{ minWidth: 220 }}
      >
        <Image src="/google_logo.png" alt="Google" width={32} height={32} />
        <div className="flex items-center mt-2">
          <span className="text-2xl font-bold mr-2">{rating.toFixed(1)}</span>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
            ))}
          </div>
        </div>
        <a
          className="mt-1 text-sm text-blue-700 underline hover:text-blue-900"
          href="#"
          onClick={e => { e.preventDefault(); setOpen(true); }}
        >
          Read our {reviewCount} reviews
        </a>
      </div>

      {/* Overlay and Slide-in Panel */}
      {open && (
        <div className="absolute inset-0">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/30 transition-opacity z-10"
            onClick={() => setOpen(false)}
          />
          {/* Slide-in Panel */}
          <div className="absolute left-0 top-0 h-full w-full max-w-md bg-white shadow-2xl p-6 overflow-y-auto z-20 animate-slideInLeft">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-2">What our customers say</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="flex items-center mb-2">
                <Image src="/google_logo.png" alt="Google" width={28} height={28} />
                <span className="ml-2 font-semibold text-lg">Google Reviews</span>
              </div>
              <div className="flex items-center mb-1">
                <span className="text-lg font-bold mr-2">{rating.toFixed(1)}</span>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
                  ))}
                </div>
                <span className="ml-2 text-gray-600 text-sm">({reviewCount})</span>
              </div>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Review us on Google
              </a>
            </div>
            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.map((review, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center mb-2">
                    <Image src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full mr-3 border" />
                    <div>
                      <div className="font-semibold text-gray-900">{review.name}</div>
                      <div className="text-xs text-gray-500">{review.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center mb-1">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" /></svg>
                    ))}
                  </div>
                  <div className="text-gray-800 text-sm mb-2">{review.text}</div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Image src="/google_logo.png" alt="Google" width={16} height={16} className="mr-1" />
                    Posted on Google
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slideInLeft {
          animation: slideInLeft 0.3s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </>
  );
};

export default GoogleReviewsBadge; 