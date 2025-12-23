(function () {
  if (window.ReviewHub && window.ReviewHub.isInitialized) {
    return;
  }
  const CONFIG = {
    API_DOMAIN: (function () {
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
      return 'https://reviews.webuildtrades.com/';
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
    log: function (level, message, data) {
      // Console logging disabled for production
    },
    injectStyles: function () {
      if (document.getElementById('reviewhub-widget-styles')) return;
      if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Roboto"]')) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect1);
        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect2);
        const robotoFont = document.createElement('link');
        robotoFont.rel = 'stylesheet';
        robotoFont.href = 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap';
        document.head.appendChild(robotoFont);
      }

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

      i {
            font-style: normal !important;
        }


        .reviewhub-widget-container h1,
        .reviewhub-widget-container h2,
        .reviewhub-widget-container h3,
        .reviewhub-widget-container h4,
        .reviewhub-widget-container h5,
        .reviewhub-widget-container h6 {
          margin: 0 !important;
          padding: 0 !important;
          font-weight: inherit !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-widget-container p {
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
          color: inherit !important;
        }
        
        .reviewhub-widget-container button {
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
        
        .reviewhub-widget-container a {
          color: inherit !important;
          text-decoration: none !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .reviewhub-widget-container i {
          font-style: normal !important;
        }
        
        .reviewhub-widget-container {
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
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
        
        .reviewhub-widget-content.layout-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
          gap: 12px !important;
          background: transparent !important;
        }
        
        .reviewhub-grid-container {
          background: transparent !important;
        }
        
        .reviewhub-widget-content.layout-list {
          display: block !important;
        }
        
        .reviewhub-widget-content.layout-carousel {
          display: block !important;
          width: 100% !important;
          padding: 0 !important;
          position: relative !important;
          background: transparent !important;
        }
        
        .reviewhub-carousel-container {
          position: relative !important;
          width: 100% !important;
          overflow: hidden !important;
          padding: 0 50px !important;
          box-sizing: border-box !important;
          background: transparent !important;
        }
        
        .reviewhub-carousel-dots {
          display: none !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 8px !important;
          margin-top: 16px !important;
          padding: 0 !important;
          list-style: none !important;
        }
        
        .reviewhub-carousel-dot {
          width: 8px !important;
          height: 8px !important;
          border-radius: 50% !important;
          background: #e5e7eb !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          padding: 0 !important;
          border: none !important;
        }
        
        .reviewhub-carousel-dot.active {
          background: var(--widget-theme-color, #3B82F6) !important;
          transform: scale(1.2) !important;
        }
        
        .reviewhub-widget-content.layout-masonry {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
          gap: 12px !important;
          background: transparent !important;
        }
        
        .reviewhub-masonry-container {
          background: transparent !important;
        }
        
        .reviewhub-widget-content.layout-badge {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 12px !important;
          padding: 16px !important;
        }
        
        .reviewhub-review-item {
          background: #ffffff !important;
          border-radius: 12px !important;
          border: 1px solid #e5e7eb !important;
          padding: 24px !important;
          transition: all 0.3s ease !important;
          position: relative !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
        }
        
        .layout-grid .reviewhub-review-item {
          min-height: 200px !important;
        }
        
        .layout-carousel .reviewhub-review-item {
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
          text-transform: capitalize !important;
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
          display: flex !important; /* Added for flex context */
          flex-direction: column !important; /* Ensure content flows top-to-bottom */
          justify-content: space-between; /* Pushes content to top, read more to bottom if present */
          min-height: 50px; /* Ensure a minimum height for very short reviews */
        }
        
        .reviewhub-review-content {
    color: #374151 !important;
    line-height: 1.6 !important;
    font-size: 16px !important;
    margin-bottom: 12px !important;
    font-weight: 400 !important;
    text-align: left !important;
    display: flex;
    flex-direction: column;
    gap: 5px;
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
        
        .reviewhub-modal-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: 10000 !important;
          display: flex !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          padding: 0 !important;
          
        }
        
        .reviewhub-modal {
          background: white !important;
          border-radius: 0 !important;
          width: 100% !important;
          max-width: 420px !important;
          height: 100vh !important;
          overflow-y: auto !important;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.2) !important;
          position: relative !important;
          font-family: "Roboto", -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
          transform: translateX(0) !important;
          transition: transform 0.3s ease-in-out !important;
          height: auto !important;
        }
        
        .reviewhub-modal.closing {
          transform: translateX(-100%) !important;
        }
        
        .reviewhub-modal-header {
          padding: 24px 48px 0 24px !important;
          border-bottom: 1px solid #e5e7eb !important;
          margin-bottom: 24px !important;
          position: sticky !important;
          top: 0 !important;
          background: white !important;
          z-index: 1 !important;
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
          font-family: inherit !important;
        }
        
        .reviewhub-modal .reviewhub-review-content {
          font-size: 16px !important;
          line-height: 1.6 !important;
          white-space: pre-wrap !important;
          font-family: inherit !important;
        }
        
        .reviewhub-carousel-viewport {
          overflow: hidden !important;
          width: 100% !important;
          position: relative !important;
          border-radius: 12px !important;
        }
        
        .reviewhub-carousel-track {
          display: flex !important;
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
          will-change: transform !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 !important;
          transform-origin: left center !important;
          gap: 16px !important;
          cursor: grab !important;
        }
        
        .reviewhub-carousel-track:active {
          cursor: grabbing !important;
        }
        
        .layout-carousel .reviewhub-review-item {
          flex: 0 0 auto !important;
          /* width and min-height will be set by JS or more specific media queries */
          height: auto !important; /* Allow JS to control height */
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          scroll-snap-align: start !important;
          user-select: none !important;
        }
        
        @media (min-width: 576px) {
          .layout-carousel .reviewhub-review-item {
            width: 300px !important;
            /* min-height: 300px !important; */ /* Removed */
          }
        }
        
        @media (min-width: 768px) {
          .layout-carousel .reviewhub-review-item {
            width: 320px !important;
            /* min-height: 320px !important; */ /* Removed */
          }
        }
        
        @media (min-width: 992px) {
          .layout-carousel .reviewhub-review-item {
            width: 340px !important;
            /* min-height: 340px !important; */ /* Removed */
          }
        }
        
        @media (min-width: 1200px) {
          .layout-carousel .reviewhub-review-item {
            width: 350px !important;
            /* min-height: 360px !important; */ /* Removed */
          }
        }
        
        @media (max-width: 767px) {
          .reviewhub-carousel-container {
            padding: 0 0px !important;
          }
          
          .reviewhub-carousel-viewport {
            width: 100% !important;
            overflow: hidden !important;
          }
          
          .reviewhub-carousel-track {
            gap: 12px !important;
          }
          
          .layout-carousel .reviewhub-review-item {
            width: calc(100vw - 80px) !important;
            max-width: 320px !important;
            min-width: 280px !important;
            /* min-height: 280px !important; */ /* Removed */
          }
           /* Show dots and hide arrows on mobile by default, JS will manage visibility if enough items */
          .reviewhub-carousel-prev, 
          .reviewhub-carousel-next {
            display: none !important; 
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          .reviewhub-carousel-dots {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            margin-top: 12px !important;
          }
          .reviewhub-carousel-dot {
            width: 6px !important;
            height: 6px !important;
          }
        }
        
        .reviewhub-carousel-prev, .reviewhub-carousel-next {
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 40px !important;
          height: 40px !important;
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid #e0e0e0 !important;
          border-radius: 50% !important;
          color: #333 !important;
          font-size: 18px !important; /* Adjusted for better icon visibility */
          cursor: pointer !important;
          z-index: 10 !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
          transition: all 0.25s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          user-select: none !important;
          padding: 0 !important; /* Ensure no extra padding interferes with centering */
          backdrop-filter: blur(3px) !important;
        }
        
        .reviewhub-carousel-prev:hover:not([disabled]), .reviewhub-carousel-next:hover:not([disabled]) {
          background: var(--widget-theme-color, #3B82F6) !important;
          color: #fff !important;
          border-color: var(--widget-theme-color, #3B82F6) !important;
          transform: translateY(-50%) scale(1.08) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        
        .reviewhub-carousel-prev[disabled], .reviewhub-carousel-next[disabled] {
          opacity: 0.4 !important;
          cursor: not-allowed !important;
          /* pointer-events: none; /* Already managed by JS logic effectively */
        }
        
        .reviewhub-carousel-prev {
          left: 10px !important; /* Slightly more space from edge */
        }
        
        .reviewhub-carousel-next {
          right: 10px !important; /* Slightly more space from edge */
        }
        
        @media (max-width: 575px) {
          .reviewhub-carousel-container {
            padding: 0 0px !important;
          }
          
          .reviewhub-carousel-prev, .reviewhub-carousel-next {
            width: 36px !important;
            height: 36px !importanT;
            font-size: 14px !important;
          }
          
          .reviewhub-carousel-prev {
            left: 8px !important;
          }
          
          .reviewhub-carousel-next {
            right: 8px !important;
          }
          
          .layout-carousel .reviewhub-review-item {
            width: calc(100vw - 120px) !important;
            max-width: 300px !important;
            min-width: 260px !important;
            /* min-height: 260px !important; */ /* Removed */
          }
        }
        
        @media (max-width: 319px) {
          .layout-carousel .reviewhub-review-item {
            width: calc(100vw - 100px) !important;
            min-width: calc(100vw - 100px) !important;
            max-width: 240px !important;
            /* min-height: 240px !important; */ /* Removed */
          }
          .reviewhub-carousel-container {
            padding: 0 0px !important;
          }
          .reviewhub-carousel-prev, .reviewhub-carousel-next {
            width: 32px !important;
            height: 32px !important;
            font-size: 12px !important;
          }
          .reviewhub-carousel-prev {
            left: 6px !important;
          }
          .reviewhub-carousel-next {
            right: 6px !important;
          }
        }
        
        /* Restart Card Styles */
        .reviewhub-carousel-restart-card {
          flex: 0 0 auto !important;
          width: 120px !important;
          max-width: 120px !important;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
          border: 2px dashed #cbd5e1 !important;
          border-radius: 12px !important;
          padding: 12px 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          min-height: 80px !important;
          box-sizing: border-box !important;
          transition: all 0.3s ease !important;
          position: relative !important;
          overflow: hidden !important;
        }
        
    
        .reviewhub-restart-content {
          position: relative !important;
          z-index: 2 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 0px !important;
          height: 100% !important;
        }
    
          
        .reviewhub-restart-title {
          font-size: 20px !important;
          font-weight: 700 !important;
          color: #1f2937 !important;
          margin: 0 !important;
          line-height: 1.3 !important;
        }
        
        .reviewhub-restart-subtitle {
          font-size: 12px !important;
          color: #6b7280 !important;
          margin: 0 !important;
          line-height: 1.2 !important;
        }
        
        .reviewhub-restart-button {
            color: #1f2937;
            border: none !important;
            background: transparent !important;
            border-radius: 16px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            height: 100%;
            transition: all 0.3s ease !important;
            font-family: inherit !important;
            outline: none !important;
        }
                
        .reviewhub-restart-button:hover {
            background: transparent !important;
            transform: translateY(-1px) !important;
            box-shadow: none !important;
        }
        
       
        @keyframes reviewhub-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        /* Mobile specific styles for restart card */
        @media (max-width: 767px) {
          .reviewhub-carousel-restart-card {
            width: 50px !important;
            max-width: 50px !important;
            min-width: 50px !important;
            min-height: 50px !important;
            padding: 8px 6px !important;
          }
          
          .reviewhub-restart-title {
            font-size: 16px !important;
          }
          
          .reviewhub-restart-subtitle {
            font-size: 11px !important;
          }
          
          .reviewhub-restart-button {
            font-size: 12px !important;
            padding: 5px 10px !important;
            min-width: 70px !important;
          }
        }
        
        @media (max-width: 575px) {
       .reviewhub-carousel-restart-card {
            width: 50px !important;
            max-width: 50px !important;
            min-width: 50px !important;
            min-height: 50px !important;
            padding: 6px 4px !important;
        }
        }
        
        @media (max-width: 319px) {
          .reviewhub-carousel-restart-card {
            width: 50px !important;
            min-width: 50px !important;
            max-width: 50px !important;
            min-height: 50px !important;
            padding: 6px 4px !important;
          }
        }
      `;
      document.head.appendChild(style);
    },
    generateStars: function (rating) {
      const fullStars = Math.floor(rating);
      const decimal = rating % 1;
      const hasHalfStar = decimal >= 0.3 && decimal < 0.8;
      const shouldRoundUp = decimal >= 0.8;

      let stars = '';

      const totalFullStars = shouldRoundUp ? fullStars + 1 : fullStars;
      for (let i = 0; i < totalFullStars; i++) {
        stars += '★';
      }

      if (hasHalfStar && !shouldRoundUp) {
        stars += '★';
      }

      const starsUsed = totalFullStars + (hasHalfStar && !shouldRoundUp ? 1 : 0);
      for (let i = starsUsed; i < 5; i++) {
        stars += '☆';
      }

      return stars;
    },

    formatDate: function (dateString) {
      try {
        if (typeof dateString === 'string' && dateString.includes('ago')) {
          return dateString;
        }

        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return dateString || 'Recently';
        }

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
    getInitials: function (name) {
      if (!name) return '?';
      const words = name.trim().split(' ').filter(word => word.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    },
    renderWidget: function (container, widgetData, config) {

      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = widgetData;
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';
      const themeColorDark = this.darkenColor(themeColor, 20);
      container.style.setProperty('--widget-theme-color', themeColor);
      container.style.setProperty('--widget-theme-color-dark', themeColorDark);
      if (widgetSettings.layout === 'badge') {
        const googleLogoUrl = 'https://assetsforscraper.b-cdn.net/Google-logo.png';

        let avgRating, reviewCount;
        if (widgetData.averageRating) {
          avgRating = widgetData.averageRating;
          if (typeof avgRating === 'string' && !avgRating.includes('%') && widgetSettings.businessUrl?.source !== 'facebook') {
            // Ensure it has one decimal if it's a star rating
            avgRating = parseFloat(avgRating).toFixed(1);
          }
        } else {
          // Fallback
          avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : '5.0';
        }
        // ALWAYS use totalReviewCount from the API response to show the full "200 reviews" count
        reviewCount = (typeof totalReviewCount === 'number') ? totalReviewCount : reviews.length;

        const reviewText = reviewCount === 1 ? 'Review' : 'Reviews';
        let reviewUrl;
        if (businessUrlLink) {
          reviewUrl = businessUrlLink;
        } else if (widgetSettings.businessUrl?.url) {
          reviewUrl = widgetSettings.businessUrl.url;
        } else if (businessName) {
          reviewUrl = `https://www.google.com/maps/search/${encodeURIComponent(businessName)}+reviews`;
        } else {
          reviewUrl = 'https://www.google.com/maps';
        }

        let writeReviewUrl;
        if (businessUrlLink) {
          writeReviewUrl = businessUrlLink;
        } else if (widgetSettings.businessUrl?.url) {
          writeReviewUrl = widgetSettings.businessUrl.url;
        } else if (businessName) {
          writeReviewUrl = `https://www.google.com/search?q=${encodeURIComponent(businessName)}+google+reviews`;
        } else {
          writeReviewUrl = 'https://www.google.com/maps';
        }


        container.innerHTML = `
          <div class="reviewhub-widget">
            <div style="
              background: #fff;
              border-radius: 16px;
              box-shadow: 0px 0px 6px #00000040;
              margin: 10px;
              padding: 15px;
              display: flex;
              flex-direction: column;
              align-items: center;
              border: none;
              min-width: 210px;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            ">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <img src="${googleLogoUrl}" alt="Google" style="width: 28px; height: 28px;" />
                <span style="font-weight: 600; font-size: 1.08rem; color: #222;">Google Reviews</span>
              </div>
              <div style="width: 100%; height: 1px; background: #f0f0f0; margin: 8px 0 10px 0;"></div>
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
                <span style="font-size: 1.3rem; font-weight: 700; color: #222; margin-right: 7px;">${avgRating}</span>
                <span style="color: #fbbf24; font-size: 1.6rem; letter-spacing: 1px;">${window.ReviewHub.generateStars(parseFloat(avgRating))}</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 8px;">
                <span class="reviewhub-badge-modal-btn" style="
                  color: #6b7280;
                  text-decoration: underline;
                  font-size: 0.78rem;
                  font-weight: 400;
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 0;
                  display: inline-block;
                ">Read our ${reviewCount} ${reviewText}</span>
              </div>
            </div>
          </div>
          <div class="reviewhub-badge-modal-overlay" style="display:none;"></div>
        `;
        const modalBtn = container.querySelector('.reviewhub-badge-modal-btn');
        const overlay = container.querySelector('.reviewhub-badge-modal-overlay');
        if (modalBtn && overlay) {
          modalBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const bodyOverlay = document.createElement('div');
            bodyOverlay.className = 'reviewhub-badge-modal-overlay';
            bodyOverlay.style.position = 'fixed';
            bodyOverlay.style.inset = '0';
            bodyOverlay.style.background = 'rgba(0,0,0,0.45)';
            bodyOverlay.style.zIndex = '99999';
            bodyOverlay.style.display = 'flex';
            bodyOverlay.style.alignItems = 'stretch';
            bodyOverlay.style.justifyContent = 'flex-start';
            bodyOverlay.innerHTML = `
                <div class="reviewhub-badge-modal-panel" style="
                  background: #fff;
                  border-radius: 0 16px 16px 0;
                  max-width: 420px;
                  width: 100%;
                  height: 100vh;
                  overflow-y: auto;
                  box-shadow: 4px 0 32px rgba(0,0,0,0.18);
                  position: relative;
                  padding: 32px 24px;
                  transform: translateX(-100%);
                  transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
                  display: flex;
                  flex-direction: column;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                ">
                  <button class="reviewhub-badge-modal-close" style="position: absolute; top: -13px; right: 0px; background: none; border: none; font-size: 2rem; color: #888; cursor: pointer;">&times;</button>
                  <h2 style="font-size: 1.3rem; font-weight: bold; margin-bottom: 39px;">What our customers say</h2>
                  <div style="background: #f9fafb; border-radius: 10px; padding: 16px; margin-bottom: 18px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; margin-bottom: 6px;">
                      <img src="${googleLogoUrl}" alt="Google" style="width: 24px; height: 24px; margin-right: 8px;" />
                      <span style="font-weight: 600; font-size: 1.1rem;">Google Reviews</span>
                    </div>
                    <div style="display: flex; align-items: center;">
                      <span style="font-size: 1.1rem; font-weight: bold; margin-right: 6px;">${avgRating}</span>
                      <span style="color: #f59e0b; font-size: 1.1rem; letter-spacing: 2px;">${window.ReviewHub.generateStars(parseFloat(avgRating))}</span>
                      <span style="margin-left: 8px; color: #888; font-size: 0.95rem;">(${reviewCount})</span>
                    </div>
                    <a href="${reviewUrl}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       style="
                         display: inline-block;
                         margin-bottom: 12px;
                         padding: 8px 18px;
                         background: #2563eb;
                         color: #fff;
                         border-radius: 8px;
                         font-weight: 600;
                         font-size: 1rem;
                         text-decoration: none;
                         transition: background 0.2s ease-in-out;
                         text-align: center;
                         width: 90%;
                       "
                       onmouseover="this.style.background='#1d4ed8'"
                       onmouseout="this.style.background='#2563eb'">
                      Review us on Google
                    </a>
                  </div>
                  <div class="reviewhub-badge-modal-reviews-container" style="max-height: 70vh; overflow-y: auto;">
                    ${reviews.map((r) => {
              const formattedDate = window.ReviewHub.formatDate(r.postedAt);
              return `
                      <div class="reviewhub-badge-modal-review-item" style="background: #fff; border-radius: 10px; padding: 14px 12px; border: 1px solid #f3f4f6; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                        <div style="display: flex; align-items: center; margin-bottom: 6px;">
                          <img src="${r.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.author)}" alt="${r.author}" style="width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; border: 1.5px solid #e5e7eb; object-fit: cover;" />
                          <div>
                            <div style="font-weight: 600; color: #222; font-size: 1rem;">${r.author}</div>
                            <div style="font-size: 0.85rem; color: #888;">${formattedDate}</div>
                          </div>
                        </div>
                        <div style="color: #f59e0b; font-size: 1rem; margin-bottom: 2px; letter-spacing: 2px;">${'★'.repeat(r.rating || 0)}</div>
                        <div style="color: #333; font-size: 0.98rem; margin-bottom: 2px;">${r.content}</div>
                        <div style="display: flex; align-items: center; font-size: 0.85rem; color: #888; margin-top: 2px;">
                          <img src="${googleLogoUrl}" alt="Google" style="width: 14px; height: 14px; margin-right: 4px;" />Posted on Google
                        </div>
                      </div>
                      `;
            }).join('')}
                  </div>
                  ${reviewCount > reviews.length ? `
                  <button class="reviewhub-badge-load-more" style="
                      display: block;
                      width: 100%;
                      padding: 12px;
                      margin-top: 10px;
                      background: #f3f4f6;
                      border: none;
                      border-radius: 8px;
                      color: #4b5563;
                      font-weight: 600;
                      cursor: pointer;
                      transition: background 0.2s;
                  "
                  onmouseover="this.style.background='#e5e7eb'"
                  onmouseout="this.style.background='#f3f4f6'"
                  >Load More Reviews</button>
                  ` : ''}
                </div>
            `;
            document.body.appendChild(bodyOverlay);
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
              const panel = bodyOverlay.querySelector('.reviewhub-badge-modal-panel');
              if (panel) panel.style.transform = 'translateX(0)';
            }, 10);

            // Modal Logic
            const closeBtn = bodyOverlay.querySelector('.reviewhub-badge-modal-close');
            const loadMoreBtn = bodyOverlay.querySelector('.reviewhub-badge-load-more');
            const reviewsContainer = bodyOverlay.querySelector('.reviewhub-badge-modal-reviews-container');

            let modalCurrentOffset = reviews.length;
            const modalTotalReviews = reviewCount;
            let modalIsFetching = false;

            if (loadMoreBtn) {
              loadMoreBtn.addEventListener('click', async () => {
                if (modalIsFetching) return;
                modalIsFetching = true;
                loadMoreBtn.innerText = 'Loading...';

                try {
                  const newData = await window.ReviewHub.fetchReviewsWithPagination(
                    config.widgetId,
                    modalCurrentOffset,
                    6 // Load 6 more
                  );

                  if (newData && newData.reviews && newData.reviews.length > 0) {
                    modalCurrentOffset += newData.reviews.length;
                    const newReviewsHtml = newData.reviews.map((r) => {
                      const formattedDate = window.ReviewHub.formatDate(r.postedAt);
                      return `
                                  <div class="reviewhub-badge-modal-review-item" style="background: #fff; border-radius: 10px; padding: 14px 12px; border: 1px solid #f3f4f6; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                                    <div style="display: flex; align-items: center; margin-bottom: 6px;">
                                      <img src="${r.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.author)}" alt="${r.author}" style="width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; border: 1.5px solid #e5e7eb; object-fit: cover;" />
                                      <div>
                                        <div style="font-weight: 600; color: #222; font-size: 1rem;">${r.author}</div>
                                        <div style="font-size: 0.85rem; color: #888;">${formattedDate}</div>
                                      </div>
                                    </div>
                                    <div style="color: #f59e0b; font-size: 1rem; margin-bottom: 2px; letter-spacing: 2px;">${'★'.repeat(r.rating || 0)}</div>
                                    <div style="color: #333; font-size: 0.98rem; margin-bottom: 2px;">${r.content}</div>
                                    <div style="display: flex; align-items: center; font-size: 0.85rem; color: #888; margin-top: 2px;">
                                      <img src="${googleLogoUrl}" alt="Google" style="width: 14px; height: 14px; margin-right: 4px;" />Posted on Google
                                    </div>
                                  </div>
                                  `;
                    }).join('');

                    // Append new reviews
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newReviewsHtml;
                    while (tempDiv.firstChild) {
                      reviewsContainer.appendChild(tempDiv.firstChild);
                    }

                    if (modalCurrentOffset >= modalTotalReviews) {
                      loadMoreBtn.style.display = 'none';
                    } else {
                      loadMoreBtn.innerText = 'Load More Reviews';
                    }
                  } else {
                    loadMoreBtn.style.display = 'none';
                  }
                } catch (error) {
                  console.error('Error loading more reviews:', error);
                  loadMoreBtn.innerText = 'Load More Reviews';
                } finally {
                  modalIsFetching = false;
                }
              });
            }

            function closeModal() {
              const panel = bodyOverlay.querySelector('.reviewhub-badge-modal-panel');
              if (panel) panel.style.transform = 'translateX(-100%)';
              setTimeout(() => {
                document.body.removeChild(bodyOverlay);
                document.body.style.overflow = '';
              }, 350);
            }
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            bodyOverlay.addEventListener('click', function (e) {
              if (e.target === bodyOverlay) closeModal();
            });
          });
        }
        return;
      }

      if (widgetSettings.layout === 'carousel') {
        // Define reviewUrl for carousel layout
        let reviewUrl;
        if (businessUrlLink) {
          reviewUrl = businessUrlLink;
        } else if (widgetSettings.businessUrl?.url) {
          reviewUrl = widgetSettings.businessUrl.url;
        } else if (businessName) {
          reviewUrl = `https://www.google.com/maps/search/${encodeURIComponent(businessName)}+reviews`;
        } else {
          reviewUrl = 'https://www.google.com/maps';
        }
        function getVisibleCount() {
          const width = window.innerWidth;
          if (width < 576) return 1;
          if (width < 768) return 1;
          if (width < 992) return 2;
          if (width < 1200) return 3;
          return 4;
        }

        let visibleCount = getVisibleCount();
        let currentIndex = 0;
        let autoPlayInterval = null;
        let isAutoPlaying = true;
        let isDragging = false;
        let startX = 0;
        let currentX = 0;
        let dragThreshold = 50;
        const AUTO_PLAY_DELAY = 4000;
        const totalReviews = typeof totalReviewCount === 'number' ? totalReviewCount : reviews.length;
        const platformName = widgetSettings.businessUrl?.source === 'facebook' ? 'Facebook' : 'Google';

        const filteredReviews = reviews.filter(r => (r.content && r.content.trim()) || (r.text && r.text.trim()));

        const reviewsHtml = filteredReviews.map((review, index) => {
          const authorInitials = this.getInitials(review.author);
          const ratingStars = review.rating ? this.generateStars(review.rating) : '';
          const reviewDate = review.postedAt ? this.formatDate(review.postedAt) : '';
          const sourceClass = review.source === 'google' ? 'google' : 'facebook';
          const reviewText = review.content || review.text || '';
          const isLongText = reviewText.length > 180;
          const truncatedText = isLongText ? reviewText.substring(0, 180) + '...' : reviewText;
          const googleLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
          const facebookLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;
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
                  ${widgetSettings.showRatings && ratingStars ? `<div class="reviewhub-review-rating">${ratingStars}</div>` : ''}
                  ${widgetSettings.showDates && reviewDate ? `<div class="reviewhub-review-date">${reviewDate}</div>` : ''}
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
        const chevronLeft = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.5 19L9.5 12L15.5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const chevronRight = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 5L14.5 12L8.5 19" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        const carouselHtml = `
          <div class="reviewhub-carousel-container">
            <button class="reviewhub-carousel-prev" aria-label="Previous">${chevronLeft}</button>
            <div class="reviewhub-carousel-viewport">
              <div class="reviewhub-carousel-track">
                ${reviewsHtml}
                <div class="reviewhub-carousel-restart-card" style="display: none !important;">
                  <div class="reviewhub-restart-content">
                   
                     <button class="reviewhub-restart-button">Start Again</button>
                  </div>
                </div>
              </div>
            </div>
            <button class="reviewhub-carousel-next" aria-label="Next">${chevronRight}</button>
            <ul class="reviewhub-carousel-dots">
              ${filteredReviews.map((_, index) => `
                <li>
                  <button class="reviewhub-carousel-dot ${index === 0 ? 'active' : ''}" 
                          data-index="${index}" 
                          aria-label="Go to slide ${index + 1}">
                  </button>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
        const widgetHtml = `
          <div class="reviewhub-widget">
            <div class="reviewhub-widget-content layout-carousel">
              ${carouselHtml}
            </div>
          </div>
        `;
        container.innerHTML = widgetHtml;
        const track = container.querySelector('.reviewhub-carousel-track');
        const prevBtn = container.querySelector('.reviewhub-carousel-prev');
        const nextBtn = container.querySelector('.reviewhub-carousel-next');
        const carouselContainer = container.querySelector('.reviewhub-carousel-container');
        const restartCard = container.querySelector('.reviewhub-carousel-restart-card');
        const restartButton = container.querySelector('.reviewhub-restart-button');

        function updateDots() {
          const isMobile = window.innerWidth <= 767;
          const dots = container.querySelectorAll('.reviewhub-carousel-dot');

          if (isMobile) {
            dots.forEach((dot, index) => {
              if (index === currentIndex) {
                dot.classList.add('active');
              } else {
                dot.classList.remove('active');
              }
            });
          }
        }

        function updateRestartCardVisibility() {
          const isMobile = window.innerWidth <= 767;
          const maxIndex = getMaxIndex();

          if (isMobile && restartCard) {
            // Show restart card when user reaches the last review on mobile
            if (currentIndex >= maxIndex && filteredReviews.length > 1) {
              restartCard.style.display = 'flex';
            } else {
              restartCard.style.display = 'none';
            }
          } else if (restartCard) {
            restartCard.style.display = 'none';
          }
        }

        function renderCarousel() {
          const maxIndex = getMaxIndex();
          if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
          }

          this.adjustCardHeights(); // Call using this context
          updateArrowsForLoop();
          updateRestartCardVisibility();
          goToWithLoop(currentIndex, false);
          startAutoPlay();
        }

        function startAutoPlay() {
          if (autoPlayInterval) clearInterval(autoPlayInterval);
          const currentVisibleCount = getVisibleCount();
          const maxIndex = getMaxIndex();
          if (filteredReviews.length <= currentVisibleCount || maxIndex === 0) return;

          autoPlayInterval = setInterval(() => {
            if (isAutoPlaying) {
              const currentMaxIndex = getMaxIndex();
              // Smooth infinite loop: when reaching the end, go to next item (which will be 0)
              const nextIndex = (currentIndex + 1) % (currentMaxIndex + 1);
              goToWithLoop(nextIndex);
            }
          }, AUTO_PLAY_DELAY);
        }

        function goToWithLoop(index, animate = true) {
          const maxIndex = getMaxIndex();
          const totalSlides = maxIndex + 1;

          // Handle infinite loop logic
          if (index >= totalSlides) {
            // Going forward past the end - loop to beginning
            currentIndex = 0;
          } else if (index < 0) {
            // Going backward past the beginning - loop to end
            currentIndex = maxIndex;
          } else {
            currentIndex = index;
          }

          if (track.children.length > 0) {
            const firstCard = track.children[0];
            const cardWidth = firstCard.offsetWidth;
            // Dynamic gap based on screen size to match CSS
            const isMobile = window.innerWidth <= 767;
            const gap = isMobile ? 12 : 16;

            let translateX = 0;
            if (filteredReviews.length > visibleCount) {
              translateX = currentIndex * (cardWidth + gap);
            }

            track.style.transition = animate ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
            track.style.transform = `translateX(-${translateX}px)`;
          }

          updateArrowsForLoop();
          updateDots();
          updateRestartCardVisibility();
        }

        function updateArrowsForLoop() {
          // For infinite loop, arrows are always enabled (except when not enough content)
          if (filteredReviews.length <= visibleCount) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
          } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';

            // Always enable arrows for infinite loop
            prevBtn.removeAttribute('disabled');
            prevBtn.style.opacity = '1';
            prevBtn.style.pointerEvents = 'auto';

            nextBtn.removeAttribute('disabled');
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
          }
        }

        // Add restart button event listener
        if (restartButton) {
          restartButton.addEventListener('click', () => {
            pauseAutoPlay();
            goToWithLoop(0);
            setTimeout(() => resumeAutoPlay(), 1000);
          });
        }

        function stopAutoPlay() {
          if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
          }
        }

        function pauseAutoPlay() {
          isAutoPlaying = false;
        }

        function resumeAutoPlay() {
          isAutoPlaying = true;
        }
        // Initial call to render
        setTimeout(() => {
          renderCarousel.call(this); // Ensure `this` context for renderCarousel
          addTouchSupport();
        }, 50);

        window.addEventListener('resize', () => {
          updateVisibleCount.call(this); // Ensure `this` context for updateVisibleCount
          stopAutoPlay();
          // renderCarousel is called by updateVisibleCount, which now also has `this` context
        });

        function updateVisibleCount() {
          visibleCount = getVisibleCount();
          const maxIndex = getMaxIndex();
          if (currentIndex > maxIndex) currentIndex = maxIndex;
          renderCarousel.call(this); // Ensure `this` context
        }

        function getMaxIndex() {
          if (filteredReviews.length <= visibleCount) {
            return 0;
          }
          const currentVisibleCount = getVisibleCount();
          return Math.max(0, filteredReviews.length - currentVisibleCount);
        }
        function updateArrows() {
          const maxIndex = getMaxIndex();
          const isMobile = window.innerWidth <= 767;

          // Hide arrows if not enough reviews to scroll
          if (filteredReviews.length <= visibleCount) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
          } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';

            // Update arrow states
            if (currentIndex === 0) {
              prevBtn.setAttribute('disabled', 'true');
              prevBtn.style.opacity = '0.3';
              prevBtn.style.pointerEvents = 'none';
            } else {
              prevBtn.removeAttribute('disabled');
              prevBtn.style.opacity = '1';
              prevBtn.style.pointerEvents = 'auto';
            }

            if (currentIndex >= maxIndex) {
              nextBtn.setAttribute('disabled', 'true');
              nextBtn.style.opacity = '0.3';
              nextBtn.style.pointerEvents = 'none';
            } else {
              nextBtn.removeAttribute('disabled');
              nextBtn.style.opacity = '1';
              nextBtn.style.pointerEvents = 'auto';
            }
          }
        }
        function goTo(index, animate = true) {
          const maxIndex = getMaxIndex();
          if (index < 0) index = 0;
          if (index > maxIndex) index = maxIndex;
          currentIndex = index;

          if (track.children.length > 0) {
            const isMobile = window.innerWidth <= 767;
            const firstCard = track.children[0];
            const cardWidth = firstCard.offsetWidth;
            // Dynamic gap based on screen size to match CSS
            const gap = isMobile ? 12 : 16;

            // Calculate translation based on current index
            let translateX = 0;
            if (filteredReviews.length > visibleCount) {
              translateX = currentIndex * (cardWidth + gap);
            }

            track.style.transition = animate ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
            track.style.transform = `translateX(-${translateX}px)`;
          }

          updateArrows();
          updateDots();
        }

        // Add touch/drag support
        function addTouchSupport() {
          // Mouse events
          track.addEventListener('mousedown', handleStart);
          track.addEventListener('mousemove', handleMove);
          track.addEventListener('mouseup', handleEnd);
          track.addEventListener('mouseleave', handleEnd);

          // Touch events
          track.addEventListener('touchstart', handleStart, { passive: true });
          track.addEventListener('touchmove', handleMove, { passive: false });
          track.addEventListener('touchend', handleEnd);

          function handleStart(e) {
            isDragging = true;
            startX = getClientX(e);
            currentX = startX;
            track.style.cursor = 'grabbing';
            pauseAutoPlay();
          }

          function handleMove(e) {
            if (!isDragging) return;

            e.preventDefault();
            currentX = getClientX(e);
            const deltaX = currentX - startX;

            // Provide visual feedback during drag
            const currentTransform = track.style.transform;
            const currentTranslateX = getCurrentTranslateX();
            track.style.transition = 'none';
            track.style.transform = `translateX(${currentTranslateX - deltaX}px)`;
          }

          function handleEnd(e) {
            if (!isDragging) return;

            isDragging = false;
            track.style.cursor = 'grab';

            const deltaX = currentX - startX;

            // Determine if user dragged enough to trigger slide
            if (Math.abs(deltaX) > dragThreshold) {
              if (deltaX > 0) {
                // Dragged right, go to previous (with loop)
                goToWithLoop(currentIndex - 1);
              } else if (deltaX < 0) {
                // Dragged left, go to next (with loop)
                goToWithLoop(currentIndex + 1);
              } else {
                // Snap back to current position
                goToWithLoop(currentIndex);
              }
            } else {
              // Snap back to current position
              goToWithLoop(currentIndex);
            }

            setTimeout(() => resumeAutoPlay(), 2000);
          }

          function getClientX(e) {
            return e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
          }

          function getCurrentTranslateX() {
            const transform = track.style.transform;
            const match = transform.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
            return match ? parseFloat(match[1]) : 0;
          }
        }
        prevBtn.addEventListener('click', () => {
          pauseAutoPlay();
          goToWithLoop(currentIndex - 1);
          setTimeout(() => resumeAutoPlay(), 2000);
        });

        nextBtn.addEventListener('click', () => {
          pauseAutoPlay();
          goToWithLoop(currentIndex + 1);
          setTimeout(() => resumeAutoPlay(), 2000);
        });
        goTo(currentIndex, false);
        carouselContainer.addEventListener('mouseenter', () => {
          pauseAutoPlay();
        });

        carouselContainer.addEventListener('mouseleave', () => {
          resumeAutoPlay();
        });
        track.addEventListener('mouseenter', () => {
          pauseAutoPlay();
        });

        track.addEventListener('mouseleave', () => {
          resumeAutoPlay();
        });

        // Add click handlers for dots
        const dots = container.querySelectorAll('.reviewhub-carousel-dot');
        dots.forEach(dot => {
          dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'));
            pauseAutoPlay();
            goToWithLoop(index);
            setTimeout(() => resumeAutoPlay(), 2000);
          });
        });

        this.attachEventListeners(container, filteredReviews);
        return;
      }
      const reviewsHtml = filteredReviews.map((review, index) => {
        const authorInitials = this.getInitials(review.author);
        const ratingStars = review.rating ? this.generateStars(review.rating) : '';
        const reviewDate = review.postedAt ? this.formatDate(review.postedAt) : '';
        const sourceClass = review.source === 'google' ? 'google' : 'facebook';
        const reviewText = review.content || review.text || '';
        const isLongText = reviewText.length > 180;
        const truncatedText = isLongText ? reviewText.substring(0, 180) + '...' : reviewText;

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

      let reviewUrl;
      if (businessUrlLink) {
        reviewUrl = businessUrlLink;
      } else if (widgetSettings.businessUrl?.url) {
        reviewUrl = widgetSettings.businessUrl.url;
      } else if (businessName) {
        reviewUrl = `https://www.google.com/maps/search/${encodeURIComponent(businessName)}+reviews`;
      } else {
        reviewUrl = 'https://www.google.com/maps';
      }

      const widgetHtml = `
        <div class="reviewhub-widget">
          <div class="reviewhub-widget-content layout-${widgetSettings.layout || 'grid'}">
            ${reviewsHtml || '<div class="reviewhub-widget-error"><div class="reviewhub-error-title">No reviews available</div></div>'}
          </div>
        </div>
      `;

      container.innerHTML = widgetHtml;
      this.attachEventListeners(container, filteredReviews);
    },
    attachEventListeners: function (container, reviews) {
      const readMoreButtons = container.querySelectorAll('.reviewhub-read-more');
      readMoreButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const reviewIndex = button.getAttribute('data-review-index');
          this.showReviewModal(reviews[reviewIndex]);
        });
      });
    },
    showReviewModal: function (review) {
      const reviewText = review.content || review.text || '';
      const authorInitials = this.getInitials(review.author);
      const ratingStars = review.rating ? this.generateStars(review.rating) : '';
      const reviewDate = review.postedAt ? this.formatDate(review.postedAt) : '';
      const sourceClass = review.source === 'google' ? 'google' : 'facebook';
      const googleLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>`;

      const facebookLogo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>`;

      // Centered modal overlay and panel styles
      const modalHtml = `
        <div class="reviewhub-modal-overlay" style="
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 20px !important;
        ">
          <div class="reviewhub-modal" style="
            background: white !important;
            border-radius: 12px !important;
            max-width: 500px !important;
            width: 100% !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
            position: relative !important;
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
            transform: none !important;
            transition: none !important;
          ">
            <button class="reviewhub-modal-close" style="position: absolute !important; top: 16px !important; right: 16px !important; background: none !important; border: none !important; font-size: 24px !important; cursor: pointer !important; color: #6b7280 !important; padding: 4px !important; border-radius: 4px !important; transition: all 0.2s ease !important;">&times;</button>
            <div class="reviewhub-modal-header" style="padding: 24px 48px 0 24px !important; border-bottom: 1px solid #e5e7eb !important; margin-bottom: 24px !important; background: white !important; z-index: 1 !important;">
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
            <div class="reviewhub-modal-content" style="padding: 0 24px 24px 24px !important;">
              <div class="reviewhub-review-content">${this.escapeHtml(reviewText)}</div>
            </div>
          </div>
        </div>
      `;
      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement);
      const overlay = modalElement.querySelector('.reviewhub-modal-overlay');
      const modal = modalElement.querySelector('.reviewhub-modal');
      const closeButton = modalElement.querySelector('.reviewhub-modal-close');

      const closeModal = () => {
        document.body.removeChild(modalElement);
      };

      closeButton.addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      });
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeModal(); 0
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    },

    darkenColor: function (color, percent) {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) - amt;
      const G = (num >> 8 & 0x00FF) - amt;
      const B = (num & 0x0000FF) - amt;
      return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    },

    escapeHtml: function (text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    fetchWithRetry: function (url, options, retries = CONFIG.RETRY_ATTEMPTS) {
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
              setTimeout(() => {
                this.fetchWithRetry(url, options, retries - 1).then(resolve).catch(reject);
              }, CONFIG.RETRY_DELAY);
            } else {
              reject(error);
            }
          });
      });
    },

    showError: function (container, error, config, retryCallback) {
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

    fetchReviewsWithPagination: async function (widgetId, offset = 0, limit = 8) {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      // Try to determine layout if passed in config (not standard, but consistent with other files)
      // Usually fetchReviewsWithPagination is called with IDs. 
      // We will leave layout generic or unset as it's optional for the API.

      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${widgetId}?${queryString}`;

      console.log(`[Widget Old] Fetching reviews: ${apiUrl}`);
      const data = await this.fetchWithRetry(apiUrl);
      return data;
    },

    initWidget: function (config) {
      let container = null;
      this.injectStyles();
      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          return;
        }
      } else {
        return;
      }
      container.className = 'reviewhub-widget-container';
      container.innerHTML = `
        <div class="reviewhub-widget" style="--widget-theme-color: ${config.themeColor || '#3B82F6'}; --widget-theme-color-dark: ${this.darkenColor(config.themeColor || '#3B82F6', 20)}">
          <div class="reviewhub-widget-loading">
            <div class="reviewhub-spinner"></div>
            <div>Loading reviews...</div>
          </div>
        </div>
      `;

      const retryLoad = () => {
        this.initWidget(config);
      };

      // Use 12 for carousel (enough for a good loop), 8 for badge
      const initialLimit = config.layout === 'badge' ? 8 : 12;

      this.fetchReviewsWithPagination(config.widgetId, 0, initialLimit)
        .then(data => {
          this.renderWidget(container, data, config);
        })
        .catch(error => {
          this.showError(container, error, config, retryLoad);
        });
    },
    adjustCardHeights: function () {
      const track = document.querySelector('.reviewhub-carousel-track');
      if (!track || !track.children.length) return;

      let maxHeight = 0;
      const reviewItems = track.querySelectorAll('.reviewhub-review-item');

      reviewItems.forEach(item => {
        item.style.height = 'auto';
      });

      reviewItems.forEach(item => {
        const itemHeight = item.offsetHeight;
        if (itemHeight > maxHeight) {
          maxHeight = itemHeight;
        }
      });

      if (maxHeight > 0) {
        reviewItems.forEach(item => {
          item.style.height = `${maxHeight}px`;
        });
      }
    }
  };

  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id]');
    window.ReviewHub.log('info', `Found ${scriptTags.length} widget script(s)`);
    scriptTags.forEach(function (script) {
      const widgetId = script.getAttribute('data-widget-id');
      const themeColor = script.getAttribute('data-theme-color');
      const layout = script.getAttribute('data-layout');
      const name = script.getAttribute('data-name');
      const containerId = script.getAttribute('data-container-id');
      if (widgetId) {
        const config = {
          widgetId: widgetId,
          name: name,
          themeColor: themeColor,
          layout: layout,
          containerId: containerId || undefined,
          _scriptTag: script // Pass the script tag for unique instance
        };
        window.ReviewHub.initWidget(config);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidgetsFromScripts);
  } else {
    setTimeout(initializeWidgetsFromScripts, 0);
  }

  if (window.ReviewHubPendingWidgets && Array.isArray(window.ReviewHubPendingWidgets)) {
    window.ReviewHubPendingWidgets.forEach(function (pendingConfig) {
      window.ReviewHub.initWidget(pendingConfig);
    });
    window.ReviewHubPendingWidgets = [];
  }

  // Global API for manual widget initialization
  window.ReviewHub.init = function (config) {
    if (typeof config === 'string') {
      // Simple widget ID
      this.initWidget({ widgetId: config });
    } else {
      // Full config object
      this.initWidget(config);
    }
  };

})();