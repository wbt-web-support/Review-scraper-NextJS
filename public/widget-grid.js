(function() {
  if (window.ReviewHubGrid && window.ReviewHubGrid.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget-grid.js"]');
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
    GRID_SETTINGS: {
      DEFAULT_COLUMNS: {
        mobile: 1,
        tablet: 2,
        desktop: 3,
        wide: 4
      },
      BREAKPOINTS: {
        mobile: 640,
        tablet: 768,
        desktop: 1024,
        wide: 1280
      }
    }
  };

  window.ReviewHubGrid = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    log: function(level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHubGrid v${this.version}]`;
        if (data) {
          console[level](prefix, message, data);
        } else {
          console[level](prefix, message);
        }
      }
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
        this.log('error', 'Error formatting date', e);
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
        return '<div class="rh-grid-recommendation-status rh-grid-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-grid-recommendation-status rh-grid-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
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

    filterReviews: function(reviews, widgetSettings) {
      if (!reviews || reviews.length === 0) return reviews;
      
      return reviews.filter(review => {
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        
        if (reviewSource === 'facebook') {
          // Filter Facebook reviews based on reviewFilterDisplay setting
          const reviewFilterDisplay = widgetSettings.reviewFilterDisplay;
          if (reviewFilterDisplay) {
            if (reviewFilterDisplay === 'recommended' && review.recommendationStatus !== 'recommended') {
              return false;
            }
            if (reviewFilterDisplay === 'not_recommended' && review.recommendationStatus !== 'not_recommended') {
              return false;
            }
            // If reviewFilterDisplay is 'all' or undefined, show all reviews
          }
        } else {
          // Filter Google reviews based on minRating setting
          const minRating = widgetSettings.minRating;
          if (minRating && typeof minRating === 'number') {
            const reviewRating = parseFloat(review.rating) || 0;
            if (reviewRating < minRating) {
              return false;
            }
          }
        }
        
        return true;
      });
    },

    injectStyles: function() {
      if (document.getElementById('reviewhub-grid-widget-styles')) return;

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
      style.id = 'reviewhub-grid-widget-styles';
      style.textContent = `
        /* Global styles */
        .reviewhub-grid-widget-container h1,
        .reviewhub-grid-widget-container h2,
        .reviewhub-grid-widget-container h3,
        .reviewhub-grid-widget-container h4,
        .reviewhub-grid-widget-container h5,
        .reviewhub-grid-widget-container h6 {
          margin: 0 !important;
          padding: 0 !important;
          font-weight: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-grid-widget-container p {
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-grid-widget-container button {
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
          cursor: pointer !important;
          margin-top: 10px !important;
        }
        
        .reviewhub-grid-widget-container a {
          color: inherit !important;
          text-decoration: none !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-grid-widget-container i {
          font-style: normal !important;
        }

        .reviewhub-grid-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-grid-widget-container *::before,
        .reviewhub-grid-widget-container *::after,
        .reviewhub-grid-widget-container * {
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
        .reviewhub-grid-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-grid-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #F3F4F6;
          border-top: 3px solid var(--grid-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-grid-spin 0.8s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes rh-grid-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-grid-error {
          padding: 40px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
        }
        .reviewhub-grid-error-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .reviewhub-grid-error-message {
          font-size: 0.9em;
          margin-bottom: 16px;
          opacity: 0.9;
        }
        .reviewhub-grid-retry-button {
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
        .reviewhub-grid-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }

        /* Grid Layout */
        .reviewhub-grid-widget {
          padding: 20px;
          background: transparent;
        }

        .reviewhub-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          width: 100%;
        }

        /* Review Card Styles */
        .rh-grid-review-card {
          background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
          padding: 24px;
          display: flex;
          flex-direction: column;
          border: 1px solid #F1F5F9;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          min-height: 280px;
        }

        .rh-grid-review-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 3px 10px rgba(0, 0, 0, 0.06);
        }

        .rh-grid-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .rh-grid-card-avatar {
          width: 48px;
          height: 48px;
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
        .rh-grid-card-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rh-grid-card-author-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex-grow: 1;
          min-width: 0;
        }

        .rh-grid-card-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        }

        .rh-grid-card-author-name {
          font-weight: 600;
          font-size: 1rem;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
          margin-right: 8px;
        }

        .rh-grid-verified-badge {
          color: #3B82F6;
          font-size: 0.9rem;
        }

        .rh-grid-card-review-meta {
          font-size: 0.85rem;
          color: #6B7280;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .rh-grid-card-rating {
          color: rgb(245, 202, 11);
          font-size: 1rem;
          display: flex;
          gap: 2px;
        }

        /* Facebook recommendation status styles */
        .rh-grid-recommendation-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 12px;
          padding: 4px 0;
        }

        .rh-grid-recommended {
          color: #16A34A;
        }

        .rh-grid-not-recommended {
          color: #DC2626;
        }

        .rh-grid-recommendation-status i {
          font-size: 1rem;
        }

        .rh-grid-source-badge {
          position: absolute;
          bottom: 12px;
          right: 12px;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rh-grid-source-logo {
          width: 24px;
          height: 24px;
        }

        /* Modal styles - similar to badge widget */
        .reviewhub-grid-modal-overlay {
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
        .reviewhub-grid-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .reviewhub-grid-modal {
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
        .reviewhub-grid-modal-overlay.visible .reviewhub-grid-modal {
          transform: scale(1) translateY(0);
        }

        .reviewhub-grid-modal-close {
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
        }

        .reviewhub-grid-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
        }

        .reviewhub-grid-modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #F1F5F9;
        }

        .reviewhub-grid-modal-avatar {
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
        .reviewhub-grid-modal-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reviewhub-grid-modal-author-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .reviewhub-grid-modal-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }

        .reviewhub-grid-modal-author-name {
          font-weight: 600;
          font-size: 1.2rem;
          color: #111827;
          margin: 0;
          margin-right: 8px;
        }

        .reviewhub-grid-modal-verified-badge {
          color: #3B82F6;
          font-size: 1rem;
        }

        .reviewhub-grid-modal-review-meta {
          font-size: 0.9rem;
          color: #6B7280;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 0;
        }

        .reviewhub-grid-modal-rating {
          color: rgb(245, 202, 11);
          font-size: 1.1rem;
          margin-bottom: 0;
          display: flex;
          gap: 2px;
        }

        .reviewhub-grid-modal-content {
          font-size: 1rem;
          line-height: 1.7;
          color: #374151;
          word-wrap: break-word;
        }

        /* Responsive Grid */
        @media (max-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.mobile}px) {
          .reviewhub-grid-container {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          
          .rh-grid-review-card {
            padding: 20px;
            min-height: 240px;
          }
          
          .rh-grid-card-avatar {
            width: 40px;
            height: 40px;
            font-size: 1rem;
          }
          
          .rh-grid-card-author-name {
            font-size: 0.9rem;
          }
          
          .rh-grid-card-content {
            font-size: 0.9rem;
            -webkit-line-clamp: 3;
          }
          
          .reviewhub-grid-modal {
            padding: 24px;
            border-radius: 16px;
          }
          
          .reviewhub-grid-modal-avatar {
            width: 48px;
            height: 48px;
          }
          
          .reviewhub-grid-modal-author-name {
            font-size: 1.1rem;
          }
          
          .reviewhub-grid-modal-content {
            font-size: 0.95rem;
          }
        }

        @media (min-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.mobile + 1}px) and (max-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.tablet}px) {
          .reviewhub-grid-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.tablet + 1}px) and (max-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.desktop}px) {
          .reviewhub-grid-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.desktop + 1}px) and (max-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.wide}px) {
          .reviewhub-grid-container {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: ${CONFIG.GRID_SETTINGS.BREAKPOINTS.wide + 1}px) {
          .reviewhub-grid-container {
            grid-template-columns: repeat(4, 1fr);
          }
          
          .rh-grid-review-card {
            padding: 28px;
          }
          
          .rh-grid-card-avatar {
            width: 52px;
            height: 52px;
          }
          
          .rh-grid-card-author-name {
            font-size: 1.05rem;
          }
          
          .rh-grid-card-content {
            font-size: 1rem;
          }
        }

        .rh-grid-card-content-wrapper {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .rh-grid-card-content {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #374151;
          margin-bottom: 16px;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .rh-grid-read-more {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--grid-theme-color, #3B82F6);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          margin-top: auto;
          transition: color 0.2s ease;
          text-decoration: none;
        }

        .rh-grid-read-more:hover {
          color: var(--grid-theme-color-dark, #2563EB);
          text-decoration: underline;
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
            this.log('error', `Failed to fetch ${url} after ${retries + 1} attempts`, error);
            throw error;
          }
          this.log('warn', `Retrying request to ${url}. Attempt ${attempt} of ${retries}. Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt -1)));
        }
      }
    },

    showError: function(container, error, config, retryCallback) {
      this.log('error', 'Displaying error in grid widget', { error: error.message, config });
      const themeColor = config.themeColor || '#3B82F6';
      container.style.setProperty('--grid-theme-color', themeColor);
      container.style.setProperty('--grid-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--grid-theme-color-light', this.lightenColor(themeColor, 80));

      container.innerHTML = `
        <div class="reviewhub-grid-error">
          <div class="reviewhub-grid-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-grid-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-grid-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-grid-retry-button');
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

    renderWidget: function(container, data, config) {
      this.log('info', 'Rendering grid widget', { data, config });
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
      
      container.style.setProperty('--grid-theme-color', themeColor);
      container.style.setProperty('--grid-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--grid-theme-color-light', this.lightenColor(themeColor, 90));

      if (!filteredReviews || filteredReviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-grid-error"><div class="reviewhub-grid-error-title">No reviews to display.</div><div class="reviewhub-grid-error-message">Check back later or add some reviews!</div></div>';
        return;
      }
      
      const reviewCardsHtml = filteredReviews.map((review, index) => {
        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const isVerified = true;
        const isLongText = content.length > 180;
        
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
            ratingDisplay = `<div class="rh-grid-card-rating">${stars}</div>`;
          }
        }

        return `
          <div class="rh-grid-review-card">
            <div class="rh-grid-source-badge">
              <img src="${reviewPlatformLogo}" alt="${reviewPlatformName}" class="rh-grid-source-logo">
            </div>
            
            <div class="rh-grid-card-header">
              <div class="rh-grid-card-avatar">
                ${profilePicture && widgetSettings.showProfilePictures !== false ? 
                  `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : 
                  `<span>${initials}</span>`
                }
              </div>
              <div class="rh-grid-card-author-details">
                <div class="rh-grid-card-author-line">
                  <h4 class="rh-grid-card-author-name">${author}</h4>
                  ${isVerified ? '<span class="rh-grid-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                </div>
                ${widgetSettings.showDates !== false && date ? `
                  <div class="rh-grid-card-review-meta">
                    ${date}
                  </div>` : ''}
              </div>
            </div>
            
            ${ratingDisplay}
            
            <div class="rh-grid-card-content-wrapper">
              <p class="rh-grid-card-content">${content}</p>
              ${isLongText ? `<button class="rh-grid-read-more" data-review-index="${index}">Read More</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      const gridHtml = `
        <div class="reviewhub-grid-widget">
          <div class="reviewhub-grid-container">
            ${reviewCardsHtml}
          </div>
        </div>
      `;

      container.innerHTML = gridHtml;
      this.attachModalEventListeners(container, filteredReviews, data, config);
    },

    attachModalEventListeners: function(container, reviews, allData, config) {
        container.querySelectorAll('.rh-grid-read-more').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const reviewIndex = parseInt(button.getAttribute('data-review-index'));
                if (!isNaN(reviewIndex) && reviews[reviewIndex]) {
                    this.showReviewModal(reviews[reviewIndex], allData, config);
                }
            });
        });
    },

    showReviewModal: function(review, allData, config) {
        if (document.querySelector('.reviewhub-grid-modal-overlay')) return;

        const { widgetSettings } = allData;
        
        // Detect review source
        const reviewSource = this.detectReviewSource(review, widgetSettings);
        const platformLogo = this.getPlatformLogo(reviewSource);
        const platformName = reviewSource === 'facebook' ? 'Facebook' : 'Google';

        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const displayContent = content.replace(/\n/g, '<br>');
        const isVerified = true;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'reviewhub-grid-modal-overlay';
        
        const showAvatarsSetting = widgetSettings.showProfilePictures !== false;
        const showDatesSetting = widgetSettings.showDates !== false;
        const showRatingsSetting = widgetSettings.showRatings !== false;

        // Generate rating display for modal based on platform
        let modalRatingDisplay = '';
        if (showRatingsSetting) {
          if (reviewSource === 'facebook') {
            modalRatingDisplay = this.generateRecommendationStatus(review);
          } else if (rating > 0) {
            modalRatingDisplay = `<div class="reviewhub-grid-modal-rating">${stars}</div>`;
          }
        }

        const modalHTML = `
            <div class="reviewhub-grid-modal">
                <button class="reviewhub-grid-modal-close" aria-label="Close modal">&times;</button>
                <div class="reviewhub-grid-modal-header">
                    <div class="reviewhub-grid-modal-avatar">
                        ${profilePicture && showAvatarsSetting ? 
                          `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : 
                          `<span>${initials}</span>`
                        }
                    </div>
                    <div class="reviewhub-grid-modal-author-details">
                        <div class="reviewhub-grid-modal-author-line">
                            <h3 class="reviewhub-grid-modal-author-name">${author}</h3>
                            ${isVerified ? '<span class="reviewhub-grid-modal-verified-badge"><i class="rh-fas rh-fa-check-circle"></i></span>' : ''}
                        </div>
                         ${showDatesSetting && date ? `
                           <p class="reviewhub-grid-modal-review-meta">
                             ${date}
                           </p>` : ''}
                         ${modalRatingDisplay}
                    </div>
                </div>
                <div class="reviewhub-grid-modal-content">
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

        modalOverlay.querySelector('.reviewhub-grid-modal-close').addEventListener('click', closeModal);
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
          layout: 'grid',
          ...userConfig 
      };

      this.log('info', 'Initializing grid widget', config);
      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element #${config.containerId} not found.`);
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-grid-widget-container';
          this.showError(errDiv, new Error(`Container #${config.containerId} not found.`), config, null);
          document.body.insertAdjacentElement('beforeend', errDiv);
          return;
        }
      } else if (config._scriptTag) {
          container = document.createElement('div');
          config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
          this.log('info', `No containerId, created one after script tag: ${config._scriptTag.src}`);
      } else {
        this.log('error', 'No containerId provided and cannot infer container. Grid widget will not render.');
        return;
      }
      
      container.className = 'reviewhub-grid-widget-container';
      container.innerHTML = `
        <div class="reviewhub-grid-loading">
          <div class="reviewhub-grid-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      container.style.setProperty('--grid-theme-color', config.themeColor);
      container.style.setProperty('--grid-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--grid-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
          this.showError(container, new Error('Widget ID is missing.'), config, null);
          return;
      }

      const params = new URLSearchParams();
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;
      this.log('info', `Fetching data from: ${apiUrl}`);

      const retryLoad = () => {
        this.log('info', 'Retrying grid widget load', { widgetId: config.widgetId });
        container.innerHTML = '';
        this.initWidget(config); 
      };

      try {
        const data = await this.fetchWithRetry(apiUrl);
        if (data && data.reviews) {
          this.log('info', 'Grid widget data loaded successfully', { widgetId: config.widgetId, reviewCount: data.reviews.length });
          data.widgetSettings = data.widgetSettings || {}; 
          this.renderWidget(container, data, config);
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        this.log('error', 'Failed to load grid widget data', { widgetId: config.widgetId, error: error.message });
        this.showError(container, error, config, retryLoad);
      }
    },

    // Public init method
    init: function(userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;
      
      if (document.readyState === 'loading') {
          window.ReviewHubGrid._pendingInitializations = window.ReviewHubGrid._pendingInitializations || [];
          window.ReviewHubGrid._pendingInitializations.push(config);
      } else {
          this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-grid.js"]');
    window.ReviewHubGrid.log('info', `Found ${scriptTags.length} grid widget script tag(s) for auto-initialization.`);
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'grid',
        _scriptTag: script
      };
      
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubGrid.initWidget(config);
    });
  }
  
  function processPendingInitializations() {
      if (window.ReviewHubGrid._pendingInitializations) {
          window.ReviewHubGrid._pendingInitializations.forEach(config => window.ReviewHubGrid.initWidget(config));
          delete window.ReviewHubGrid._pendingInitializations;
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