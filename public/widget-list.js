(function() {
  if (window.ReviewHubList && window.ReviewHubList.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget-list.js"]');
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
    LIST_SETTINGS: {
      INITIAL_REVIEW_COUNT: 10,  // Show 10 reviews initially for list layout
      LOAD_MORE_INCREMENT: 8     // Load 8 more reviews when "Load More" is clicked
    }
  };

  window.ReviewHubList = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    // State tracking for each widget instance
    widgetStates: new Map(),
    
    // Cache for fetched reviews to avoid re-fetching
    reviewCache: new Map(),

    log: function(level, message, data) {
      // Console logging disabled for production
    },

    escapeHtml: function(text) {
      if (typeof text !== 'string') return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    getInitials: function(name) {
      if (!name) return '?';
      const words = name.trim().split(' ').filter(word => word.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    },

    formatDate: function(dateString) {
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
        return dateString || 'Recently';
      }
    },
    
    generateStars: function(rating) {
      // Uses Font Awesome 5 (same as widget-new.js)
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
          starsHtml += '<i class="rh-fas rh-fa-star"></i>'; // Full star
        } else if (rating >= i - 0.7 && rating < i - 0.2) {
          starsHtml += '<i class="rh-fas rh-fa-star-half-alt"></i>'; // Half star
        } else if (rating >= i - 0.2) {
          starsHtml += '<i class="rh-fas rh-fa-star"></i>';
        } else {
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

    generateRecommendationStatus: function(review) {
      // For Facebook reviews, show recommendation status instead of stars
      const recommendationStatus = review.recommendationStatus || '';
      if (recommendationStatus === 'recommended') {
        return '<div class="rh-list-recommendation-status rh-list-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-list-recommendation-status rh-list-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
      }
      return '';
    },

    detectReviewSource: function(review, widgetSettings) {
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

    getPlatformLogo: function(source) {
      if (source === 'facebook') {
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%231877F2' d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'/%3E%3C/svg%3E`;
      } else {
        // Google logo
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285f4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/%3E%3Cpath fill='%2334a853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/%3E%3Cpath fill='%23fbbc05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/%3E%3Cpath fill='%23ea4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/%3E%3C/svg%3E`;
      }
    },

    getPlatformThemeColor: function(source, userThemeColor) {
      // If user provided a theme color, use it
      if (userThemeColor && userThemeColor !== '#3B82F6') {
        return userThemeColor;
      }
      
      // Use platform-specific colors
      if (source === 'facebook') {
        return '#1877F2'; // Facebook blue
      } else {
        return '#4285F4'; // Google blue
      }
    },

    injectStyles: function() {
      if (document.getElementById('reviewhub-list-widget-styles')) return;

      // Font Awesome for stars and icons (same as widget-new.js)
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
      style.id = 'reviewhub-list-widget-styles';
      style.textContent = `
        /* Global styles */
        i {
            font-style: normal !important;
        }
        .reviewhub-list-widget-container h1,
        .reviewhub-list-widget-container h2,
        .reviewhub-list-widget-container h3,
        .reviewhub-list-widget-container h4,
        .reviewhub-list-widget-container h5,
        .reviewhub-list-widget-container h6 {
          margin: 0 !important;
          padding: 0 !important;
          font-weight: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-list-widget-container p {
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
                 .reviewhub-list-widget-container button:not(.rh-list-load-more-btn):not(.rh-list-show-less-btn):not(.reviewhub-list-retry-button):not(.reviewhub-list-modal-close) {
           background: none !important;
           border: none !important;
           padding: 0 !important;
           margin: 0 !important;
           font-family: inherit !important;
           font-size: inherit !important;
           line-height: inherit !important;
           color: inherit !important;
           cursor: pointer !important;
         }
        
        .reviewhub-list-widget-container a {
          color: inherit !important;
          text-decoration: none !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-list-widget-container i {
          font-style: normal !important;
        }

        .reviewhub-list-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-list-widget-container *::before,
        .reviewhub-list-widget-container *::after,
        .reviewhub-list-widget-container * {
          box-sizing: border-box;
        }

        /* Font Awesome class prefixes */
        .rh-fas { font-family: 'Font Awesome 5 Free'; font-weight: 900; }
        .rh-far { font-family: 'Font Awesome 5 Free'; font-weight: 400; }
        .rh-fa-star::before { content: "\\f005"; }
        .rh-fa-star-half-alt::before { content: "\\f5c0"; }
        .rh-fa-check-circle::before { content: "\\f058"; }
        .rh-fa-thumbs-up::before { content: "\\f164"; }
        .rh-fa-thumbs-down::before { content: "\\f165"; }

        /* Loading state */
        .reviewhub-list-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-list-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #F3F4F6;
          border-top: 3px solid var(--list-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-list-spin 0.8s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes rh-list-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-list-error {
          padding: 40px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
        }
        .reviewhub-list-error-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .reviewhub-list-error-message {
          font-size: 0.9em;
          margin-bottom: 16px;
          opacity: 0.9;
        }
        .reviewhub-list-retry-button {
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
        .reviewhub-list-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }

        /* List Layout */
        .reviewhub-list-widget {
          padding: 20px;
          background: transparent;
        }

        .reviewhub-list-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        /* Review Item Styles */
        .rh-list-review-item {
          background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
          padding: 20px;
          border: 1px solid #F1F5F9;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .rh-list-review-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .rh-list-item-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
        }

        .rh-list-item-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1em;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 2px solid white;
        }
        .rh-list-item-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rh-list-item-content {
          flex: 1;
          min-width: 0;
        }

        .rh-list-item-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          gap: 8px;
        }

        .rh-list-item-author-name {
          font-weight: 600;
          font-size: 1.05rem !important;
          color: #111827;
          margin: 0;
          letter-spacing: normal;
        } 

        .rh-list-verified-badge {
          color: #3B82F6;
          font-size: 0.9rem;
        }

        .rh-list-item-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .rh-list-item-rating {
          color: rgb(245, 202, 11);
          font-size: 0.95rem;
          display: flex;
          gap: 2px;
          align-items: center;
        }

        /* Facebook recommendation status styles */
        .rh-list-recommendation-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 8px;
          padding: 4px 0;
        }

        .rh-list-recommended {
          color: #16A34A;
        }

        .rh-list-not-recommended {
          color: #DC2626;
        }

        .rh-list-recommendation-status i {
          font-size: 1rem;
        }

        .rh-list-star {
          font-size: 0.95rem;
        }

        .rh-list-star-full {
          color: #F59E0B;
        }

        .rh-list-star-half {
          color: #F59E0B;
          opacity: 0.6;
        }

        .rh-list-star-empty {
          color: #E5E7EB;
        }

        .rh-list-item-date {
          font-size: 0.85rem;
          color: #6B7280;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rh-list-item-text {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #374151;
          margin-bottom: 12px;
        }

        .rh-list-read-more {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--list-theme-color, #3B82F6);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          transition: color 0.2s ease;
          text-decoration: underline;
          font-weight: bold;
        }

        .rh-list-read-more:hover {
          color: var(--list-theme-color-dark, #2563EB);
          text-decoration: underline;
          font-weight: bold;
        }

        .rh-list-source-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rh-list-source-logo {
          width: 24px;
          height: 24px;
        }

        /* Divider between items */
        .rh-list-review-item:not(:last-child)::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 40px);
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #E5E7EB 50%, transparent 100%);
        }

        /* Modal styles - similar to other widgets */
        .reviewhub-list-modal-overlay {
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
          padding: 20px;
        }
        .reviewhub-list-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .reviewhub-list-modal {
          background: white;
          border-radius: 20px;
          padding: 32px;
          max-width: 540px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          position: relative;
          transform: scale(0.8) translateY(20px);
          transition: transform 0.3s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          border: 1px solid #F1F5F9;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .reviewhub-list-modal-overlay.visible .reviewhub-list-modal {
          transform: scale(1) translateY(0);
        }

        .reviewhub-list-modal-close {
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

        .reviewhub-list-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
          padding: 20px !important;
        }

        .reviewhub-list-modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #F1F5F9;
        }

        .reviewhub-list-modal-avatar {
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
        .reviewhub-list-modal-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reviewhub-list-modal-author-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .reviewhub-list-modal-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }

        .reviewhub-list-modal-author-name {
          font-weight: 600;
          font-size: 1.2rem !important;
          color: #111827;
          margin: 0;
          margin-right: 8px;
          letter-spacing: normal;
        }

        .reviewhub-list-modal-verified-badge {
          color: #3B82F6;
          font-size: 1rem;
        }

        .reviewhub-list-modal-review-meta {
          font-size: 0.9rem;
          color: #6B7280;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 0;
        }

        .reviewhub-list-modal-rating {
          color: rgb(245, 202, 11);
          font-size: 1.1rem;
          margin-bottom: 0;
          display: flex;
          gap: 2px;
        }

        .reviewhub-list-modal-content {
          font-size: 1rem;
          line-height: 1.7;
          color: #374151;
          word-wrap: break-word;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .reviewhub-list-container {
            gap: 20px;
          }
          
          .rh-list-review-item {
            padding: 16px;
          }
          
          .rh-list-item-header {
            gap: 12px;
          }
          
          .rh-list-item-avatar {
            width: 44px;
            height: 44px;
            font-size: 1rem;
          }
          
          .rh-list-item-author-name {
            font-size: 1rem; letter-spacing: normal;
          }
          
          .rh-list-item-text {
            font-size: 0.9rem;
          }
          
          .reviewhub-list-modal {
            padding: 24px;
            border-radius: 16px;
          }
          
          .reviewhub-list-modal-avatar {
            width: 48px;
            height: 48px;
          }
          
          .reviewhub-list-modal-author-name {
            font-size: 1.1rem; letter-spacing: normal;
          }
          
          .reviewhub-list-modal-content {
            font-size: 0.95rem;
          }
        }

        @media (min-width: 641px) and (max-width: 768px) {
          .reviewhub-list-container {
            max-width: 700px;
          }
        }

        @media (min-width: 769px) {
          .reviewhub-list-container {
            max-width: 800px;
          }
          
          .rh-list-review-item {
            padding: 24px;
          }
          
          .rh-list-item-avatar {
            width: 52px;
            height: 52px;
          }
          
          .rh-list-item-author-name {
            font-size: 1.1rem; letter-spacing: normal;
          }
          
          .rh-list-item-text {
            font-size: 1rem;
          }
        }

        /* Load More Button Styles - Matching Grid Widget */
        .rh-list-load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 32px;
          gap: 20px;
          flex-wrap: wrap;
        }
.rh-list-reviews-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
                 .rh-list-load-more-btn,
         .rh-list-show-less-btn {
           background: white !important;
           color: balck !important;
           border: solid 1px rgb(205, 213, 226) !important;
           padding: 8px 20px !important;
           border-radius: 50px !important;
           font-size: 1rem !important;
           font-weight: 500 !important;
           cursor: pointer !important;
           transition: all 0.3s ease !important;
           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
           margin: 0 8px !important;
           min-width: 120px !important;
         }

                 .rh-list-load-more-btn:hover,
         .rh-list-show-less-btn:hover {
          
           transform: translateY(-2px) !important;
           box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25) !important;
         }

         .rh-list-show-less-btn {
           background: white !important;
           color: #6B7280 !important;
           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
         }

         .rh-list-show-less-btn:hover {
           background: #6B7280 !important;
           color: white !important;
           box-shadow: 0 4px 12px rgba(107, 114, 128, 0.25) !important;
         }

        @media (max-width: 640px) {
          .rh-list-load-more-container {
            margin-top: 24px;
            padding-top: 16px;
          }
          
                     .rh-list-load-more-btn,
           .rh-list-show-less-btn {
             padding: 12px 24px !important;
             font-size: 0.9rem !important;
             min-width: 100px !important;
           }

          .rh-list-load-more-container {
              display: flex;
              justify-content: center;
              margin-top: 32px;
              gap: 20px;
              flex-wrap: wrap;
              gap: 0px;
              margin-top: 10px !important;
          }
        }
      `;
      document.head.appendChild(style);
    },

    fetchWithRetry: async function(url, options, retries = CONFIG.RETRY_ATTEMPTS) {
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
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt -1)));
        }
      }
    },

    showError: function(container, error, config, retryCallback) {
      const themeColor = config.themeColor || '#3B82F6';
      container.style.setProperty('--list-theme-color', themeColor);
      container.style.setProperty('--list-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--list-theme-color-light', this.lightenColor(themeColor, 80));

      container.innerHTML = `
        <div class="reviewhub-list-error">
          <div class="reviewhub-list-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-list-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-list-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-list-retry-button');
        if (retryButton) {
          retryButton.addEventListener('click', (e) => {
            e.preventDefault();
            retryCallback();
          });
        }
      }
    },
    
    darkenColor: function(color, percent) {
        let r, g, b, a;
        if (color.startsWith('#')) {
            const num = parseInt(color.slice(1), 16);
            r = (num >> 16) & 0xFF;
            g = (num >>  8) & 0xFF;
            b =  num       & 0xFF;
        } else if (color.startsWith('rgb')) {
            const parts = color.match(/[\d.]+/g).map(Number);
            [r, g, b, a] = parts;
        } else { return color; }

        const factor = 1 - (percent / 100);
        r = Math.max(0, Math.min(255, Math.round(r * factor)));
        g = Math.max(0, Math.min(255, Math.round(g * factor)));
        b = Math.max(0, Math.min(255, Math.round(b * factor)));

        if (a !== undefined) {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    lightenColor: function(color, percent) {
        let r, g, b, a;
        if (color.startsWith('#')) {
            const num = parseInt(color.slice(1), 16);
            r = (num >> 16) & 0xFF;
            g = (num >>  8) & 0xFF;
            b =  num       & 0xFF;
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

    // Pagination functions
    fetchReviewsWithPagination: async function(config, offset, limit) {
      const cacheKey = `${config.widgetId}-${offset}-${limit}`;
      
      // Check cache first
      if (this.reviewCache.has(cacheKey)) {
        console.log(`📊 Reviews fetched from cache: ${limit} reviews for widget ${config.widgetId} (offset: ${offset})`);
        return this.reviewCache.get(cacheKey);
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        layout: 'list'
      });
      
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}?${params.toString()}`;
      
      try {
        const data = await this.fetchWithRetry(apiUrl);
        if (data && data.reviews) {
          // Cache the result
          this.reviewCache.set(cacheKey, data);
          console.log(`📊 Reviews fetched from database: ${data.reviews.length} reviews for widget ${config.widgetId} (layout: list, offset: ${offset})`);
          return data;
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        console.error(`Error fetching reviews with pagination:`, error);
        throw error;
      }
    },

    filterReviews: function(reviews, widgetSettings) {
      // Filter out reviews with empty content or text
      return reviews.filter(r => (r.content && r.content.trim()) || (r.text && r.text.trim()));
    },

    generateReviewsHtml: function(reviews, widgetSettings) {
      const filteredReviews = this.filterReviews(reviews, widgetSettings);
      
      return filteredReviews.map((review, index) => {
        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const isVerified = true;
        const isLongText = content.length > 300;

        // Detect individual review source
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        const reviewPlatformLogo = this.getPlatformLogo(reviewSource);
        const reviewPlatformName = reviewSource === 'facebook' ? 'Facebook' : 'Google';

        // Generate rating display based on platform
        let ratingDisplay = '';
        if (widgetSettings.showRatings !== false) {
          if (reviewSource === 'facebook') {
            ratingDisplay = this.generateRecommendationStatus(review);
          } else if (rating > 0) {
            ratingDisplay = `<div class="rh-list-item-rating">${stars}</div>`;
          }
        }

        return `
          <div class="rh-list-review-item">
            <div class="rh-list-source-badge">
              <img src="${reviewPlatformLogo}" alt="${reviewPlatformName}" class="rh-list-source-logo">
            </div>
            
            <div class="rh-list-item-header">
              <div class="rh-list-item-avatar">
                ${profilePicture && widgetSettings.showProfilePictures !== false ? 
                  `<span>${initials}</span>` : 
                  `<span>${initials}</span>`
                }
              </div>
              
              <div class="rh-list-item-content">
                <div class="rh-list-item-author-line">
                  <p class="rh-list-item-author-name">${author}</p>
                  ${isVerified ? '<span class="rh-list-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                </div>
                
                <div class="rh-list-item-meta">
                  ${ratingDisplay}
                  ${widgetSettings.showDates !== false && date ? `
                    <div class="rh-list-item-date">${date}</div>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <div class="rh-list-item-text">${content}</div>
            ${isLongText ? `<button class="rh-list-read-more" data-review-index="${index}">Read More</button>` : ''}
          </div>
        `;
      }).join('');
    },

    generateLoadMoreButtons: function(widgetState, totalReviewCount) {
      const hasMoreReviews = totalReviewCount > widgetState.loadedReviews.length;
      const canShowLess = widgetState.displayCount > CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT;
      
      if (hasMoreReviews || canShowLess) {
        const loadMoreButton = hasMoreReviews ? 
          `<button class="rh-list-load-more-btn" data-action="load-more">Load More Reviews</button>` : '';
        const showLessButton = canShowLess ? 
          `<button class="rh-list-show-less-btn" data-action="show-less">Show Less</button>` : '';
        
        return `
          <div class="rh-list-load-more-container">
            ${loadMoreButton}
            ${showLessButton}
          </div>
        `;
      }
      return '';
    },

    renderWidget: function(container, data, config, displayCount = null) {
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      
      // Get or create widget state
      const widgetId = config.widgetId;
      if (!this.widgetStates.has(widgetId)) {
        this.widgetStates.set(widgetId, {
          displayCount: displayCount || CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT,
          loadedReviews: reviews || [],
          currentOffset: reviews ? reviews.length : 0,
          isExpanded: false
        });
      }
      
      const widgetState = this.widgetStates.get(widgetId);
      if (displayCount !== null) {
        widgetState.displayCount = displayCount;
      }
      
      // Filter reviews based on widget settings
      const filteredReviews = this.filterReviews(widgetState.loadedReviews, widgetSettings);
      
      // Detect platform from first review or widget settings
      const platformSource = filteredReviews.length > 0 ? this.detectReviewSource(filteredReviews[0], widgetSettings) : 'google';
      
      // Get appropriate theme color
      const userThemeColor = config.themeColor || widgetSettings.themeColor;
      const themeColor = this.getPlatformThemeColor(platformSource, userThemeColor);
      
      container.style.setProperty('--list-theme-color', themeColor);
      container.style.setProperty('--list-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--list-theme-color-light', this.lightenColor(themeColor, 90));

      if (!filteredReviews || filteredReviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-list-error"><div class="reviewhub-list-error-title">No reviews to display.</div><div class="reviewhub-list-error-message">Check back later or add some reviews!</div></div>';
        return;
      }
      
      // Determine how many reviews to show
      const currentDisplayCount = Math.min(widgetState.displayCount, filteredReviews.length);
      const reviewsToShow = filteredReviews.slice(0, currentDisplayCount);
      const totalReviews = totalReviewCount || filteredReviews.length;
      const hasMoreReviews = totalReviews > widgetState.loadedReviews.length;
      const canShowLess = currentDisplayCount > CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT;

      const reviewItemsHtml = this.generateReviewsHtml(reviewsToShow, widgetSettings);

      // Generate load more/show less buttons
      const loadMoreButtonsHtml = this.generateLoadMoreButtons(widgetState, totalReviews);

      const listHtml = `
        <div class="reviewhub-list-widget">
          <div class="reviewhub-list-container">
            <div class="rh-list-reviews-section">
              ${reviewItemsHtml}
            </div>
            ${loadMoreButtonsHtml}
          </div>
        </div>
      `;

      container.innerHTML = listHtml;
      this.attachModalEventListeners(container, reviewsToShow, data, config);
      this.attachLoadMoreEventListeners(container, data, config);
    },

    attachModalEventListeners: function(container, reviews, allData, config) {
        container.querySelectorAll('.rh-list-read-more').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const reviewIndex = parseInt(button.getAttribute('data-review-index'));
                if (!isNaN(reviewIndex) && reviews[reviewIndex]) {
                    this.showReviewModal(reviews[reviewIndex], allData, config);
                }
            });
        });
    },

    attachLoadMoreEventListeners: function(container, data, config) {
        const loadMoreBtn = container.querySelector('.rh-list-load-more-btn');
        const showLessBtn = container.querySelector('.rh-list-show-less-btn');
        
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const widgetState = this.widgetStates.get(config.widgetId);
                
                // Show loading state
                loadMoreBtn.textContent = 'Loading...';
                loadMoreBtn.disabled = true;
                
                try {
                    // Fetch more reviews from database
                    const newData = await this.fetchReviewsWithPagination(config, widgetState.currentOffset, CONFIG.LIST_SETTINGS.LOAD_MORE_INCREMENT);
                    
                    if (newData && newData.reviews && newData.reviews.length > 0) {
                        // Add new reviews to the state
                        widgetState.loadedReviews.push(...newData.reviews);
                        widgetState.currentOffset += newData.reviews.length;
                        widgetState.displayCount += CONFIG.LIST_SETTINGS.LOAD_MORE_INCREMENT;
                        widgetState.isExpanded = true;
                        
                        // Update the reviews section without recreating the entire widget
                        const reviewsContainer = container.querySelector('.reviewhub-list-container');
                        const newReviewsHtml = this.generateReviewsHtml(
                            widgetState.loadedReviews.slice(0, widgetState.displayCount),
                            data.widgetSettings
                        );
                        
                        // Replace only the reviews part, keeping the load more button
                        const reviewsSection = reviewsContainer.querySelector('.rh-list-reviews-section');
                        if (reviewsSection) {
                            reviewsSection.innerHTML = newReviewsHtml;
                        } else {
                            // If no reviews section exists, update the entire container
                            reviewsContainer.innerHTML = newReviewsHtml + this.generateLoadMoreButtons(widgetState, data.totalReviewCount);
                        }
                        
                        // Re-attach modal event listeners to new reviews
                        this.attachModalEventListeners(container, widgetState.loadedReviews.slice(0, widgetState.displayCount), data, config);
                        
                        // Update load more button visibility
                        const hasMoreReviews = data.totalReviewCount > widgetState.loadedReviews.length;
                        if (!hasMoreReviews) {
                            loadMoreBtn.textContent = 'No More Reviews';
                            loadMoreBtn.disabled = true;
                        } else {
                            loadMoreBtn.textContent = 'Load More Reviews';
                            loadMoreBtn.disabled = false;
                        }
                    } else {
                        // No more reviews to load
                        loadMoreBtn.textContent = 'No More Reviews';
                        loadMoreBtn.disabled = true;
                    }
                } catch (error) {
                    console.error('Error loading more reviews:', error);
                    loadMoreBtn.textContent = 'Load More Reviews';
                    loadMoreBtn.disabled = false;
                }
            });
        }
        
        if (showLessBtn) {
            showLessBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const widgetState = this.widgetStates.get(config.widgetId);
                widgetState.displayCount = CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT;
                widgetState.isExpanded = false;
                this.renderWidget(container, data, config, CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT);
                
                // Smooth scroll to top
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    },

    showReviewModal: function(review, allData, config) {
        // Only show modal if review has content or text
        if (!((review.content && review.content.trim()) || (review.text && review.text.trim()))) return;

        if (document.querySelector('.reviewhub-list-modal-overlay')) return;

        const { widgetSettings } = allData;

        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const displayContent = content.replace(/\n/g, '<br>');
        const source = this.detectReviewSource(review, widgetSettings);
        const isVerified = true;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'reviewhub-list-modal-overlay';
        
        const showAvatarsSetting = widgetSettings.showProfilePictures !== false;
        const showDatesSetting = widgetSettings.showDates !== false;
        const showRatingsSetting = widgetSettings.showRatings !== false;

        // Generate rating display for modal based on platform
        let modalRatingDisplay = '';
        if (showRatingsSetting) {
          if (source === 'facebook') {
            modalRatingDisplay = this.generateRecommendationStatus(review);
          } else if (rating > 0) {
            modalRatingDisplay = `<div class="reviewhub-list-modal-rating">${stars}</div>`;
          }
        }

        const modalHTML = `
            <div class="reviewhub-list-modal">
                <button class="reviewhub-list-modal-close" aria-label="Close modal">&times;</button>
                <div class="reviewhub-list-modal-header">
                    <div class="reviewhub-list-modal-avatar">
                        ${profilePicture && showAvatarsSetting ? 
                          `<span>${initials}</span>` : 
                          `<span>${initials}</span>`
                        }
                    </div>
                    <div class="reviewhub-list-modal-author-details">
                        <div class="reviewhub-list-modal-author-line">
                            <h3 class="reviewhub-list-modal-author-name">${author}</h3>
                            ${isVerified ? '<span class="reviewhub-list-modal-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                        </div>
                         ${showDatesSetting && date ? `
                           <p class="reviewhub-list-modal-review-meta">
                             ${date}
                           </p>` : ''}
                         ${modalRatingDisplay}
                    </div>
                </div>
                <div class="reviewhub-list-modal-content">
                    ${displayContent}
                </div>
            </div>
        `;
        modalOverlay.innerHTML = modalHTML;
        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';

        // Trigger transition
        setTimeout(() => modalOverlay.classList.add('visible'), 10);

        const closeModal = () => {
            modalOverlay.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(modalOverlay);
                document.body.style.overflow = '';
            }, 300);
            document.removeEventListener('keydown', handleEscape);
        };

        modalOverlay.querySelector('.reviewhub-list-modal-close').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        document.addEventListener('keydown', handleEscape);
    },

    initWidget: async function(userConfig) {
      let container;
      const config = { 
          widgetId: null, 
          containerId: null, 
          themeColor: '#3B82F6', 
          layout: 'list',
          ...userConfig 
      };

      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-list-widget-container';
          this.showError(errDiv, new Error(`Container #${config.containerId} not found.`), config, null);
          document.body.insertAdjacentElement('beforeend', errDiv);
          return;
        }
      } else if (config._scriptTag) {
          container = document.createElement('div');
          config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
      } else {
        return;
      }
      
      container.className = 'reviewhub-list-widget-container';
      container.innerHTML = `
        <div class="reviewhub-list-loading">
          <div class="reviewhub-list-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      container.style.setProperty('--list-theme-color', config.themeColor);
      container.style.setProperty('--list-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--list-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
          this.showError(container, new Error('Widget ID is missing.'), config, null);
          return;
      }

      const retryLoad = () => {
        container.innerHTML = '';
        this.initWidget(config); 
      };

      try {
        // Use pagination for initial load
        const data = await this.fetchReviewsWithPagination(config, 0, CONFIG.LIST_SETTINGS.INITIAL_REVIEW_COUNT);
        if (data && data.reviews) {
          data.widgetSettings = data.widgetSettings || {}; 
          this.renderWidget(container, data, config);
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        this.showError(container, error, config, retryLoad);
      }
    },

    // Public init method
    init: function(userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;
      
      if (document.readyState === 'loading') {
          window.ReviewHubList._pendingInitializations = window.ReviewHubList._pendingInitializations || [];
          window.ReviewHubList._pendingInitializations.push(config);
      } else {
          this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-list.js"]');
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'list',
        _scriptTag: script
      };
      
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubList.initWidget(config);
    });
  }
  
  function processPendingInitializations() {
      if (window.ReviewHubList._pendingInitializations) {
          window.ReviewHubList._pendingInitializations.forEach(config => window.ReviewHubList.initWidget(config));
          delete window.ReviewHubList._pendingInitializations;
      }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeWidgetsFromScripts();
        processPendingInitializations();
    });
  } else {
    setTimeout(() => {
        initializeWidgetsFromScripts();
        processPendingInitializations();
    }, 0);
  }

})(); 