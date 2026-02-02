(function () {
  if (window.ReviewHubBar && window.ReviewHubBar.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function () {
      const scripts = document.querySelectorAll('script[src*="widget-bar.js"]');
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
    BAR_SETTINGS: {
      INITIAL_REVIEW_COUNT: 12, // Show first 8 reviews initially in modal
      LOAD_MORE_INCREMENT: 6   // Load 6 more reviews each time
    }
  };

  window.ReviewHubBar = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    // State tracking for modal pagination
    modalStates: new Map(),

    // Cache for fetched reviews to avoid re-fetching
    reviewCache: new Map(),

    log: function (level, message, data) {
      // Console logging disabled for production
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
        return dateString || 'Recently';
      }
    },

    generateStars: function (rating) {
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

    generateRecommendationStatus: function (review) {
      // For Facebook reviews, show recommendation status instead of stars
      const recommendationStatus = review.recommendationStatus || '';
      if (recommendationStatus === 'recommended') {
        return '<div class="rh-bar-recommendation-status rh-bar-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-bar-recommendation-status rh-bar-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
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
      // Always use user-provided theme color if available
      if (userThemeColor) {
        return userThemeColor;
      }

      // Use platform-specific colors only as fallback
      if (source === 'facebook') {
        return '#1877F2'; // Facebook blue
      } else {
        return '#4285F4'; // Google blue
      }
    },

    // New function to fetch reviews with pagination
    fetchReviewsWithPagination: async function (widgetId, offset = 0, limit = 8) {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      params.append('layout', 'bar');

      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${widgetId}?${queryString}`;

      console.log(`[Bar Pagination] Fetching reviews: ${apiUrl}`);
      const data = await this.fetchWithRetry(apiUrl);
      console.log(`[Bar Pagination] Received ${data.reviews?.length || 0} reviews, total: ${data.totalReviewCount || 0}`);

      return data;
    },

    // Removed fetchAllReviews as it is no longer used.
    // We now rely on server-side aggregation for stats and initial reviews.

    filterReviews: function (reviews, widgetSettings) {
      if (!reviews || reviews.length === 0) return reviews;
      // Filter out reviews with empty content or text
      return reviews.filter(review => ((review.content && review.content.trim()) || (review.text && review.text.trim())) && (function () {
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        if (reviewSource === 'facebook') {
          const reviewFilterDisplay = widgetSettings.reviewFilterDisplay;
          if (reviewFilterDisplay) {
            if (reviewFilterDisplay === 'recommended' && review.recommendationStatus !== 'recommended') {
              return false;
            }
            if (reviewFilterDisplay === 'not_recommended' && review.recommendationStatus !== 'not_recommended') {
              return false;
            }
          }
        } else {
          const minRating = widgetSettings.minRating;
          if (minRating && typeof minRating === 'number') {
            const reviewRating = parseFloat(review.rating) || 0;
            if (reviewRating < minRating) {
              return false;
            }
          }
        }
        return true;
      }).call(this, review));
    },

    // Helper function to generate reviews HTML
    generateReviewsHtml: function (reviews, widgetSettings) {
      return reviews.map((review) => {
        const formattedDate = this.formatDate(review.postedAt);
        const initials = this.getInitials(review.author);

        // Detect individual review source
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        const reviewPlatformLogo = this.getPlatformLogo(reviewSource);
        const reviewPlatformName = reviewSource === 'facebook' ? 'Facebook' : 'Google';

        // Generate rating display based on platform
        let reviewRatingDisplay = '';
        if (reviewSource === 'facebook') {
          reviewRatingDisplay = this.generateRecommendationStatus(review);
        } else {
          const reviewStars = this.generateStars(review.rating || 0);
          reviewRatingDisplay = `<div class="reviewhub-bar-modal-review-rating">${reviewStars}</div>`;
        }

        return `
           <div class="reviewhub-bar-modal-review">
             <div class="reviewhub-bar-modal-review-header">
               ${review.profilePicture ?
            `<div class="reviewhub-bar-modal-review-avatar">${initials}</div>` :
            `<div class="reviewhub-bar-modal-review-avatar">${initials}</div>`
          }
               <div class="reviewhub-bar-modal-review-info">
                 <div class="reviewhub-bar-modal-review-author">${this.escapeHtml(review.author)}</div>
                 <div class="reviewhub-bar-modal-review-date-label">${widgetSettings.showDates}</div>
                   ${widgetSettings.showDates !== false && formattedDate ? `
                   <div class="reviewhub-bar-modal-review-date">
                  ${formattedDate}
                   </div>` : ''}
               </div>
             </div>
             ${reviewRatingDisplay}
             <div class="reviewhub-bar-modal-review-content">${this.escapeHtml(review.content)}</div>
             <div class="reviewhub-bar-modal-review-source">
               <img src="${reviewPlatformLogo}" alt="${reviewPlatformName}" class="reviewhub-bar-modal-review-source-logo" />
               Posted on ${reviewPlatformName}
             </div>
           </div>
         `;
      }).join('');
    },

    injectStyles: function () {
      if (document.getElementById('reviewhub-bar-widget-styles')) return;

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
      style.id = 'reviewhub-bar-widget-styles';
      style.textContent = `
        /* Global styles */
        i {
            font-style: normal !important;
        }
        .reviewhub-bar-widget-container h1,
        .reviewhub-bar-widget-container h2,
        .reviewhub-bar-widget-container h3,
        .reviewhub-bar-widget-container h4,
        .reviewhub-bar-widget-container h5,
        .reviewhub-bar-widget-container h6 {
          margin: 0 !important;
          padding: 0 !important;
          font-weight: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-bar-widget-container p {
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-bar-widget-container button {
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
        
        .reviewhub-bar-widget-container a {
          color: inherit !important;
          text-decoration: none !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-bar-widget-container i {
          font-style: normal !important;
        }

        .reviewhub-bar-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-bar-widget-container *::before,
        .reviewhub-bar-widget-container *::after,
        .reviewhub-bar-widget-container * {
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
        .reviewhub-bar-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-bar-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid #F3F4F6;
          border-top: 2px solid var(--bar-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-bar-spin 0.8s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes rh-bar-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-bar-error {
          padding: 30px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
          font-size: 14px;
        }
        .reviewhub-bar-error-title {
          font-size: 1em;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .reviewhub-bar-error-message {
          font-size: 0.85em;
          margin-bottom: 12px;
          opacity: 0.9;
        }
        .reviewhub-bar-retry-button {
          background-color: #DC2626;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.85em;
          transition: all 0.2s ease;
        }
        .reviewhub-bar-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }

        /* Bar Widget Styles */
        .reviewhub-bar-widget {
          background: #FFFFFF;
          border-radius: 0;
          box-shadow: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          border: 1px solid #E5E7EB;
          border-left: none;
          width: fit-content;
          min-width: fit-content;
          max-width: none;
          height: 30px;
          max-height: 30px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: all 0.2s ease;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }

        .reviewhub-bar-widget::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 100%;
          background: #22C55E;
          z-index: 1;
        }

        .reviewhub-bar-widget:hover {
          transform: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .reviewhub-bar-compact-header {
          display: none;
        }

        .reviewhub-bar-compact-logo {
          width: 18px;
          height: 18px;
          border-radius: 2px;
          flex-shrink: 0;
          margin-right: 8px;
        }

        .reviewhub-bar-compact-title {
          display: none;
        }

        .reviewhub-bar-compact-rating {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          width: 100%;
          justify-content: flex-start;
          padding: 0 12px;
          height: 100%;
        }

        .reviewhub-bar-compact-stars {
          color: #f5ca0b;
          font-size: 14px;
          letter-spacing: 1px;
          line-height: 1;
          display: flex;
          gap: 1px;
        }

        .reviewhub-bar-compact-text {
          font-size: 12px;
          font-weight: 400;
          color: #6B7280;
          line-height: 1.2;
          text-align: left;
        }

        .reviewhub-bar-compact-number {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          line-height: 1;
        }

        .reviewhub-bar-compact-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: #6B7280;
          margin-top: 2px;
        }

        /* Legacy styles - keeping for backwards compatibility but unused in compact design */
        .reviewhub-bar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .reviewhub-bar-logo {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reviewhub-bar-title {
          font-weight: 600;
          font-size: 1.1rem;
          color: #1F2937;
          margin: 0;
        }

        .reviewhub-bar-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #E5E7EB 50%, transparent 100%);
          margin: 12px 0 16px 0;
        }

        .reviewhub-bar-rating-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
          gap: 8px;
        }

        .reviewhub-bar-rating-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1F2937;
          line-height: 1;
        }

        .reviewhub-bar-stars {
          color: rgb(245, 202, 11);
          font-size: 1.4rem;
          letter-spacing: 1px;
          line-height: 1;
          display: flex;
          gap: 2px;
        }

        /* Facebook recommendation status styles */
        .rh-bar-recommendation-status {
          display: flex;
          align-items: center;
          justify-content: start;
          gap: 6px;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.5px;
          line-height: 1;
          padding: 4px 0;
          gap: 4px;

        }

        .rh-bar-recommended {
          color: #16A34A;
        }

        .rh-bar-not-recommended {
          color: #DC2626;
        }

        .rh-bar-recommendation-status i {
          font-size: 1.1rem;
          text-decoration: none;
        }

        .reviewhub-bar-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          width: 100%;
        }

        .reviewhub-bar-review-link {
          color: #6B7280;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid #E5E7EB;
          background: #FAFBFC;
        }

        .reviewhub-bar-review-link:hover {
          color: var(--bar-theme-color, #3B82F6);
          background: var(--bar-theme-color-light, #EFF6FF);
          border-color: var(--bar-theme-color, #3B82F6);
          transform: translateY(-1px);
        }

        .reviewhub-bar-write-review {
          background: var(--bar-theme-color, #3B82F6);
          color: white;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: inline-block;
          text-align: center;
          width: 100%;
          border: none;
          cursor: pointer;
        }

        .reviewhub-bar-write-review:hover {
          background: var(--bar-theme-color-dark, #2563EB);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        /* Modal styles */
        .reviewhub-bar-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: stretch;
          justify-content: flex-start;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }
        .reviewhub-bar-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .reviewhub-bar-modal-panel {
          background: #fff;
          border-radius: 0 20px 20px 0;
          max-width: 440px;
          width: 100%;
          height: 100vh;
          overflow-y: auto;
          box-shadow: 4px 0 32px rgba(0,0,0,0.15);
          position: relative;
          padding: 32px 24px;
          transform: translateX(-100%);
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
          display: flex;
          flex-direction: column;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .reviewhub-bar-modal-overlay.visible .reviewhub-bar-modal-panel {
          transform: translateX(0);
        }

        .reviewhub-bar-modal-close {
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

        .reviewhub-bar-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
          padding: 20px !important;
        }

        .reviewhub-bar-modal-title {
            font-size: 1.4rem !important;
            line-height: 1.2 !important;
            font-weight: 700;
            margin-bottom: 24px;
            color: #1F2937;
        }

        .reviewhub-bar-modal-summary {
          background: #F9FAFB;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid #E5E7EB;
        }

        .reviewhub-bar-modal-summary-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          gap: 10px;
        }

        .reviewhub-bar-modal-summary-logo {
          width: 28px;
          height: 28px;
        }

        .reviewhub-bar-modal-summary-title {
          font-weight: 600;
          font-size: 1.1rem !important;
          color: #1F2937;
          margin: 0;
        }

        .reviewhub-bar-modal-summary-rating {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .reviewhub-bar-modal-summary-number {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1F2937;
        }

        .reviewhub-bar-modal-summary-stars {
          color: rgb(245, 202, 11);
          font-size: 1.1rem;
          letter-spacing: 2px;
          display: flex;
          gap: 2px;
        }

        .reviewhub-bar-modal-summary-count {
          color: #6B7280;
          font-size: 0.95rem;
        }

        .reviewhub-bar-modal-cta {
          background: var(--bar-theme-color, #3B82F6);
          color: #fff;
          border-radius: 10px;
          font-weight: 600;
          font-size: 1rem;
          text-decoration: none;
          transition: background 0.2s ease-in-out;
          text-align: center;
          width: 100%;
          padding: 12px 0px;
          display: none;
          border: none;
          cursor: pointer;
        }

        .reviewhub-bar-modal-cta:hover {
          background: var(--bar-theme-color-dark, #2563EB);
        }

        .reviewhub-bar-modal-reviews {
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 8px;
        }

        .reviewhub-bar-modal-review {
          background: #fff;
          border-radius: 12px;
          padding: 18px;
          border: 1px solid #F3F4F6;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }
        .reviewhub-bar-modal-review-date-label{
          display: none;
        }
        
        .reviewhub-bar-modal-review:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }

        .reviewhub-bar-modal-review-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          gap: 12px;
        }

        .reviewhub-bar-modal-review-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #E5E7EB;
          object-fit: cover;
          background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 0.9rem;
        }

        .reviewhub-bar-modal-review-info {
          flex: 1;
        }

        .reviewhub-bar-modal-review-author {
          font-weight: 600;
          color: #1F2937;
          font-size: 1rem;
          margin: 0 0 2px 0;
        }

        .reviewhub-bar-modal-review-date {
          font-size: 0.85rem;
          color: #6B7280;
          margin: 0;
        }

        .reviewhub-bar-modal-review-rating {
          color: rgb(245, 202, 11);
          font-size: 1rem;
          margin-bottom: 8px;
          letter-spacing: 2px;
          display: flex;
          gap: 2px;
        }

        .reviewhub-bar-modal-review-content {
          color: #374151;
          font-size: 0.95rem;
          margin-bottom: 8px;
          line-height: 1.6;
        }

        .reviewhub-bar-modal-review-source {
          display: flex;
          align-items: center;
          font-size: 0.8rem;
          color: #6B7280;
          gap: 4px;
        }

        .reviewhub-bar-modal-review-source-logo {
          width: 14px;
          height: 14px;
        }

        /* Load More Button Styles for Modal */
        .reviewhub-bar-modal-load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #E5E7EB;
        }

        .reviewhub-bar-modal-load-more-btn {
          background: var(--bar-theme-color, #3B82F6);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .reviewhub-bar-modal-load-more-btn:hover {
          background: var(--bar-theme-color-dark, #2563EB);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .reviewhub-bar-modal-load-more-btn:disabled {
          opacity: 0.7 !important;
          cursor: not-allowed !important;
          transform: none !important;
          background: #9CA3AF !important;
          color: #6B7280 !important;
        }

        .reviewhub-bar-modal-load-more-btn:disabled:hover {
          background: #9CA3AF !important;
          transform: none !important;
          box-shadow: 0 2px 8px rgba(156, 163, 175, 0.15) !important;
          color: #6B7280 !important;
        }

        /* Mobile responsive */
        @media (max-width: 640px) {
          .reviewhub-bar-widget {
            width: fit-content;
            min-width: fit-content;
            max-width: none;
            height: 28px;
            max-height: 28px;
            margin: 4px;
          }

          .reviewhub-bar-compact-rating {
            padding: 0 8px;
            gap: 6px;
          }

          .reviewhub-bar-compact-logo {
            width: 16px;
            height: 16px;
            margin-right: 6px;
          }

          .reviewhub-bar-compact-stars {
            font-size: 12px;
          }

          .reviewhub-bar-compact-text {
            font-size: 11px;
          }

          .reviewhub-bar-compact-number {
            font-size: 12px;
          }

          .reviewhub-bar-modal-panel {
            max-width: 100%;
            border-radius: 0;
            padding: 24px 20px;
          }

          .reviewhub-bar-modal-title {
            font-size: 1.2rem;
          }

          .reviewhub-bar-modal-reviews {
            max-height: 55vh;
          }

          .reviewhub-bar-modal-review {
            padding: 14px;
          }

          .reviewhub-bar-modal-review-avatar {
            width: 36px;
            height: 36px;
            font-size: 0.8rem;
          }
        }
          i{
          font-style: normal !important;
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
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1))); // Exponential backoff
        }
      }
    },

    showError: function (container, error, config, retryCallback) {
      const themeColor = config.themeColor || '#3B82F6';
      container.style.setProperty('--bar-theme-color', themeColor);
      container.style.setProperty('--bar-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--bar-theme-color-light', this.lightenColor(themeColor, 80));

      container.innerHTML = `
        <div class="reviewhub-bar-error">
          <div class="reviewhub-bar-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-bar-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-bar-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-bar-retry-button');
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
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      // Filter reviews based on widget settings
      const filteredReviews = this.filterReviews(reviews, widgetSettings);
      // Detect platform from first review or widget settings
      const platformSource = filteredReviews.length > 0 ? this.detectReviewSource(filteredReviews[0], widgetSettings) : 'google';
      const platformLogo = this.getPlatformLogo(platformSource);
      const platformName = platformSource === 'facebook' ? 'Facebook' : 'Google';

      // Get appropriate theme color
      const userThemeColor = config.themeColor || widgetSettings.themeColor;
      const themeColor = this.getPlatformThemeColor(platformSource, userThemeColor);

      container.style.setProperty('--bar-theme-color', themeColor);
      container.style.setProperty('--bar-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--bar-theme-color-light', this.lightenColor(themeColor, 90));

      if (!filteredReviews || filteredReviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-bar-error"><div class="reviewhub-bar-error-title">No reviews to display.</div><div class="reviewhub-bar-error-message">Check back later or add some reviews!</div></div>';
        return;
      }

      // Calculate average rating or recommendation percentage for Facebook
      let avgRating, reviewCount, displayText;
      reviewCount = totalReviewCount || filteredReviews.length;

      if (data.averageRating) {
        // Use server-provided average rating if available
        avgRating = data.averageRating;
        if (platformSource === 'facebook' && typeof avgRating === 'string' && !avgRating.includes('%')) {
          avgRating = `${avgRating}%`;
        }
      } else {
        if (platformSource === 'facebook') {
          // For Facebook, calculate percentage of recommended reviews
          const recommendedReviews = filteredReviews.filter(r => r.recommendationStatus === 'recommended').length;
          const percentage = filteredReviews.length > 0 ? Math.round((recommendedReviews / filteredReviews.length) * 100) : 100;
          avgRating = `${percentage}%`;
        } else {
          // For Google, use traditional star rating
          avgRating = filteredReviews.length > 0 ? (filteredReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / filteredReviews.length).toFixed(1) : '5.0';
        }
      }

      if (platformSource === 'facebook') {
        displayText = 'Recommended';
      } else {
        displayText = 'Stars';
      }

      const reviewText = reviewCount === 1 ? 'review' : 'reviews';

      // Generate rating/recommendation display
      let ratingDisplay = '';
      if (platformSource === 'facebook') {
        // Calculate recommendation status description
        const recommendedCount = filteredReviews.filter(r => r.recommendationStatus === 'recommended').length;
        const notRecommendedCount = filteredReviews.filter(r => r.recommendationStatus === 'not_recommended').length;
        const recommendedPercentage = filteredReviews.length > 0 ? (recommendedCount / filteredReviews.length) * 100 : 100;

        let statusDescription = '';
        if (recommendedPercentage >= 80) {
          statusDescription = 'Mostly Recommended';
        } else if (recommendedPercentage >= 60) {
          statusDescription = 'Generally Recommended';
        } else if (recommendedPercentage >= 40) {
          statusDescription = 'Mixed Reviews';
        } else if (recommendedPercentage >= 20) {
          statusDescription = 'Generally Not Recommended';
        } else {
          statusDescription = 'Mostly Not Recommended';
        }

        ratingDisplay = `
          <div class="reviewhub-bar-compact-rating">
            <span class="reviewhub-bar-compact-number">${avgRating}</span>
            <span class="reviewhub-bar-compact-text">${reviewCount} ${reviewText} | ${statusDescription}</span>
          </div>
        `;
      } else {
        const stars = this.generateStars(parseFloat(avgRating));
        ratingDisplay = `
          <div class="reviewhub-bar-compact-rating">
            <div class="reviewhub-bar-compact-stars">${stars}</div>
            <span class="reviewhub-bar-compact-text">${avgRating} ${displayText} | ${reviewCount} ${reviewText}</span>
          </div>
        `;
      }

      const barHtml = `
        <div class="reviewhub-bar-widget reviewhub-bar-modal-btn" role="button" tabindex="0" aria-label="View ${reviewCount} reviews">
          <div class="reviewhub-bar-compact-rating">
            <span class="reviewhub-bar-compact-number">${avgRating} ${platformSource === 'facebook' ? 'Recommended' : 'Stars'}</span>
            ${platformSource === 'google' ? `<div class="reviewhub-bar-compact-stars">${this.generateStars(parseFloat(avgRating))}</div>` : ''}
            <span class="reviewhub-bar-compact-text">${reviewCount} reviews on</span>
            <img src="${platformLogo}" alt="${platformName}" class="reviewhub-bar-compact-logo" />
          </div>
        </div>
      `;

      container.innerHTML = barHtml;
      this.attachModalEventListener(container, { ...data, reviews: filteredReviews }, config);
    },

    attachModalEventListener: function (container, data, config) {
      const modalBtn = container.querySelector('.reviewhub-bar-modal-btn');
      if (!modalBtn) return;

      const openModal = async (e) => {
        e.preventDefault();
        await this.showReviewsModal(data, config);
      };

      modalBtn.addEventListener('click', openModal);

      // Add keyboard support for accessibility
      modalBtn.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          await openModal(e);
        }
      });
    },

    showReviewsModal: async function (data, config) {
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;

      const modalId = `modal-${config.widgetId}`;
      const initialCount = CONFIG.BAR_SETTINGS.INITIAL_REVIEW_COUNT;

      if (!this.modalStates.has(modalId)) {
        this.modalStates.set(modalId, {
          loadedReviews: reviews || [],
          currentOffset: reviews ? reviews.length : 0,
          totalReviews: totalReviewCount || (reviews ? reviews.length : 0),
          displayCount: Math.min(initialCount, (reviews ? reviews.length : 0)),
          isFetching: false
        });
      }

      const modalState = this.modalStates.get(modalId);

      // Filter reviews based on widget settings
      const filteredReviews = this.filterReviews(modalState.loadedReviews, widgetSettings);

      // Detect platform from first review or widget settings
      const platformSource = filteredReviews.length > 0 ? this.detectReviewSource(filteredReviews[0], widgetSettings) : 'google';
      const platformLogo = this.getPlatformLogo(platformSource);
      const platformName = platformSource === 'facebook' ? 'Facebook' : 'Google';

      // Calculate appropriate rating display for modal summary
      let avgRating, reviewCount, summaryRatingDisplay;
      reviewCount = modalState.totalReviews || filteredReviews.length;

      if (platformSource === 'facebook') {
        // For Facebook, calculate percentage of recommended reviews
        const recommendedReviews = filteredReviews.filter(r => r.recommendationStatus === 'recommended').length;
        const percentage = filteredReviews.length > 0 ? Math.round((recommendedReviews / filteredReviews.length) * 100) : 100;
        avgRating = `${percentage}%`;
        summaryRatingDisplay = `<span class="reviewhub-bar-modal-summary-number">${avgRating}</span>`;
      } else {
        // For Google, use traditional star rating
        avgRating = filteredReviews.length > 0 ? (filteredReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / filteredReviews.length).toFixed(1) : '5.0';
        const stars = this.generateStars(parseFloat(avgRating));
        summaryRatingDisplay = `
          <span class="reviewhub-bar-modal-summary-number">${avgRating}</span>
          <span class="reviewhub-bar-modal-summary-stars">${stars}</span>
        `;
      }

      // Determine review URL
      let reviewUrl;
      if (businessUrlLink) {
        reviewUrl = businessUrlLink;
      } else if (widgetSettings.businessUrl?.url) {
        reviewUrl = widgetSettings.businessUrl.url;
      } else if (businessName) {
        const searchBase = platformSource === 'facebook' ? 'https://www.facebook.com/search/top?q=' : 'https://www.google.com/maps/search/';
        reviewUrl = `${searchBase}${encodeURIComponent(businessName)}+reviews`;
      } else {
        reviewUrl = platformSource === 'facebook' ? 'https://www.facebook.com' : 'https://www.google.com/maps';
      }

      // Determine how many reviews to show
      // In the new logic, display count tracks strictly what is loaded and shown
      const currentDisplayCount = modalState.loadedReviews.length;
      const reviewsToShow = modalState.loadedReviews; // Show everything we have loaded

      // Check if there are more reviews to display
      // We have more if the total on server > what we have currently loaded
      const hasMoreReviews = modalState.totalReviews > modalState.loadedReviews.length;

      console.log(`[Bar Modal] State:`, {
        loadedReviews: modalState.loadedReviews.length,
        totalReviews: modalState.totalReviews,
        currentDisplayCount,
        filteredReviewsLength: filteredReviews.length,
        hasMoreReviews
      });

      const reviewsHtml = this.generateReviewsHtml(reviewsToShow, widgetSettings);

      // Generate load more button - only show if there are more reviews to load
      const loadMoreButton = hasMoreReviews ?
        `<div class="reviewhub-bar-modal-load-more-container">
           <button class="reviewhub-bar-modal-load-more-btn" data-action="load-more">Load More Reviews</button>
         </div>` :
        `<div class="reviewhub-bar-modal-load-more-container">
           <button class="reviewhub-bar-modal-load-more-btn" data-action="load-more" disabled>No More Reviews</button>
         </div>`;

      const modalHtml = `
        <div class="reviewhub-bar-modal-overlay">
          <div class="reviewhub-bar-modal-panel">
            <button class="reviewhub-bar-modal-close" aria-label="Close modal">&times;</button>
            
            <h2 class="reviewhub-bar-modal-title">What our customers say</h2>
            
            <div class="reviewhub-bar-modal-summary">
              <div class="reviewhub-bar-modal-summary-header">
                <img src="${platformLogo}" alt="${platformName}" class="reviewhub-bar-modal-summary-logo" />
                <h3 class="reviewhub-bar-modal-summary-title">${platformName} Reviews</h3>
              </div>
              <div class="reviewhub-bar-modal-summary-rating">
                ${summaryRatingDisplay}
                <span class="reviewhub-bar-modal-summary-count">(${reviewCount})</span>
              </div>
              <a href="${reviewUrl}" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="reviewhub-bar-modal-cta">
                Review us on ${platformName}
              </a>
            </div>
            
            <div class="reviewhub-bar-modal-reviews">
              ${reviewsHtml}
            </div>
            ${loadMoreButton}
          </div>
        </div>
      `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement);
      document.body.style.overflow = 'hidden';

      const overlay = modalElement.querySelector('.reviewhub-bar-modal-overlay');
      const closeBtn = modalElement.querySelector('.reviewhub-bar-modal-close');
      const loadMoreBtn = modalElement.querySelector('.reviewhub-bar-modal-load-more-btn');

      // Show modal with animation
      setTimeout(() => overlay.classList.add('visible'), 10);

      const closeModal = () => {
        overlay.classList.remove('visible');
        setTimeout(() => {
          document.body.removeChild(modalElement);
          document.body.style.overflow = '';
          // Clean up modal state when closing
          this.modalStates.delete(modalId);
        }, 350);
      };

      // Load more functionality
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (modalState.isFetching) return;

          modalState.isFetching = true;
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;

          loadMoreBtn.disabled = true;

          try {
            // Fetch next batch from server
            const nextOffset = modalState.loadedReviews.length;
            const newData = await this.fetchReviewsWithPagination(
              config.widgetId,
              nextOffset,
              CONFIG.BAR_SETTINGS.LOAD_MORE_INCREMENT
            );

            if (newData && newData.reviews && newData.reviews.length > 0) {
              // Append new reviews
              modalState.loadedReviews = [...modalState.loadedReviews, ...newData.reviews];
              modalState.currentOffset = modalState.loadedReviews.length;

              // Update the reviews section
              const reviewsContainer = modalElement.querySelector('.reviewhub-bar-modal-reviews');
              // We only need to append the NEW reviews HTML, but re-rendering all is safer/easier for now to maintain order
              const newReviewsHtml = this.generateReviewsHtml(
                modalState.loadedReviews,
                widgetSettings
              );
              reviewsContainer.innerHTML = newReviewsHtml;

              // Update load more button visibility
              const hasMoreReviews = modalState.totalReviews > modalState.loadedReviews.length;

              if (!hasMoreReviews) {
                loadMoreBtn.textContent = 'No More Reviews';
                loadMoreBtn.disabled = true;
                loadMoreBtn.style.opacity = '0.7';
                loadMoreBtn.style.cursor = 'not-allowed';
              } else {
                loadMoreBtn.textContent = 'Load More Reviews';
                loadMoreBtn.disabled = false;
                loadMoreBtn.style.opacity = '1';
                loadMoreBtn.style.cursor = 'pointer';
              }
            } else {
              // No more reviews returned
              loadMoreBtn.textContent = 'No More Reviews';
              loadMoreBtn.disabled = true;
              loadMoreBtn.style.opacity = '0.7';
            }
          } catch (error) {
            console.error('Error loading more reviews:', error);
            loadMoreBtn.textContent = 'Load More Reviews';
            loadMoreBtn.disabled = false;
          } finally {
            modalState.isFetching = false;
          }
        });
      }

      closeBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    },

    initWidget: async function (userConfig) {
      let container;
      const config = {
        widgetId: null,
        containerId: null,
        themeColor: '#3B82F6',
        layout: 'bar',
        ...userConfig
      };

      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-bar-widget-container';
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

      container.className = 'reviewhub-bar-widget-container';
      container.innerHTML = `
        <div class="reviewhub-bar-loading">
          <div class="reviewhub-bar-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      container.style.setProperty('--bar-theme-color', config.themeColor);
      container.style.setProperty('--bar-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--bar-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
        this.showError(container, new Error('Widget ID is missing.'), config, null);
        return;
      }

      const params = new URLSearchParams();
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;

      const retryLoad = () => {
        container.innerHTML = '';
        this.initWidget(config);
      };

      try {
        let data;
        const widgetId = config.widgetId;

        // Check for pre-fetched data from widget.js
        if (window.ReviewHubMain && window.ReviewHubMain.dataCache && window.ReviewHubMain.dataCache.has(widgetId)) {
          try {
            console.log(`[ReviewHubBar] Using pre-fetched data for ${widgetId}`);
            data = await window.ReviewHubMain.dataCache.get(widgetId);
          } catch (e) {
            console.warn(`[ReviewHubBar] Pre-fetch lookup failed for ${widgetId}, falling back...`);
          }
        }

        if (!data) {
          // Use standard fetch logic for all layouts now, including 'bar'
          data = await this.fetchWithRetry(apiUrl);
        }

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
    init: function (userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;

      if (document.readyState === 'loading') {
        window.ReviewHubBar._pendingInitializations = window.ReviewHubBar._pendingInitializations || [];
        window.ReviewHubBar._pendingInitializations.push(config);
      } else {
        this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-bar.js"]');
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'bar',
        _scriptTag: script
      };

      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubBar.initWidget(config);
    });
  }

  function processPendingInitializations() {
    if (window.ReviewHubBar._pendingInitializations) {
      window.ReviewHubBar._pendingInitializations.forEach(config => window.ReviewHubBar.initWidget(config));
      delete window.ReviewHubBar._pendingInitializations;
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