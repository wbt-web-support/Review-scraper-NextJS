(function() {
  if (window.ReviewHub && window.ReviewHub.isInitialized) {
    return;
  }
  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget.js"]');
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
      return 'http://localhost:3000/';
    })(),
    
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 10000
  };

  window.ReviewHub = {
    isInitialized: true,
    version: '1.0.2',
    lastUpdated: '2024-12-19T11:00:00Z',
    buildId: Date.now(),
    log: function(level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHub v${this.version}]`;
        if (data) {
          console[level](prefix, message, data);
        } else {
          console[level](prefix, message);
        }
      }
    },

    // Inject enhanced styles with proper scoping
    injectStyles: function() {
      if (document.getElementById('reviewhub-widget-styles')) return;
      
      // Add Font Awesome if not already present
      if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        fontAwesome.crossOrigin = 'anonymous';
        document.head.appendChild(fontAwesome);
      }
      
      const style = document.createElement('style');
      style.id = 'reviewhub-widget-styles';
      style.textContent = `
        .reviewhub-widget-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          line-height: 1.6 !important;
          color: #1f2937 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .reviewhub-widget-container *,
        .reviewhub-widget-container *::before,
        .reviewhub-widget-container *::after {
          box-sizing: border-box !important;
        }
        
        .reviewhub-widget {
          background: #ffffff !important;
          border-radius: 12px !important;
          border: 1px solid #e5e7eb !important;
          overflow: hidden !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          transition: all 0.3s ease !important;
        }
        
        .reviewhub-widget-loading {
          padding: 80px 20px !important;
          text-align: center !important;
          color: #6b7280 !important;
          background: #ffffff !important;
        }
        
        .reviewhub-widget-content {
          padding: 12px !important;
          margin: 0 !important;
          background: #ffffff !important;
        }
        
        /* Header section matching WidgetPreview */
        .reviewhub-widget-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 16px !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
        }
        
        .reviewhub-business-info {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }
        
        .reviewhub-business-icon {
          width: 40px !important;
          height: 40px !important;
          border-radius: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 20px !important;
          flex-shrink: 0 !important;
        }
        
        .reviewhub-business-details h4 {
          font-weight: 600 !important;
          font-size: 16px !important;
          color: #1f2937 !important;
          margin: 0 0 4px 0 !important;
          line-height: 1.4 !important;
        }
        
        .reviewhub-rating-summary {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
        
        .reviewhub-rating-stars {
          color: #f59e0b !important;
          font-size: 12px !important;
          letter-spacing: 1px !important;
        }
        
        .reviewhub-rating-text {
          font-size: 12px !important;
          color: #6b7280 !important;
        }
        
        .reviewhub-business-link {
          font-size: 12px !important;
          color: var(--widget-theme-color, #3B82F6) !important;
          text-decoration: none !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          margin-top: 8px !important;
        }
        
        .reviewhub-business-link:hover {
          text-decoration: underline !important;
        }
        
        /* Layout-specific styles */
        .reviewhub-widget-content.layout-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
          gap: 12px !important;
        }
        
        .reviewhub-widget-content.layout-list {
          display: block !important;
        }
        
        .reviewhub-widget-content.layout-carousel {
          display: flex !important;
          overflow-x: auto !important;
          scroll-snap-type: x mandatory !important;
          gap: 12px !important;
          scrollbar-width: thin !important;
          scrollbar-color: #d1d5db #f9fafb !important;
          padding-bottom: 8px !important;
        }
        
        .reviewhub-widget-content.layout-carousel::-webkit-scrollbar {
          height: 8px !important;
        }
        
        .reviewhub-widget-content.layout-carousel::-webkit-scrollbar-track {
          background: #f9fafb !important;
          border-radius: 4px !important;
        }
        
        .reviewhub-widget-content.layout-carousel::-webkit-scrollbar-thumb {
          background: #d1d5db !important;
          border-radius: 4px !important;
        }
        
        .reviewhub-widget-content.layout-carousel::-webkit-scrollbar-thumb:hover {
          background: #9ca3af !important;
        }
        
        .reviewhub-widget-content.layout-masonry {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
          gap: 12px !important;
        }
        
        .reviewhub-widget-content.layout-badge {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 12px !important;
          padding: 16px !important;
        }
        
        /* Review item styles matching SingleReviewCard */
        .reviewhub-review-item {
          background: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          border: 1px solid #e5e7eb !important;
          padding: 24px !important;
          transition: all 0.3s ease !important;
          position: relative !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
          height: 100% !important;
        }
        
        .layout-grid .reviewhub-review-item {
          min-height: 200px !important;
        }
        
        .layout-carousel .reviewhub-review-item {
          min-width: 320px !important;
          flex-shrink: 0 !important;
          scroll-snap-align: start !important;
        }
        
        .layout-list .reviewhub-review-item {
          margin-bottom: 12px !important;
        }
        
        .layout-list .reviewhub-review-item:last-child {
          margin-bottom: 0 !important;
        }
        
        .layout-badge .reviewhub-review-item {
          min-width: 280px !important;
          flex: 1 !important;
        }
        
        .reviewhub-review-item:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          transform: translateY(-2px) !important;
        }
        
        .reviewhub-review-header {
          display: flex !important;
          align-items: flex-start !important;
          gap: 16px !important;
        }
        
        .reviewhub-review-avatar {
          width: 48px !important;
          height: 48px !important;
          border-radius: 50% !important;
          overflow: hidden !important;
          flex-shrink: 0 !important;
          position: relative !important;
          border: 3px solid #e5e7eb !important;
          transition: all 0.3s ease !important;
        }
        
        .reviewhub-review-avatar:hover {
          transform: scale(1.05) !important;
        }
        
        .reviewhub-review-avatar img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          transition: all 0.3s ease !important;
        }
        
        .reviewhub-avatar-fallback {
          width: 100% !important;
          height: 100% !important;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
          color: white !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-weight: 700 !important;
          font-size: 18px !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
        }
        
        .reviewhub-review-info {
          flex: 1 !important;
          min-width: 0 !important;
        }
        
        .reviewhub-review-author-line {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 8px !important;
        }
        
        .reviewhub-review-author {
          font-weight: 700 !important;
          color: #1f2937 !important;
          font-size: 18px !important;
          margin: 0 !important;
          line-height: 1.4 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        
        .reviewhub-review-rating {
          color: #f59e0b !important;
          font-size: 16px !important;
          letter-spacing: 2px !important;
          margin-bottom: 4px !important;
          line-height: 1 !important;
        }
        
        .reviewhub-review-date {
          color: #6b7280 !important;
          font-size: 14px !important;
          margin-bottom: 4px !important;
          font-weight: 500 !important;
        }
        
        .reviewhub-review-text {
          flex-grow: 1 !important;
        }
        
        .reviewhub-review-content {
          color: #374151 !important;
          line-height: 1.6 !important;
          font-size: 16px !important;
          margin-bottom: 12px !important;
          font-weight: 400 !important;
          text-align: left !important;
        }
        
        .reviewhub-read-more {
          color: var(--widget-theme-color, #3B82F6) !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          padding: 0 !important;
          text-decoration: none !important;
          transition: all 0.2s ease !important;
          outline: none !important;
          font-family: inherit !important;
          margin-left: 0 !important;
          display: inline !important;
        }
        
        .reviewhub-read-more:hover {
          text-decoration: underline !important;
          color: var(--widget-theme-color-dark, #2563eb) !important;
        }
        
        .reviewhub-source-badge {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 28px !important;
          height: 28px !important;
          border-radius: 50% !important;
          background: #f3f4f6 !important;
          flex-shrink: 0 !important;
          border: 2px solid #e5e7eb !important;
          transition: all 0.3s ease !important;
        }
        
        .reviewhub-source-badge:hover {
          transform: scale(1.1) !important;
        }
        
        .reviewhub-source-badge.google {
          background: #ffffff !important;
          border-color: #e5e7eb !important;
        }
        
        .reviewhub-source-badge.facebook {
          background: #1877F2 !important;
          border-color: #1877F2 !important;
        }
        
        .reviewhub-source-badge svg {
          width: 14px !important;
          height: 14px !important;
        }
        
        .reviewhub-widget-error {
          padding: 60px 32px !important;
          text-align: center !important;
          color: #6b7280 !important;
          background: #ffffff !important;
        }
        
        .reviewhub-error-title {
          font-size: 18px !important;
          font-weight: 600 !important;
          margin-bottom: 12px !important;
          color: #374151 !important;
        }
        
        .reviewhub-error-details {
          font-size: 14px !important;
          margin-bottom: 20px !important;
          line-height: 1.5 !important;
        }
        
        .reviewhub-spinner {
          width: 40px !important;
          height: 40px !important;
          border: 4px solid #f3f4f6 !important;
          border-top: 4px solid var(--widget-theme-color, #3B82F6) !important;
          border-radius: 50% !important;
          animation: reviewhub-spin 1s linear infinite !important;
          margin: 0 auto 24px !important;
        }
        
        .reviewhub-retry-button {
          background: var(--widget-theme-color, #3B82F6) !important;
          color: white !important;
          border: none !important;
          padding: 12px 24px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          margin-top: 16px !important;
          transition: all 0.3s ease !important;
          font-family: inherit !important;
          outline: none !important;
        }
        
        .reviewhub-retry-button:hover {
          background: #2563eb !important;
          transform: translateY(-1px) !important;
        }
        
        @keyframes reviewhub-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .reviewhub-widget {
            border-radius: 8px !important;
            margin: 0 4px !important;
          }
          
          .reviewhub-widget-content.layout-grid {
            grid-template-columns: 1fr !important;
          }
          
          .layout-carousel .reviewhub-review-item {
            min-width: 280px !important;
          }
          
          .reviewhub-review-item {
            padding: 20px !important;
          }
          
          .reviewhub-review-header {
            gap: 12px !important;
          }
          
          .reviewhub-review-avatar {
            width: 40px !important;
            height: 40px !important;
          }
          
          .reviewhub-avatar-fallback {
            font-size: 16px !important;
          }
          
          .reviewhub-review-author {
            font-size: 16px !important;
          }
          
          .reviewhub-review-content {
            font-size: 15px !important;
          }
          
          .reviewhub-source-badge {
            width: 24px !important;
            height: 24px !important;
          }
          
          .reviewhub-source-badge svg {
            width: 12px !important;
            height: 12px !important;
          }
          
          .reviewhub-business-info {
            gap: 8px !important;
          }
          
          .reviewhub-business-icon {
            width: 32px !important;
            height: 32px !important;
            font-size: 16px !important;
          }
          
          .reviewhub-business-details h4 {
            font-size: 14px !important;
          }
          
          .reviewhub-rating-text {
            font-size: 11px !important;
          }
        }
        
        @media (max-width: 480px) {
          .layout-carousel .reviewhub-review-item {
            min-width: 260px !important;
          }
          
          .layout-badge .reviewhub-review-item {
            min-width: 240px !important;
          }
          
          .reviewhub-review-item {
            padding: 16px !important;
          }
          
          .reviewhub-review-avatar {
            width: 36px !important;
            height: 36px !important;
          }
          
          .reviewhub-avatar-fallback {
            font-size: 14px !important;
          }
          
          .reviewhub-review-author {
            font-size: 15px !important;
          }
          
          .reviewhub-review-content {
            font-size: 14px !important;
          }
        }
        
        /* Modal styles */
        .reviewhub-modal-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: 10000 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
        }
        
        .reviewhub-modal {
          background: white !important;
          border-radius: 12px !important;
          max-width: 500px !important;
          width: 100% !important;
          max-height: 80vh !important;
          overflow-y: auto !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          position: relative !important;
        }
        
        .reviewhub-modal-header {
          padding: 24px 24px 0 24px !important;
          border-bottom: 1px solid #e5e7eb !important;
          margin-bottom: 24px !important;
        }
        
        .reviewhub-modal-close {
          position: absolute !important;
          top: 16px !important;
          right: 16px !important;
          background: none !important;
          border: none !important;
          font-size: 24px !important;
          cursor: pointer !important;
          color: #6b7280 !important;
          padding: 4px !important;
          border-radius: 4px !important;
          transition: all 0.2s ease !important;
        }
        
        .reviewhub-modal-close:hover {
          background: #f3f4f6 !important;
          color: #374151 !important;
        }
        
        .reviewhub-modal-content {
          padding: 0 24px 24px 24px !important;
        }
        
        .reviewhub-modal .reviewhub-review-item {
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-modal .reviewhub-review-content {
          font-size: 16px !important;
          line-height: 1.6 !important;
          white-space: pre-wrap !important;
        }
      `;
      document.head.appendChild(style);
    },
    
    // Enhanced star generation with proper Unicode stars
    generateStars: function(rating) {
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;
      let stars = '';
      
      // Use filled stars (★) and empty stars (☆)
      for (let i = 0; i < fullStars; i++) {
        stars += '★';
      }
      if (hasHalfStar) {
        stars += '☆'; // Half star representation
      }
      for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
        stars += '☆';
      }
      
      return stars;
    },
    
    // Enhanced date formatting with better relative dates
    formatDate: function(dateString) {
      try {
        // Handle relative date strings like "15 hours ago", "3 days ago", etc.
        if (typeof dateString === 'string' && dateString.includes('ago')) {
          return dateString; // Return as-is since it's already formatted
        }
        
        const date = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          return dateString || 'Recently'; // Return original string or fallback
        }
        
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);
        
        if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
        if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffWeeks === 1) return '1 week ago';
        if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
        if (diffMonths === 1) return '1 month ago';
        if (diffMonths < 12) return `${diffMonths} months ago`;
        if (diffYears === 1) return '1 year ago';
        return `${diffYears} years ago`;
        
      } catch (e) {
        return dateString || 'Recently'; // Return original or fallback
      }
    },
    
    // Get initials with better handling
    getInitials: function(name) {
      if (!name) return '?';
      const words = name.trim().split(' ').filter(word => word.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    },
    
    // Enhanced widget rendering with proper event handling
    renderWidget: function(container, widgetData, config) {
      const { widgetSettings, reviews, businessName, businessUrlLink } = widgetData;
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';
      const themeColorDark = this.darkenColor(themeColor, 20);
      
      // Set CSS custom properties on the container
      container.style.setProperty('--widget-theme-color', themeColor);
      container.style.setProperty('--widget-theme-color-dark', themeColorDark);
      
      // Generate reviews HTML
      const reviewsHtml = reviews.map((review, index) => {
        const authorInitials = this.getInitials(review.author);
        const ratingStars = review.rating ? this.generateStars(review.rating) : '';
        const reviewDate = review.postedAt ? this.formatDate(review.postedAt) : '';
        const sourceClass = review.source === 'google' ? 'google' : 'facebook';
        const reviewText = review.content || review.text || '';
        const isLongText = reviewText.length > 180;
        const truncatedText = isLongText ? reviewText.substring(0, 180) + '...' : reviewText;
        
        // Source logo SVGs
        const googleLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>`;
        
        const facebookLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>`;
        
        return `
          <div class="reviewhub-review-item" data-review-index="${index}">
            <div class="reviewhub-review-header">
              <div class="reviewhub-review-avatar">
                ${review.profilePicture && widgetSettings.showProfilePictures ? 
                  `<img src="${review.profilePicture}" alt="${this.escapeHtml(review.author)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="reviewhub-avatar-fallback" style="display:none;">${authorInitials}</div>` :
                  `<div class="reviewhub-avatar-fallback">${authorInitials}</div>`
                }
              </div>
              <div class="reviewhub-review-info">
                <div class="reviewhub-review-author-line">
                  <span class="reviewhub-review-author">${this.escapeHtml(review.author || 'Anonymous')}</span>
                  <div class="reviewhub-source-badge ${sourceClass}">
                    ${review.source === 'google' ? googleLogo : facebookLogo}
                  </div>
                </div>
                ${widgetSettings.showRatings && ratingStars ? `
                  <div class="reviewhub-review-rating">${ratingStars}</div>
                ` : ''}
                ${widgetSettings.showDates && reviewDate ? `
                  <div class="reviewhub-review-date">${reviewDate}</div>
                ` : ''}
              </div>
            </div>
            ${reviewText ? `
              <div class="reviewhub-review-text">
                <div class="reviewhub-review-content">
                  ${this.escapeHtml(isLongText ? truncatedText : reviewText)}
                  ${isLongText ? `<span class="reviewhub-read-more" data-review-index="${index}">Read more</span>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      
      const widgetHtml = `
        <div class="reviewhub-widget">
          <div class="reviewhub-widget-content layout-${widgetSettings.layout || 'grid'}">
            ${reviewsHtml || '<div class="reviewhub-widget-error"><div class="reviewhub-error-title">No reviews available</div></div>'}
          </div>
        </div>
      `;
      
      container.innerHTML = widgetHtml;
      
      // Add event listeners for read more buttons
      this.attachEventListeners(container, reviews);
    },
    
    // Attach event listeners for read more functionality
    attachEventListeners: function(container, reviews) {
      const readMoreButtons = container.querySelectorAll('.reviewhub-read-more');
      
      readMoreButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const reviewIndex = button.getAttribute('data-review-index');
          this.showReviewModal(reviews[reviewIndex]);
        });
      });
    },
    
    // Show review modal with full text
    showReviewModal: function(review) {
      const reviewText = review.content || review.text || '';
      const authorInitials = this.getInitials(review.author);
      const ratingStars = review.rating ? this.generateStars(review.rating) : '';
      const reviewDate = review.postedAt ? this.formatDate(review.postedAt) : '';
      const sourceClass = review.source === 'google' ? 'google' : 'facebook';
      
      // Source logo SVGs
      const googleLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>`;
      
      const facebookLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>`;
      
      const modalHtml = `
        <div class="reviewhub-modal-overlay">
          <div class="reviewhub-modal">
            <button class="reviewhub-modal-close">&times;</button>
            <div class="reviewhub-modal-header">
              <div class="reviewhub-review-item">
                <div class="reviewhub-review-header">
                  <div class="reviewhub-review-avatar">
                    ${review.profilePicture ? 
                      `<img src="${review.profilePicture}" alt="${this.escapeHtml(review.author)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="reviewhub-avatar-fallback" style="display:none;">${authorInitials}</div>` :
                      `<div class="reviewhub-avatar-fallback">${authorInitials}</div>`
                    }
                  </div>
                  <div class="reviewhub-review-info">
                    <div class="reviewhub-review-author-line">
                      <span class="reviewhub-review-author">${this.escapeHtml(review.author || 'Anonymous')}</span>
                      <div class="reviewhub-source-badge ${sourceClass}">
                        ${review.source === 'google' ? googleLogo : facebookLogo}
                      </div>
                    </div>
                    ${ratingStars ? `<div class="reviewhub-review-rating">${ratingStars}</div>` : ''}
                    ${reviewDate ? `<div class="reviewhub-review-date">${reviewDate}</div>` : ''}
                  </div>
                </div>
              </div>
            </div>
            <div class="reviewhub-modal-content">
              <div class="reviewhub-review-content">${this.escapeHtml(reviewText)}</div>
            </div>
          </div>
        </div>
      `;
      
      // Create modal element
      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement);
      
      // Add event listeners
      const overlay = modalElement.querySelector('.reviewhub-modal-overlay');
      const closeButton = modalElement.querySelector('.reviewhub-modal-close');
      const modal = modalElement.querySelector('.reviewhub-modal');
      
      const closeModal = () => {
        document.body.removeChild(modalElement);
      };
      
      closeButton.addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      });
      
      // Close on escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    },
    
    // Utility function to darken colors
    darkenColor: function(color, percent) {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) - amt;
      const G = (num >> 8 & 0x00FF) - amt;
      const B = (num & 0x0000FF) - amt;
      return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    },
    
    // HTML escape function
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    // Enhanced fetch with retry logic
    fetchWithRetry: function(url, options, retries = CONFIG.RETRY_ATTEMPTS) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, CONFIG.TIMEOUT);
        
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
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(resolve)
        .catch(error => {
          clearTimeout(timeoutId);
          if (retries > 0) {
            this.log('warn', `Retrying request to ${url}. Attempts left: ${retries - 1}`, error);
            setTimeout(() => {
              this.fetchWithRetry(url, options, retries - 1).then(resolve).catch(reject);
            }, CONFIG.RETRY_DELAY);
          } else {
            reject(error);
          }
        });
      });
    },
    
    // Show error with retry option
    showError: function(container, error, config, retryCallback) {
      const errorHtml = `
        <div class="reviewhub-widget">
          <div class="reviewhub-widget-error">
            <div class="reviewhub-error-title">⚠️ Unable to load reviews</div>
            <div class="reviewhub-error-details">${this.escapeHtml(error.message)}</div>
            ${retryCallback ? '<button class="reviewhub-retry-button">Try Again</button>' : ''}
          </div>
        </div>
      `;
      
      container.innerHTML = errorHtml;
      
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-retry-button');
        if (retryButton) {
          retryButton.addEventListener('click', retryCallback);
        }
      }
    },
    
    // Main widget initialization function
    initWidget: function(config) {
      let container = null;
      
      this.log('info', 'Initializing widget', config);
      
      // Inject styles first
      this.injectStyles();
      
      // Find or create container
      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element not found: ${config.containerId}`);
          return;
        }
      } else {
        // Auto-create container after the script tag
        const scripts = document.querySelectorAll(`script[data-widget-id="${config.widgetId}"]`);
        const scriptTag = scripts[scripts.length - 1];
        
        if (scriptTag) {
          container = document.createElement('div');
          container.id = `reviewhub-widget-${config.widgetId}`;
          scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
        } else {
          this.log('error', `Script tag not found for widget: ${config.widgetId}`);
          return;
        }
      }

      // Add the container class for proper styling
      container.className = 'reviewhub-widget-container';

      // Show loading state
      container.innerHTML = `
        <div class="reviewhub-widget" style="--widget-theme-color: ${config.themeColor || '#3B82F6'}; --widget-theme-color-dark: ${this.darkenColor(config.themeColor || '#3B82F6', 20)}">
          <div class="reviewhub-widget-loading">
            <div class="reviewhub-spinner"></div>
            <div>Loading reviews...</div>
          </div>
        </div>
      `;

      // Build API URL
      const params = new URLSearchParams();
      if (config.themeColor) params.append('themeColor', config.themeColor);
      if (config.layout) params.append('layout', config.layout);
      
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;

      // Create retry function
      const retryLoad = () => {
        this.log('info', 'Retrying widget load', { widgetId: config.widgetId });
        this.initWidget(config);
      };

      // Fetch widget data with retry logic
      this.fetchWithRetry(apiUrl)
        .then(data => {
          this.log('info', 'Widget data loaded successfully', { widgetId: config.widgetId, reviewCount: data.reviews?.length });
          this.renderWidget(container, data, config);
        })
        .catch(error => {
          this.log('error', 'Failed to load widget data', { widgetId: config.widgetId, error: error.message });
          this.showError(container, error, config, retryLoad);
        });
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id]');
    window.ReviewHub.log('info', `Found ${scriptTags.length} widget script(s)`);
    
    scriptTags.forEach(function(script) {
      const widgetId = script.getAttribute('data-widget-id');
      const themeColor = script.getAttribute('data-theme-color');
      const layout = script.getAttribute('data-layout');
      const name = script.getAttribute('data-name');
      
      if (widgetId) {
        const config = {
          widgetId: widgetId,
          name: name,
          themeColor: themeColor,
          layout: layout
        };
        
        window.ReviewHub.initWidget(config);
      }
    });
  }

  // Initialize widgets when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidgetsFromScripts);
  } else {
    // DOM is already ready
    setTimeout(initializeWidgetsFromScripts, 0);
  }

  // Handle any pending widgets (for async loading)
  if (window.ReviewHubPendingWidgets && Array.isArray(window.ReviewHubPendingWidgets)) {
    window.ReviewHubPendingWidgets.forEach(function(pendingConfig) {
      window.ReviewHub.initWidget(pendingConfig);
    });
    window.ReviewHubPendingWidgets = [];
  }

  // Global API for manual widget initialization
  window.ReviewHub.init = function(config) {
    if (typeof config === 'string') {
      // Simple widget ID
      this.initWidget({ widgetId: config });
    } else {
      // Full config object
      this.initWidget(config);
    }
  };

})();