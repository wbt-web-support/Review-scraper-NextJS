(function () {
  if (window.ReviewHubV2 && window.ReviewHubV2.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function () {
      const scripts = document.querySelectorAll('script[src*="widget-new.js"]');
      if (scripts.length > 0) {
        const scriptSrc = scripts[scripts.length - 1].src;
        const url = new URL(scriptSrc);
        return url.origin;
      }
      if (window.REVIEWHUB_API_DOMAIN) {
        return window.REVIEWHUB_API_DOMAIN;
      }
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return window.location.protocol + '//' + window.location.host;
      }
      return 'https://reviews.webuildtrades.com/'; // Default API domain
    })(),
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 3000,
    TIMEOUT: 10000,
    CAROUSEL_SETTINGS: {
      DESKTOP_MIN_REVIEWS_FOR_NAV: 5,
      autoplay: true,
      MOBILE_BREAKPOINT: 480,
      FOLDABLE_BREAKPOINT: 768,
      TABLET_BREAKPOINT: 1024,
      LAPTOP_BREAKPOINT: 1366,
      DESKTOP_BREAKPOINT: 1920,
      WIDE_SCREEN_BREAKPOINT: 2560,
      DEFAULT_VISIBLE_CARDS: {
        wideScreen: 6,    // 2K+ monitors (2560px+)
        desktop: 4,       // Large desktop (1920px+)
        laptop: 4,        // Laptop (1366px+)
        tablet: 3,        // Tablet (1024px - 1365px)
        foldable: 2,      // Foldable devices (900px - 1023px)
        mobile: 1         // Mobile (< 900px)
      }
    }
  };

  window.ReviewHubV2 = {
    isInitialized: true,
    version: '2.0.0',
    buildId: Date.now(),

    log: function (level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHubV2 v${this.version}]`;
        if (data) {
          console[level](prefix, message, data);
        } else {
          console[level](prefix, message);
        }
      }
    },

    escapeHtml: function (text) {
      if (typeof text !== 'string') return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    getInitials: function (name) {
      if (!name) return '?';
      const words = name.trim().split(' ').filter(word => word.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    },

    formatDate: function (dateString) {
      try {
        if (typeof dateString === 'string' && dateString.includes('ago')) {
          return dateString;
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString || 'Recently';

        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        if (diffWeeks === 1) return '1 week ago';
        if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
        if (diffMonths === 1) return '1 month ago';
        if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
        if (diffYears === 1) return '1 year ago';
        return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
      } catch (e) {
        this.log('error', 'Error formatting date', e);
        return dateString || 'Recently';
      }
    },

    generateStars: function (rating) {
      // Uses Font Awesome 5
      // fas fa-star for full, fas fa-star-half-alt for half, far fa-star for empty
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
          starsHtml += '<i class="rh-fas rh-fa-star"></i>'; // Full star
        } else if (rating >= i - 0.7 && rating < i - 0.2) { // Range for half star e.g. 4.3 to 4.7 for 4.5 stars
          starsHtml += '<i class="rh-fas rh-fa-star-half-alt"></i>'; // Half star
        } else if (rating >= i - 0.2) { // consider .8 .9 as full star for rounding
          starsHtml += '<i class="rh-fas rh-fa-star"></i>';
        }
        else {
          starsHtml += '<i class="rh-far rh-fa-star"></i>'; // Empty star
        }
      }
      // Safety check if logic produced more than 5 stars due to rounding/half star complexities
      const starElementsCount = (starsHtml.match(/<i/g) || []).length;
      if (starElementsCount > 5) {
        starsHtml = ''; // Reset
        const roundedRating = Math.round(rating * 2) / 2; // Round to nearest 0.5
        for (let i = 1; i <= 5; i++) {
          if (roundedRating >= i) {
            starsHtml += '<i class="rh-fas rh-fa-star"></i>';
          } else if (roundedRating >= i - 0.5) {
            starsHtml += '<i class="rh-fas rh-fa-star-half-alt"></i>';
          } else {
            starsHtml += '<i class="rh-far rh-fa-star"></i>';
          }
        }
      }
      return starsHtml;
    },

    generateRecommendationStatus: function (review) {
      // For Facebook reviews, show recommendation status instead of stars
      const recommendationStatus = review.recommendationStatus || '';
      if (recommendationStatus === 'recommended') {
        return '<div class="rh-recommendation-status rh-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-recommendation-status rh-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
      }
      return '';
    },

    detectReviewSource: function (review, widgetSettings) {
      // Check review source or widget settings to determine platform
      if (review.source) {
        return review.source.toLowerCase();
      }
      if (widgetSettings && widgetSettings.businessUrl && widgetSettings.businessUrl.source) {
        return widgetSettings.businessUrl.source.toLowerCase();
      }
      if (widgetSettings && widgetSettings.platformName) {
        return widgetSettings.platformName.toLowerCase();
      }
      // Default to google if unable to determine
      return 'google';
    },

    getPlatformLogo: function (source) {
      if (source === 'facebook') {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%231877F2' d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'/%3E%3C/svg%3E`;
      } else {
        // Google logo
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285f4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/%3E%3Cpath fill='%2334a853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/%3E%3Cpath fill='%23fbbc05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/%3E%3Cpath fill='%23ea4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/%3E%3C/svg%3E`;
      }
    },

    getPlatformThemeColor: function (source, userThemeColor) {
      // If user provided a theme color, use it
      if (userThemeColor && userThemeColor !== '#007bff') {
        return userThemeColor;
      }

      // Use platform-specific colors
      if (source === 'facebook') {
        return '#1877F2'; // Facebook blue
      } else {
        return '#4285F4'; // Google blue
      }
    },

    injectStyles: function () {
      if (document.getElementById('reviewhub-v2-widget-styles')) return;

      // Font Awesome for stars and icons
      if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        fontAwesome.integrity = 'sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==';
        fontAwesome.crossOrigin = 'anonymous';
        fontAwesome.referrerPolicy = 'no-referrer';
        document.head.appendChild(fontAwesome);
      }

      // Google Fonts (Inter for modern typography)
      if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect1);
        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect2);
        const interFont = document.createElement('link');
        interFont.rel = 'stylesheet';
        interFont.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        document.head.appendChild(interFont);
      }

      const style = document.createElement('style');
      style.id = 'reviewhub-v2-widget-styles';
      style.textContent = `
        /* Global styles */

        i {
            font-style: normal !important;
        }


        .reviewhub-v2-widget-container h1,
        .reviewhub-v2-widget-container h2,
        .reviewhub-v2-widget-container h3,
        .reviewhub-v2-widget-container h4,
        .reviewhub-v2-widget-container h5,
        .reviewhub-v2-widget-container h6 {
          margin: 0 !important;
          padding: 0 !important;
          font-size: 16px !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-v2-widget-container p {
          margin: 0 !important;
          padding: 0 !important;
          font-size: 16px !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-v2-widget-container button {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: inherit !important;
          font-size: 14px !important;
          line-height: inherit !important;
          color: inherit !important;
          cursor: pointer !important;
          margin-top: 10px !important;
        }
        
        .reviewhub-v2-widget-container a {
          color: inherit !important;
          text-decoration: none !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-v2-widget-container i {
          font-style: normal !important;
        }

        .reviewhub-v2-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-v2-widget-container *::before,
        .reviewhub-v2-widget-container *::after,
        .reviewhub-v2-widget-container * {
          box-sizing: border-box;
        }

        /* Font Awesome class prefixes */
        .rh-fas { font-family: 'Font Awesome 5 Free'; font-weight: 900; }
        .rh-far { font-family: 'Font Awesome 5 Free'; font-weight: 400; }
        .rh-fa-star::before { content: "\\f005"; }
        .rh-fa-star-half-alt::before { content: "\\f5c0"; }
        .rh-fa-check-circle::before { content: "\\f058"; } 
        .rh-fa-chevron-left::before { content: "\\f053"; }
        .rh-fa-chevron-right::before { content: "\\f054"; }
        .rh-fa-thumbs-up::before { content: "\\f164"; }
        .rh-fa-thumbs-down::before { content: "\\f165"; }
        
        /* Loading state */
        .reviewhub-v2-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-v2-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #F3F4F6;
          border-top: 3px solid #3B82F6;
          border-radius: 50%;
          animation: rh-v2-spin 0.8s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes rh-v2-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-v2-error {
          padding: 40px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
        }
        .reviewhub-v2-error-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .reviewhub-v2-error-message {
          font-size: 0.9em;
          margin-bottom: 16px;
          opacity: 0.9;
        }
        .reviewhub-v2-retry-button {
          background-color: #DC2626;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.9em;
          transition: all 0.2s ease;
        }
        .reviewhub-v2-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }
        
        /* Carousel Styles */
        .rh-carousel-wrapper {
          position: relative;
          width: 100%;
          padding: 0;
          margin-bottom: 50px; /* Increased to accommodate dots */
        }
        .rh-carousel-track-container { 
            overflow: hidden;
            width: 100%;
            padding: 20px 0px;
        }
        .rh-carousel-track {
          display: flex;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
          cursor: grab;
        }
        .rh-carousel-track.rh-dragging {
          cursor: grabbing;
          transition: none;
        }
        .rh-carousel-slide {
          flex: 0 0 auto;
          padding: 0 10px;
          display: flex; 
          align-items: stretch; 
        }

        /* Review Card - Modern Design */
        .rh-review-card {
          background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
          padding: 24px;
          display: flex;
          flex-direction: column;
          width: 100%;
          border: 1px solid #F1F5F9;
          height: 100%;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          min-height: 320px; /* Ensure minimum height for content */
        }
    
        .rh-review-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 3px 10px rgba(0, 0, 0, 0.06);
        }
        .rh-review-card:hover::before {
          opacity: 1;
        }

       .rh-google-logo-corner {
            position: absolute;
            bottom: 12px;
            right: 12px;
            width: 30px;
            height: 30px;
            z-index: 2;
        }

        .rh-card-header {
          display: flex;
          align-items: center;
          gap: 14px; 
          margin-bottom: 12px;
          flex-shrink: 0; /* Prevent header from shrinking */
        //   margin-top: 8px;
        }
        
        .rh-card-avatar {
          width: 44px; 
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1em;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 2px solid white;
        }
        .rh-card-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rh-card-author-details {
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex-grow: 1;
            min-width: 0;
        }
        .rh-card-author-line {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
            gap: 8px;
        }
        .rh-card-author-name {
          font-weight: 600;
          font-size: 0.95rem !important; 
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0px;
          margin-right: 6px;
          letter-spacing: normal;
        }
        .rh-verified-badge {
            color: #3B82F6;
            font-size: 0.85rem; 
            line-height: 1; 
        }

        .rh-card-review-meta {
          font-size: 0.8rem; 
          color: #6B7280;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .rh-google-logo {
          width: 14px;
          height: 14px;
          vertical-align: middle;
        }

        .rh-card-rating {
          color:rgb(245, 202, 11);
          font-size: 0.9rem; 
          margin-bottom: 12px; /* Add margin back for proper spacing */
          display: flex;
          gap: 1px;
          flex-shrink: 0; /* Prevent rating from shrinking */
        }

        /* Facebook recommendation status styles */
        .rh-recommendation-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 12px;
          padding: 4px 0;
          flex-shrink: 0; /* Prevent recommendation status from shrinking */
        }

        .rh-recommended {
          color: #16A34A;
        }

        .rh-not-recommended {
          color: #DC2626;
        }

        .rh-recommendation-status i {
          font-size: 0.9rem;
        }

        .rh-card-content-wrapper {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            min-height: 0; /* Allow shrinking */
            overflow: hidden;
        }
        .rh-card-content {
          font-size: 0.9rem; 
          line-height: 1.6;
          color: #374151;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex-grow: 1;
          word-wrap: break-word;
          hyphens: auto;
        }
        .rh-read-more {
          font-size: 0.85rem;
          font-weight: 500;
          color: #3B82F6;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          margin-top: 8px; /* Fixed margin instead of auto */
          transition: color 0.2s ease;
          text-decoration: underline;
          font-weight: bold;
          flex-shrink: 0; /* Prevent button from shrinking */
          align-self: flex-start; /* Align to start instead of stretching */
        }

        .rh-read-more:hover {
    color: #2563EB;
    text-decoration: underline;
    box-shadow: none !important;
}
        
        /* Navigation Arrows - Modern Design */
        .rh-carousel-arrow {
          position: absolute;
          top: 50%; 
          transform: translateY(-50%);
          background:rgba(255, 255, 255, 0.5);
          border: 1px solid #E5E7EB;
          border-radius: 50%;
          width: 40px; 
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          color: #6B7280;
          font-size: 0.8rem;
        }
        .rh-carousel-arrow:hover {
          background-color: #F9FAFB;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          transform: translateY(-50%) scale(1.05);
          border-color: #D1D5DB;
        }
        .rh-carousel-arrow.rh-prev {
          left: 10px;
        }
        .rh-carousel-arrow.rh-next {
          right: 10px;
        }
        .rh-carousel-arrow.rh-disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background-color: #F9FAFB;
        }
        .rh-carousel-arrow.rh-disabled:hover {
          transform: translateY(-50%);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Navigation Dots - Modern Design with Sliding Window */
        .rh-carousel-dots {
            position: absolute;
            bottom: -30px; /* Increased spacing from carousel */
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px; /* Increased gap for better visibility */
            list-style: none;
            padding: 0;
            margin: 0;
            z-index: 5;
            justify-content: center;
            align-items: center;
        }
        .rh-carousel-dots li {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        .rh-carousel-dots li button {
            width: 10px; /* Slightly larger for better visibility */
            height: 10px;
            border-radius: 50%;
            background-color: #CBD5E1 !important; /* Better default color */
            border: none;
            padding: 0;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0.6;
            display: block;
        }
        .rh-carousel-dots li button.rh-active {
            background-color: #424b59 !important;
            transform: scale(1.3); /* Slightly more prominent */
            opacity: 1;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3); /* Add shadow for active state */
        }
        .rh-carousel-dots li button.rh-near-active {
            opacity: 0.8;
            background-color: #94A3B8 !important;
            transform: scale(1.1);
        }
        .rh-carousel-dots li button.rh-far {
            opacity: 0.4;
            background-color: #CBD5E1;
        }
        .rh-carousel-dots li button:hover {
            opacity: 1;
            background-color: #6B7280;
            transform: scale(1.2);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .rh-carousel-dots li button.rh-active:hover {
            background-color: #2563EB;
            transform: scale(1.3);
            box-shadow: 0 3px 10px rgba(59, 130, 246, 0.4);
        }

        /* Modal styles - Modern Design */
        .rh-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }
        .rh-modal-overlay.rh-visible {
          opacity: 1;
          visibility: visible;
        }
        .rh-modal {
          background: white;
          border-radius: 20px;
          padding: 32px;
          max-width: 540px;
          width: 92%;
          max-height: 85vh;
          overflow-y: auto;
          position: relative;
          transform: scale(0.8) translateY(20px);
          transition: transform 0.3s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          border: 1px solid #F1F5F9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .rh-modal-overlay.rh-visible .rh-modal {
          transform: scale(1) translateY(0);
        }
        .rh-modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: #F3F4F6;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6B7280;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          padding: 20px !important;
        }
        .rh-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
          padding: 20px !important;
        }

        .rh-modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #F1F5F9;
        }
        .rh-modal-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4em;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 3px solid white;
        }
         .rh-modal-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .rh-modal-author-details {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .rh-modal-author-line {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
        }
        .rh-modal-author-name {
            font-weight: 600;
            font-size: 1.2rem !important;
            color: #111827;
            margin: 0px;
            margin-right: 8px;
            letter-spacing: normal;
        }
        .rh-modal-verified-badge {
            color: #3B82F6;
            font-size: 1rem;
        }
        .rh-modal-review-meta {
          font-size: 0.9rem;
          color: #6B7280;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 0px;
        }
        .rh-modal-rating {
             color: #f5ca0b; 
             font-size: 1.1rem;
             margin-bottom: 0;
             display: flex;
             gap: 2px;
        }
        .rh-modal-content { 
            font-size: 1rem; 
            line-height: 1.7; 
            color: #374151; 
            word-wrap: break-word; 
        }
        .rh-modal-footer {
             display: none; 
        }

        /* Responsive adjustments */
        @media (max-width: ${CONFIG.CAROUSEL_SETTINGS.LAPTOP_BREAKPOINT}px) {
          .rh-carousel-arrow.rh-prev { left: -15px; }
          .rh-carousel-arrow.rh-next { right: -15px; }
        }

        @media (max-width: ${CONFIG.CAROUSEL_SETTINGS.TABLET_BREAKPOINT}px) {
          .rh-card-content { -webkit-line-clamp: 3; }
          .rh-review-card { 
            padding: 20px;
            min-height: 310px; /* Intermediate height for tablet */
          }
        }

        @media (max-width: ${CONFIG.CAROUSEL_SETTINGS.FOLDABLE_BREAKPOINT}px) {
          .rh-carousel-slide { padding: 0 8px; }
          .rh-review-card { 
            padding: 18px;
            min-height: 300px; /* Intermediate height for foldable */
          }
          .rh-card-content { -webkit-line-clamp: 3; }
        }

        @media (max-width: ${CONFIG.CAROUSEL_SETTINGS.MOBILE_BREAKPOINT}px) {
          .rh-carousel-arrow { 
            display: flex; /* Show arrows on mobile */
            width: 28px; /* Smaller for mobile */
            height: 28px;
            font-size: 0.7rem; /* Smaller icon */
          }
          .rh-carousel-arrow.rh-prev { left: -5px; } /* Closer to edge on mobile */
          .rh-carousel-arrow.rh-next { right: -5px; }
          
          .rh-carousel-slide { padding: 0 8px; }
          .rh-review-card { 
            padding: 18px; 
            min-height: 280px; /* Reduced for mobile */
          }
          .rh-card-avatar { width: 40px; height: 40px; }
          .rh-card-author-name { font-size: 0.9rem; letter-spacing: normal; }
          .rh-card-review-meta { font-size: 0.75rem; }
          .rh-card-content { font-size: 0.85rem; -webkit-line-clamp: 3; }
          .rh-read-more { font-size: 0.8rem; }
          .rh-carousel-dots { bottom: -25px; } /* Adjusted for mobile */
          .rh-carousel-wrapper { margin-bottom: 40px; } /* Reduced margin for mobile */
          
          .rh-modal { padding: 24px; border-radius: 16px; }
          .rh-modal-avatar { width: 48px; height: 48px; }
          .rh-modal-author-name { font-size: 1.1rem !important; }
          .rh-modal-content { font-size: 0.95rem; }
        }

        /* Wide screen optimizations */
        @media (min-width: ${CONFIG.CAROUSEL_SETTINGS.WIDE_SCREEN_BREAKPOINT}px) {
          .rh-review-card { padding: 28px; }
          .rh-card-avatar { width: 48px; height: 48px; }
          .rh-card-author-name { font-size: 1rem !important; letter-spacing: normal; }
          .rh-card-content { font-size: 0.95rem; }
        }
      `;
      document.head.appendChild(style);
    },

    fetchWithRetry: async function (url, options, retries = CONFIG.RETRY_ATTEMPTS) {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          const response = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Request timeout')), CONFIG.TIMEOUT);

            fetch(url, {
              ...options,
              mode: 'cors',
              credentials: 'omit',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options?.headers
              }
            })
              .then(res => {
                clearTimeout(timeoutId);
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
              })
              .then(resolve)
              .catch(err => {
                clearTimeout(timeoutId);
                reject(err);
              });
          });
          return response;
        } catch (error) {
          attempt++;
          if (attempt > retries) {
            this.log('error', `Failed to fetch ${url} after ${retries + 1} attempts`, error);
            throw error;
          }
          this.log('warn', `Retrying request to ${url}. Attempt ${attempt} of ${retries}. Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1))); // Exponential backoff
        }
      }
    },

    showError: function (container, error, config, retryCallback) {
      this.log('error', 'Displaying error in widget', { error: error.message, config });
      const themeColor = config.themeColor || '#007bff';
      container.style.setProperty('--rh-theme-color', themeColor);
      container.style.setProperty('--rh-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--rh-theme-color-light', this.lightenColor(themeColor, 80));


      container.innerHTML = `
        <div class="reviewhub-v2-error">
          <div class="reviewhub-v2-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-v2-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-v2-retry-button">Try Again</button>' : ''}
          <!-- <div style="font-size: 0.7em; color: #aaa; margin-top: 10px;">Error: ${this.escapeHtml(error.message)}</div> -->
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-v2-retry-button');
        if (retryButton) {
          retryButton.addEventListener('click', (e) => {
            e.preventDefault();
            retryCallback();
          });
        }
      }
    },

    darkenColor: function (color, percent) {
      let r, g, b, a;
      if (color.startsWith('#')) {
        const num = parseInt(color.slice(1), 16);
        r = (num >> 16) & 0xFF;
        g = (num >> 8) & 0xFF;
        b = num & 0xFF;
      } else if (color.startsWith('rgb')) { // rgb(r, g, b) or rgba(r, g, b, a)
        const parts = color.match(/[\d.]+/g).map(Number);
        [r, g, b, a] = parts;
      } else { return color; } // Can't parse

      const factor = 1 - (percent / 100);
      r = Math.max(0, Math.min(255, Math.round(r * factor)));
      g = Math.max(0, Math.min(255, Math.round(g * factor)));
      b = Math.max(0, Math.min(255, Math.round(b * factor)));

      if (a !== undefined) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    lightenColor: function (color, percent) {
      let r, g, b, a;
      if (color.startsWith('#')) {
        const num = parseInt(color.slice(1), 16);
        r = (num >> 16) & 0xFF;
        g = (num >> 8) & 0xFF;
        b = num & 0xFF;
      } else if (color.startsWith('rgb')) {
        const parts = color.match(/[\d.]+/g).map(Number);
        [r, g, b, a] = parts;
      } else { return color; }

      const factor = percent / 100;
      r = Math.max(0, Math.min(255, Math.round(r + (255 - r) * factor)));
      g = Math.max(0, Math.min(255, Math.round(g + (255 - g) * factor)));
      b = Math.max(0, Math.min(255, Math.round(b + (255 - b) * factor)));

      if (a !== undefined) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    renderWidget: function (container, data, config) {
      this.log('info', 'Rendering widget V2', { data, config });
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      // Filter out reviews with empty content or text
      const filteredReviews = reviews.filter(r => (r.content && r.content.trim()) || (r.text && r.text.trim()));

      // Detect platform from first review or widget settings
      const platformSource = filteredReviews.length > 0 ? this.detectReviewSource(filteredReviews[0], widgetSettings) : 'google';

      // Get appropriate theme color
      const userThemeColor = config.themeColor || widgetSettings.themeColor;
      const themeColor = this.getPlatformThemeColor(platformSource, userThemeColor);

      // Set default values for autoplay and loop if not provided
      const defaultWidgetSettings = {
        autoplay: true,
        autoplayDelay: 4000,
        loop: true,
        showProfilePictures: true,
        showRatings: true,
        showDates: true,
        ...widgetSettings // Override with actual settings if provided
      };

      container.style.setProperty('--rh-theme-color', themeColor);
      container.style.setProperty('--rh-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--rh-theme-color-light', this.lightenColor(themeColor, 90)); // For very light backgrounds or accents


      if (!filteredReviews || filteredReviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-v2-error"><div class="reviewhub-v2-error-title">No reviews to display.</div><div class="reviewhub-v2-error-message">Check back later or add some reviews!</div></div>';
        return;
      }

      // For now, only carousel is being rebuilt. Add other layouts later.
      if (defaultWidgetSettings.layout === 'carousel' || config.layout === 'carousel' || !defaultWidgetSettings.layout) {
        // Update data object to use default settings and filtered reviews
        const updatedData = { ...data, widgetSettings: defaultWidgetSettings, reviews: filteredReviews };
        this.renderCarouselWidget(container, updatedData, config);
      } else {
        // Fallback or message for other layouts not yet implemented in V2
        container.innerHTML = `<div class="reviewhub-v2-error"><div class="reviewhub-v2-error-title">Layout "${defaultWidgetSettings.layout}" is not yet available in this version.</div></div>`;
        this.log('warn', `Layout ${defaultWidgetSettings.layout} not implemented in V2 yet.`);
      }
    },

    renderCarouselWidget: function (container, data, config) {
      const { reviews, widgetSettings, businessName } = data;
      // Filter out reviews with empty content or text
      const filteredReviews = reviews.filter(r => (r.content && r.content.trim()) || (r.text && r.text.trim()));
      const carouselId = `rh-carousel-${config.widgetId}-${Date.now()}`;

      // Detect platform from first review or widget settings
      const platformSource = filteredReviews.length > 0 ? this.detectReviewSource(filteredReviews[0], widgetSettings) : 'google';
      const platformName = platformSource === 'facebook' ? 'Facebook' : 'Google';

      let reviewItemsHtml = filteredReviews.map((review, index) => {
        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const isVerified = true;

        // Detect individual review source
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        const reviewPlatformLogo = this.getPlatformLogo(reviewSource);
        const reviewPlatformName = reviewSource === 'facebook' ? 'Facebook' : 'Google';

        // Generate rating display based on platform
        let ratingDisplay = '';
        if (widgetSettings.showRatings) {
          if (reviewSource === 'facebook') {
            ratingDisplay = this.generateRecommendationStatus(review);
          } else if (rating > 0) {
            ratingDisplay = `<div class="rh-card-rating">${stars}</div>`;
          }
        }

        return `
          <div class="rh-carousel-slide" data-index="${index}">
            <div class="rh-review-card">
              <img src="${reviewPlatformLogo}" alt="${reviewPlatformName}" class="rh-google-logo-corner">
              <div class="rh-card-header">
                <div class="rh-card-avatar">
                  ${profilePicture && widgetSettings.showProfilePictures ? `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : `<span>${initials}</span>`}
                </div>
                <div class="rh-card-author-details">
                  <div class="rh-card-author-line">
                    <h4 class="rh-card-author-name">${author}</h4>
                    ${isVerified ? '<span class="rh-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                  </div>
                  ${widgetSettings.showDates && date ? `
                    <div class="rh-card-review-meta">
                      ${date}
                    </div>` : ''}
                </div>
              </div>
              ${ratingDisplay}
              <div class="rh-card-content-wrapper">
                  <p class="rh-card-content">${content}</p>
                  ${content.length > 120 ? `<button class="rh-read-more" data-review-index="${index}">Read More</button>` : ''} 
              </div>
            </div>
          </div>
        `;
      }).join('');

      const carouselHtml = `
        <div class="rh-carousel-wrapper" id="${carouselId}-wrapper">
          <div class="rh-carousel-track-container">
            <div class="rh-carousel-track">
              ${reviewItemsHtml}
            </div>
          </div>
          <button class="rh-carousel-arrow rh-prev" aria-label="Previous Review"><i class="rh-fas rh-fa-chevron-left"></i></button>
          <button class="rh-carousel-arrow rh-next" aria-label="Next Review"><i class="rh-fas rh-fa-chevron-right"></i></button>
          <ul class="rh-carousel-dots" id="${carouselId}-dots"></ul>
        </div>
      `;

      container.innerHTML = carouselHtml;
      this.initCarouselLogic(carouselId, container, filteredReviews, config, widgetSettings);
      this.attachModalEventListeners(container, filteredReviews, data, config);
    },

    initCarouselLogic: function (carouselId, containerElem, reviews, globalConfig, widgetSettings) {
      const wrapper = containerElem.querySelector(`#${carouselId}-wrapper`);
      const trackContainer = wrapper.querySelector('.rh-carousel-track-container');
      const track = wrapper.querySelector('.rh-carousel-track');
      const slides = Array.from(track.querySelectorAll('.rh-carousel-slide'));
      const prevBtn = wrapper.querySelector('.rh-carousel-arrow.rh-prev');
      const nextBtn = wrapper.querySelector('.rh-carousel-arrow.rh-next');
      const dotsContainer = wrapper.querySelector(`#${carouselId}-dots`);

      if (!slides.length) return;

      let currentIndex = 0;
      let visibleSlides = 1; // Default to 1, will be calculated
      let slideWidth = 0;
      let isDragging = false,
        isPointerDown = false,
        startPos = 0,
        currentTranslate = 0,
        prevTranslate = 0,
        animationID;
      let totalDots = 0;
      let dragThreshold = 50; // Minimum pixels to drag to change slide
      let dragStartThreshold = 10; // Minimum pixels to move before considering it a drag

      const calculateVisibleSlides = (containerWidth) => {
        const screenWidth = containerWidth;
        let num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.mobile; // Default fallback

        // Determine breakpoint and corresponding visible cards
        if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.WIDE_SCREEN_BREAKPOINT) {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.wideScreen;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.DESKTOP_BREAKPOINT) {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.desktop;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.LAPTOP_BREAKPOINT) {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.laptop;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.TABLET_BREAKPOINT) {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.tablet;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.FOLDABLE_BREAKPOINT) {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.foldable;
        } else {
          num = CONFIG.CAROUSEL_SETTINGS.DEFAULT_VISIBLE_CARDS.mobile;
        }

        // Allow override from widget settings based on current breakpoint
        if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.DESKTOP_BREAKPOINT && widgetSettings.cardsToShowDesktop) {
          num = widgetSettings.cardsToShowDesktop;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.TABLET_BREAKPOINT && screenWidth < CONFIG.CAROUSEL_SETTINGS.LAPTOP_BREAKPOINT && widgetSettings.cardsToShowTablet) {
          num = widgetSettings.cardsToShowTablet;
        } else if (screenWidth >= CONFIG.CAROUSEL_SETTINGS.FOLDABLE_BREAKPOINT && screenWidth < CONFIG.CAROUSEL_SETTINGS.TABLET_BREAKPOINT && widgetSettings.cardsToShowFoldable) {
          num = widgetSettings.cardsToShowFoldable;
        } else if (screenWidth < CONFIG.CAROUSEL_SETTINGS.FOLDABLE_BREAKPOINT && widgetSettings.cardsToShowMobile) {
          num = widgetSettings.cardsToShowMobile;
        }

        // Ensure we don't show more cards than available reviews
        const maxPossible = Math.min(parseInt(num, 10), slides.length);
        return Math.max(1, maxPossible);
      };

      const setSlideDimensions = () => {
        const trackContainerClientWidth = trackContainer.clientWidth;
        visibleSlides = calculateVisibleSlides(trackContainerClientWidth);

        // For single slide movement, each slide takes the full container width divided by visible slides
        slideWidth = trackContainerClientWidth / visibleSlides;

        slides.forEach(slide => {
          slide.style.width = `${slideWidth}px`;
        });

        adjustCardHeights();
        updateCarouselPosition(false); // No animation on resize/init
        setupDots();
        updateArrowStates(); // Update arrows after dimensions are set
      };

      const adjustCardHeights = () => {
        if (!slides.length || !visibleSlides) return;
        let relevantSlides = [];
        // Get the slides that are currently visible
        for (let i = 0; i < visibleSlides; i++) {
          const slideIndex = currentIndex + i;
          if (slideIndex < slides.length && slideIndex >= 0) {
            relevantSlides.push(slides[slideIndex]);
          }
        }

        if (!relevantSlides.length) return;

        // Reset heights for relevant slides only before recalculating
        relevantSlides.forEach(slide => {
          const card = slide.querySelector('.rh-review-card');
          if (card) card.style.minHeight = 'auto';
        });

        let maxHeight = 0;
        relevantSlides.forEach(slide => {
          const card = slide.querySelector('.rh-review-card');
          if (card) maxHeight = Math.max(maxHeight, card.offsetHeight);
        });

        if (maxHeight > 0) {
          relevantSlides.forEach(slide => {
            const card = slide.querySelector('.rh-review-card');
            if (card) card.style.minHeight = `${maxHeight}px`;
          });
        }
      };

      const setupDots = () => {
        if (!dotsContainer) return;

        // Always show exactly 3 dots for navigation
        const totalReviews = slides.length;
        dotsContainer.innerHTML = '';

        if (totalReviews <= 1) {
          dotsContainer.style.display = 'none';
          return;
        }
        dotsContainer.style.display = 'flex';

        // Create exactly 3 dots: previous, current, next
        for (let i = 0; i < 3; i++) {
          const li = document.createElement('li');
          const button = document.createElement('button');
          let label = '';
          if (i === 0) label = 'Previous review';
          else if (i === 1) label = 'Current review';
          else label = 'Next review';

          button.setAttribute('aria-label', label);
          button.setAttribute('data-dot-position', i); // 0=left, 1=center, 2=right
          button.addEventListener('click', handleDotClick);
          li.appendChild(button);
          dotsContainer.appendChild(li);
        }
        updateDots();
      };

      const handleDotClick = (event) => {
        const clickedPosition = parseInt(event.target.getAttribute('data-dot-position'));

        if (clickedPosition === 0) {
          // Clicked left dot - move to previous review
          changeSlide(-1);
        } else if (clickedPosition === 2) {
          // Clicked right dot - move to next review  
          changeSlide(1);
        }
        // Center dot (position 1) does nothing as it's already active

        stopAutoPlay();
        setTimeout(startAutoPlay, (widgetSettings.autoplayDelay || 5000) * 1.5);
      };

      const updateDots = () => {
        if (!dotsContainer) return;

        const dots = Array.from(dotsContainer.children);
        const totalReviews = slides.length;

        if (dots.length !== 3) return;

        dots.forEach((li, position) => {
          const button = li.querySelector('button');
          button.classList.remove('rh-active', 'rh-near-active', 'rh-far');

          if (position === 1) {
            // Center dot is always active
            button.classList.add('rh-active');
          } else {
            // Left and right dots are clickable
            button.classList.add('rh-near-active');
          }

          // With infinite loop, all dots are always enabled
          li.style.opacity = (position === 1) ? '1' : '0.7';
          li.style.pointerEvents = 'auto';
        });
      };

      const updateCarouselPosition = (animate = true) => {
        track.style.transition = animate ? `transform 0.45s cubic-bezier(0.65, 0, 0.35, 1)` : 'none';

        // Ensure currentIndex is within valid bounds, especially for non-looping
        if (!widgetSettings.loop) {
          currentIndex = Math.max(0, Math.min(currentIndex, slides.length - visibleSlides));
        }
        // For looping, currentIndex can exceed bounds temporarily before snapping back.

        const newTranslate = -currentIndex * slideWidth;
        track.style.transform = `translateX(${newTranslate}px)`;
        currentTranslate = newTranslate;

        updateArrowStates();
        updateDots();

        // Adjust heights after transition for accuracy, or before if no animation.
        // Need to make sure adjustCardHeights refers to the correct set of slides after potential index change.
        const callAdjustHeights = () => {
          // We need to calculate heights based on the slides that WILL be visible at the new currentIndex
          let relevantSlidesForHeight = [];
          for (let i = 0; i < visibleSlides; i++) {
            let slideIndexForHeightCalc = (currentIndex + i) % slides.length; // Basic loop for indices
            if (!widgetSettings.loop) {
              slideIndexForHeightCalc = Math.min(slides.length - 1, currentIndex + i);
            }
            if (slides[slideIndexForHeightCalc]) {
              relevantSlidesForHeight.push(slides[slideIndexForHeightCalc]);
            }
          }

          // Reset first
          slides.forEach(s => { const c = s.querySelector('.rh-review-card'); if (c) c.style.minHeight = 'auto'; });

          let maxHeight = 0;
          relevantSlidesForHeight.forEach(s => {
            const card = s.querySelector('.rh-review-card');
            if (card) maxHeight = Math.max(maxHeight, card.offsetHeight);
          });
          if (maxHeight > 0) {
            relevantSlidesForHeight.forEach(s => {
              const card = s.querySelector('.rh-review-card');
              if (card) card.style.minHeight = `${maxHeight}px`;
            });
          }
        };

        if (animate) {
          setTimeout(callAdjustHeights, 450); // Match transition
        } else {
          callAdjustHeights();
        }
      };

      const updateArrowStates = () => {
        if (!prevBtn || !nextBtn) return;
        const totalReviews = reviews.length;

        // Arrows are hidden if there are not enough reviews to scroll
        if (totalReviews <= visibleSlides) {
          prevBtn.style.display = 'none';
          nextBtn.style.display = 'none';
          return;
        } else {
          prevBtn.style.display = 'flex';
          nextBtn.style.display = 'flex';
        }

        // Update arrow states based on current position
        prevBtn.classList.remove('rh-disabled');
        nextBtn.classList.remove('rh-disabled');

        // Disable prev button when on first slide
        if (currentIndex <= 0) {
          prevBtn.classList.add('rh-disabled');
        }

        // Next button is never disabled since we allow wrap from last to first
      };

      const changeSlide = (direction) => {
        // Handle wrapping logic
        let newIndex = currentIndex + direction;
        let shouldSnapInstantly = false;

        // Handle bounds and wrapping
        if (direction > 0) {
          // Moving right/forward
          if (newIndex > slides.length - visibleSlides) {
            newIndex = 0; // Wrap to beginning when going right from last
            shouldSnapInstantly = false;
          }
        } else {
          // Moving left/backward  
          if (newIndex < 0) {
            // Don't wrap when going left from first slide - just stay at 0
            newIndex = 0;
            return; // Exit early, don't animate
          }
        }

        currentIndex = newIndex;

        // Use instant transition for wrapping, smooth transition for normal movement
        if (shouldSnapInstantly) {
          track.style.transition = 'none';
          track.style.transform = `translateX(${-currentIndex * slideWidth}px)`;

          // Force reflow to ensure the instant transition is applied
          track.offsetHeight;

          // Re-enable transitions for future movements
          setTimeout(() => {
            track.style.transition = 'transform 0.45s cubic-bezier(0.65, 0, 0.35, 1)';
          }, 10);
        } else {
          // Normal smooth transition
          track.style.transition = 'transform 0.45s cubic-bezier(0.65, 0, 0.35, 1)';
          track.style.transform = `translateX(${-currentIndex * slideWidth}px)`;
        }

        updateDots();
        updateArrowStates();

        // Adjust heights after slide change
        setTimeout(adjustCardHeights, shouldSnapInstantly ? 50 : 450);
      };

      prevBtn.addEventListener('click', () => {
        changeSlide(-1);
        stopAutoPlay();
        setTimeout(startAutoPlay, (widgetSettings.autoplayDelay || 5000) * 1.5);
      });
      nextBtn.addEventListener('click', () => {
        changeSlide(1);
        stopAutoPlay();
        setTimeout(startAutoPlay, (widgetSettings.autoplayDelay || 5000) * 1.5);
      });

      // Touch/Drag functionality with improved click detection
      const getPositionX = (event) => event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;

      const touchStart = (event) => {
        isPointerDown = true;
        isDragging = false; // Don't set dragging immediately
        startPos = getPositionX(event);
        prevTranslate = -currentIndex * slideWidth;
        track.style.transition = 'none';
        stopAutoPlay();
      };

      const touchMove = (event) => {
        if (!isPointerDown) return;

        const currentPosition = getPositionX(event);
        const deltaX = currentPosition - startPos;

        // Only start dragging if we've moved beyond the threshold
        if (!isDragging && Math.abs(deltaX) > dragStartThreshold) {
          isDragging = true;
          track.classList.add('rh-dragging');
          animationID = requestAnimationFrame(dragAnimation);

          // Prevent default behavior only when we're actually dragging
          if (event.cancelable) {
            event.preventDefault();
          }
        }

        if (isDragging) {
          let newTranslate = prevTranslate + deltaX;

          // Apply boundary constraints with elastic resistance
          const minTranslate = -(slides.length - visibleSlides) * slideWidth;
          const maxTranslate = 0;

          // Add resistance when dragging beyond boundaries
          if (newTranslate > maxTranslate) {
            // Dragging right from first slide - add resistance
            const excess = newTranslate - maxTranslate;
            newTranslate = maxTranslate + (excess * 0.3); // 30% resistance
          } else if (newTranslate < minTranslate) {
            // Dragging left from last slide - add resistance  
            const excess = minTranslate - newTranslate;
            newTranslate = minTranslate - (excess * 0.3); // 30% resistance
          }

          currentTranslate = newTranslate;
        }
      };

      function dragAnimation() {
        if (isDragging) {
          track.style.transform = `translateX(${currentTranslate}px)`;
          requestAnimationFrame(dragAnimation);
        }
      }

      const touchEnd = (event) => {
        if (!isPointerDown) return;

        isPointerDown = false;

        if (isDragging) {
          isDragging = false;
          track.classList.remove('rh-dragging');
          cancelAnimationFrame(animationID);

          const movedBy = currentTranslate - prevTranslate;
          const minTranslate = -(slides.length - visibleSlides) * slideWidth;
          const maxTranslate = 0;

          // Check if we're outside boundaries and need to snap back
          if (currentTranslate > maxTranslate) {
            // Beyond right boundary (first slide) - snap back to first slide
            currentIndex = 0;
            updateCarouselPosition(true);
          } else if (currentTranslate < minTranslate) {
            // Beyond left boundary (last slide) - snap back to last possible position  
            currentIndex = slides.length - visibleSlides;
            updateCarouselPosition(true);
          } else {
            // Within boundaries - check if movement threshold was met for slide change
            let direction = 0;
            if (movedBy < -dragThreshold) direction = 1; // Swiped left
            if (movedBy > dragThreshold) direction = -1; // Swiped right

            if (direction !== 0) {
              changeSlide(direction);
            } else {
              // Not moved enough - snap back to current slide
              updateCarouselPosition(true);
            }
          }

          // Prevent click events from firing after drag
          track.style.pointerEvents = 'none';
          setTimeout(() => {
            track.style.pointerEvents = 'auto';
          }, 100);
        } else {
          // If we didn't drag, restore transition for smooth snapping
          track.style.transition = 'transform 0.45s cubic-bezier(0.65, 0, 0.35, 1)';
        }

        setTimeout(startAutoPlay, (widgetSettings.autoplayDelay || 5000) * 1.5);
      };

      track.addEventListener('mousedown', touchStart);
      track.addEventListener('touchstart', touchStart, { passive: true });

      document.addEventListener('mousemove', touchMove); // Listen on document for wider drag area
      document.addEventListener('touchmove', touchMove, { passive: false }); // Need to be able to preventDefault

      document.addEventListener('mouseup', touchEnd);
      document.addEventListener('touchend', touchEnd);
      document.addEventListener('mouseleave', (e) => {
        // Only end drag if mouse leaves the document entirely
        if (e.target === document.documentElement) {
          touchEnd(e);
        }
      });

      // Prevent context menu on long press for mobile
      track.addEventListener('contextmenu', (e) => {
        if (isDragging) {
          e.preventDefault();
        }
      });

      // Prevent text selection during drag
      track.addEventListener('selectstart', (e) => {
        if (isDragging) {
          e.preventDefault();
        }
      });

      let autoPlayInterval;
      const startAutoPlay = () => {
        // Check if autoplay is enabled
        if (!(widgetSettings.autoplay === true || String(widgetSettings.autoplay) === 'true')) {
          return;
        }
        // Don't autoplay if there's only one review
        if (reviews.length <= 1) {
          return;
        }

        const delay = parseInt(widgetSettings.autoplayDelay, 10) || 5000;
        clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => {
          changeSlide(1); // Always move to next with infinite loop
        }, delay);
      };

      const stopAutoPlay = () => clearInterval(autoPlayInterval);

      wrapper.addEventListener('mouseenter', stopAutoPlay);
      wrapper.addEventListener('mouseleave', startAutoPlay);

      window.addEventListener('resize', () => {
        stopAutoPlay();
        setSlideDimensions();
        // updateCarouselPosition(false) is called within setSlideDimensions
        startAutoPlay();
      });

      // Initial setup call
      setSlideDimensions();
      startAutoPlay();
    },

    attachModalEventListeners: function (container, reviews, allData, config) {
      container.querySelectorAll('.rh-read-more').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const reviewIndex = parseInt(button.getAttribute('data-review-index'));
          if (!isNaN(reviewIndex) && reviews[reviewIndex]) {
            this.showReviewModal(reviews[reviewIndex], allData, config);
          }
        });
      });
    },

    showReviewModal: function (review, allData, config) {
      if (document.querySelector('.rh-modal-overlay')) return;

      const { widgetSettings } = allData;
      const globalConfig = config;

      const author = this.escapeHtml(review.author || 'Anonymous');
      const initials = this.getInitials(review.author);
      const profilePicture = review.profilePicture;
      const date = this.formatDate(review.postedAt);
      const rating = parseFloat(review.rating) || 0;
      const stars = this.generateStars(rating);
      const content = this.escapeHtml(review.content || review.text || '');
      const displayContent = content.replace(/\n/g, '<br>');
      const source = this.detectReviewSource(review, widgetSettings);
      const platformName = source === 'facebook' ? 'Facebook' : 'Google';
      const isVerified = true;

      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'rh-modal-overlay';

      const showAvatarsSetting = widgetSettings.showProfilePictures !== undefined ? widgetSettings.showProfilePictures : globalConfig.showProfilePictures;
      const showDatesSetting = widgetSettings.showDates !== undefined ? widgetSettings.showDates : globalConfig.showDates;
      const showRatingsSetting = widgetSettings.showRatings !== undefined ? widgetSettings.showRatings : globalConfig.showRatings;

      // Generate rating display for modal based on platform
      let modalRatingDisplay = '';
      if (showRatingsSetting) {
        if (source === 'facebook') {
          modalRatingDisplay = this.generateRecommendationStatus(review);
        } else if (rating > 0) {
          modalRatingDisplay = `<div class="rh-modal-rating">${stars}</div>`;
        }
      }

      const modalHTML = `
            <div class="rh-modal">
                <button class="rh-modal-close" aria-label="Close modal">&times;</button>
                <div class="rh-modal-header">
                    <div class="rh-modal-avatar">
                        ${profilePicture && showAvatarsSetting ? `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : `<span>${initials}</span>`}
                    </div>
                    <div class="rh-modal-author-details">
                        <div class="rh-modal-author-line">
                            <h3 class="rh-modal-author-name">${author}</h3>
                            ${isVerified ? '<span class="rh-modal-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                        </div>
                         ${showDatesSetting && date ? `
                           <p class="rh-modal-review-meta">
                             ${date}
                           </p>` : ''}
                         ${modalRatingDisplay}
                    </div>
                </div>
                <div class="rh-modal-content">
                    ${displayContent}
                </div>
            </div>
        `;
      modalOverlay.innerHTML = modalHTML;
      document.body.appendChild(modalOverlay);
      document.body.style.overflow = 'hidden'; // Prevent background scroll

      // Trigger transition
      setTimeout(() => modalOverlay.classList.add('rh-visible'), 10);

      const closeModal = () => {
        modalOverlay.classList.remove('rh-visible');
        setTimeout(() => {
          document.body.removeChild(modalOverlay);
          document.body.style.overflow = '';
        }, 300); // Match transition duration
        document.removeEventListener('keydown', handleEscape);
      };

      modalOverlay.querySelector('.rh-modal-close').addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) { // Click on overlay itself
          closeModal();
        }
      });

      const handleEscape = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      document.addEventListener('keydown', handleEscape);
    },

    initWidget: async function (userConfig) {
      let container;
      // Merge userConfig with defaults if necessary, or create a final config object
      const config = {
        widgetId: null,
        containerId: null,
        themeColor: '#007bff',
        layout: 'carousel', // Default to carousel for V2 for now
        ...userConfig
      };

      this.log('info', 'Initializing widget V2', config);

      // Prevent duplicate initializations - create a unique identifier for this widget instance
      const widgetInstanceId = config.containerId ?
        `${config.widgetId}-${config.containerId}` :
        `${config.widgetId}-script-${config._scriptTag ? Array.from(document.scripts).indexOf(config._scriptTag) : Date.now()}`;

      // Check if this widget instance has already been initialized
      this._initializedWidgets = this._initializedWidgets || new Set();
      if (this._initializedWidgets.has(widgetInstanceId)) {
        this.log('warn', `Widget instance ${widgetInstanceId} already initialized, skipping.`);
        return;
      }
      this._initializedWidgets.add(widgetInstanceId);

      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element #${config.containerId} not found.`);
          // Remove from initialized set since we failed
          this._initializedWidgets.delete(widgetInstanceId);
          return; // Don't create fallback containers when containerId is explicitly specified
        }
      } else if (config._scriptTag) { // If initialized from script tag without explicit container
        container = document.createElement('div');
        config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
        this.log('info', `No containerId, created one after script tag: ${config._scriptTag.src}`);
      } else {
        this.log('error', 'No containerId provided and cannot infer container. Widget will not render.');
        // Remove from initialized set since we failed
        this._initializedWidgets.delete(widgetInstanceId);
        return; // Cannot proceed without a container
      }

      // Add a data attribute to mark this container as initialized
      container.setAttribute('data-reviewhub-widget-id', config.widgetId);
      container.setAttribute('data-reviewhub-instance-id', widgetInstanceId);

      container.className = 'reviewhub-v2-widget-container'; // Base class for all widgets
      container.innerHTML = `
        <div class="reviewhub-v2-loading">
          <div class="reviewhub-v2-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;
      // Set theme color variables on the container early for spinner
      container.style.setProperty('--rh-theme-color', config.themeColor);
      container.style.setProperty('--rh-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--rh-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
        this.showError(container, new Error('Widget ID is missing.'), config, null);
        return;
      }

      const params = new URLSearchParams();
      // Pass only necessary params for data fetching, not all UI config.
      // API might not need themeColor or layout for fetching raw data.
      // if (config.layout) params.append('layout', config.layout); // If API filters by layout

      // Add limit parameter to fetch at least 500 reviews by default
      params.append('limit', '1000');

      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;
      this.log('info', `Fetching data from: ${apiUrl}`);

      const retryLoad = () => {
        this.log('info', 'Retrying widget load V2', { widgetId: config.widgetId });
        // Clear container and re-init. Be careful of infinite loops if API always fails.
        container.innerHTML = ''; // Clear previous error/loading
        // Remove from initialized set to allow retry
        this._initializedWidgets.delete(widgetInstanceId);
        this.initWidget(config);
      };

      try {
        const data = await this.fetchWithRetry(apiUrl);
        if (data && data.reviews) {
          this.log('info', 'Widget data loaded successfully V2', { widgetId: config.widgetId, reviewCount: data.reviews.length });
          // Ensure widgetSettings exists, even if empty, to avoid errors
          data.widgetSettings = data.widgetSettings || {};
          // Merge script tag data-attributes into widgetSettings if they exist and are not already set by API
          // This allows overriding API settings via script tag attributes.
          if (config.cardsToShowDesktop) data.widgetSettings.cardsToShowDesktop = parseInt(config.cardsToShowDesktop, 10);
          if (config.cardsToShowTablet) data.widgetSettings.cardsToShowTablet = parseInt(config.cardsToShowTablet, 10);
          if (config.cardsToShowFoldable) data.widgetSettings.cardsToShowFoldable = parseInt(config.cardsToShowFoldable, 10);
          if (config.cardsToShowMobile) data.widgetSettings.cardsToShowMobile = parseInt(config.cardsToShowMobile, 10);
          if (config.autoplay !== undefined) data.widgetSettings.autoplay = config.autoplay === 'true' || config.autoplay === true;
          if (config.autoplayDelay) data.widgetSettings.autoplayDelay = parseInt(config.autoplayDelay, 10);
          if (config.loop !== undefined) data.widgetSettings.loop = config.loop === 'true' || config.loop === true;
          if (config.showRatings !== undefined) data.widgetSettings.showRatings = config.showRatings === 'true' || config.showRatings === true;
          if (config.showDates !== undefined) data.widgetSettings.showDates = config.showDates === 'true' || config.showDates === true;
          if (config.showProfilePictures !== undefined) data.widgetSettings.showProfilePictures = config.showProfilePictures === 'true' || config.showProfilePictures === true;


          this.renderWidget(container, data, config);
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        this.log('error', 'Failed to load widget data V2', { widgetId: config.widgetId, error: error.message });
        this.showError(container, error, config, retryLoad);
      }
    },

    // Public init method
    init: function (userConfig) {
      // Handle string shorthand for widgetId
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;

      // Add some basic validation
      if (!config || !config.widgetId) {
        this.log('error', 'Invalid config provided to init method', config);
        return;
      }

      // If script is still loading, defer initialization
      if (document.readyState === 'loading') {
        window.ReviewHubV2._pendingInitializations = window.ReviewHubV2._pendingInitializations || [];
        window.ReviewHubV2._pendingInitializations.push(config);
      } else {
        this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    // Prevent multiple executions
    if (window.ReviewHubV2._autoInitialized) {
      window.ReviewHubV2.log('info', 'Auto-initialization already completed, skipping.');
      return;
    }
    window.ReviewHubV2._autoInitialized = true;

    const scriptTags = document.querySelectorAll('script[data-reviewhub-widget-id]:not([data-reviewhub-processed])');
    window.ReviewHubV2.log('info', `Found ${scriptTags.length} V2 widget script tag(s) for auto-initialization.`);
    scriptTags.forEach(script => {
      // Mark script as processed to prevent duplicate processing
      script.setAttribute('data-reviewhub-processed', 'true');

      const config = {
        widgetId: script.getAttribute('data-reviewhub-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || undefined,
        cardsToShowDesktop: script.getAttribute('data-cards-desktop') || undefined,
        cardsToShowFoldable: script.getAttribute('data-cards-foldable') || undefined,
        cardsToShowMobile: script.getAttribute('data-cards-mobile') || undefined,
        autoplay: script.getAttribute('data-autoplay') || undefined,
        autoplayDelay: script.getAttribute('data-autoplay-delay') || undefined,
        loop: script.getAttribute('data-loop') || undefined,
        showRatings: script.getAttribute('data-show-ratings') || undefined,
        showDates: script.getAttribute('data-show-dates') || undefined,
        showProfilePictures: script.getAttribute('data-show-avatars') || undefined,
        _scriptTag: script
      };
      // Filter out undefined values from config
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);

      // Only add _scriptTag if there's no containerId specified
      if (config.containerId) {
        delete config._scriptTag;
        window.ReviewHubV2.log('info', `Using specified container: ${config.containerId} for widget: ${config.widgetId}`);
      } else {
        window.ReviewHubV2.log('info', `No container specified, will create container after script tag for widget: ${config.widgetId}`);
      }

      window.ReviewHubV2.initWidget(config);
    });
  }

  // Handle pending initializations if DOM was already ready
  function processPendingInitializations() {
    if (window.ReviewHubV2._pendingInitializations && window.ReviewHubV2._pendingInitializations.length > 0) {
      window.ReviewHubV2.log('info', `Processing ${window.ReviewHubV2._pendingInitializations.length} pending widget initializations.`);
      window.ReviewHubV2._pendingInitializations.forEach(config => window.ReviewHubV2.initWidget(config));
      window.ReviewHubV2._pendingInitializations = []; // Clear after processing
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeWidgetsFromScripts();
      processPendingInitializations();
    });
  } else {
    // DOMContentLoaded has already fired
    setTimeout(() => { // Use setTimeout to ensure ReviewHubV2 object is fully parsed
      initializeWidgetsFromScripts();
      processPendingInitializations();
    }, 0);
  }

})();

