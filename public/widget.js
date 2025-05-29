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
    injectStyles: function() {
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
          background: transparent !important;
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
        
        .reviewhub-carousel-container {
          position: relative !important;
          width: 100% !important;
          overflow: hidden !important;
          padding: 0 70px !important;
          box-sizing: border-box !important;
          background: transparent !important;
        }
        
        .reviewhub-carousel-viewport {
          overflow: hidden !important;
          width: 100% !important;
          position: relative !important;
        }
        
        .reviewhub-carousel-track {
          display: flex !important;
          transition: transform 0.5s cubic-bezier(0.4,0,0.2,1) !important;
          will-change: transform !important;
          align-items: stretch !important;
          margin: 0 !important;
          padding: 0 !important;
          transform-origin: left center !important;
        }
        
        .layout-carousel .reviewhub-review-item {
          flex: 0 0 auto !important;
          width: 320px !important;
          min-width: 320px !important;
          max-width: 320px !important;
          height: 280px !important;
          margin: 0 12px !important;
          box-sizing: border-box !important;
        }
        
        .layout-carousel .reviewhub-review-item:first-child {
          margin-left: 0 !important;
        }
        
        .layout-carousel .reviewhub-review-item:last-child {
          margin-right: 0 !important;
        }
        
        .reviewhub-carousel-prev, .reviewhub-carousel-next {
          position: absolute !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 44px !important;
          height: 44px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 50% !important;
          color: #6b7280 !important;
          font-size: 18px !important;
          cursor: pointer !important;
          z-index: 10 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          transition: all 0.2s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          user-select: none !important;
          margin: 0 !important;
          padding: 0 !important;
          backdrop-filter: blur(4px) !important;
        }
        
        .reviewhub-carousel-prev:hover:not([disabled]), .reviewhub-carousel-next:hover:not([disabled]) {
          background: var(--widget-theme-color, #3B82F6) !important;
          color: #fff !important;
          border-color: var(--widget-theme-color, #3B82F6) !important;
        }
        
        .reviewhub-carousel-prev[disabled], .reviewhub-carousel-next[disabled] {
          opacity: 0.3 !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
        }
        
        .reviewhub-carousel-prev {
          left: 15px !important;
        }
        
        .reviewhub-carousel-next {
          right: 15px !important;
        }
        
        @media (min-width: 1680px) {
          .layout-carousel .reviewhub-review-item {
            width: 300px !important;
            min-width: 300px !important;
            max-width: 300px !important;
            height: 300px !important;
            margin: 0 12px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 80px !important;
          }
        }
        
        @media (max-width: 1679px) and (min-width: 1440px) {
          .layout-carousel .reviewhub-review-item {
            width: 320px !important;
            min-width: 320px !important;
            max-width: 320px !important;
            height: 300px !important;
            margin: 0 12px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 80px !important;
          }
        }
        
        @media (max-width: 1439px) and (min-width: 1200px) {
          .layout-carousel .reviewhub-review-item {
            width: 300px !important;
            min-width: 300px !important;
            max-width: 300px !important;
            height: 280px !important;
            margin: 0 12px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 70px !important;
          }
        }
        
        @media (max-width: 1199px) and (min-width: 992px) {
          .layout-carousel .reviewhub-review-item {
            width: 320px !important;
            min-width: 320px !important;
            max-width: 320px !important;
            height: 280px !important;
            margin: 0 12px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 70px !important;
          }
        }
        
        @media (max-width: 991px) and (min-width: 768px) {
          .layout-carousel .reviewhub-review-item {
            width: 340px !important;
            min-width: 340px !important;
            max-width: 340px !important;
            height: 280px !important;
            margin: 0 12px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 60px !important;
          }
        }
        
        @media (max-width: 767px) and (min-width: 576px) {
          .layout-carousel .reviewhub-review-item {
            width: 300px !important;
            min-width: 300px !important;
            max-width: 300px !important;
            height: 280px !important;
            margin: 0 12px !important;
          }
          .layout-carousel .reviewhub-review-item:first-child {
            margin-left: 0 !important;
          }
          .layout-carousel .reviewhub-review-item:last-child {
            margin-right: 0 !important;
          }
          .reviewhub-carousel-container {
            padding: 0 55px !important;
          }
          .reviewhub-carousel-prev, .reviewhub-carousel-next {
            width: 38px !important;
            height: 38px !important;
            font-size: 16px !important;
          }
          .reviewhub-carousel-prev {
            left: 12px !important;
          }
          .reviewhub-carousel-next {
            right: 12px !important;
          }
        }
        
        @media (max-width: 575px) {
          .layout-carousel .reviewhub-review-item {
            width: calc(100vw - 100px) !important;
            min-width: calc(100vw - 100px) !important;
            max-width: 320px !important;
            height: 280px !important;
            margin: 0 !important;
          }
          .layout-carousel .reviewhub-review-item:first-child {
            margin-left: 0 !important;
          }
          .layout-carousel .reviewhub-review-item:last-child {
            margin-right: 0 !important;
          }
          .reviewhub-carousel-container {
            padding: 0 45px !important;
          }
          .reviewhub-carousel-prev, .reviewhub-carousel-next {
            width: 36px !important;
            height: 36px !important;
            font-size: 14px !important;
          }
          .reviewhub-carousel-prev {
            left: 8px !important;
          }
          .reviewhub-carousel-next {
            right: 8px !important;
          }
        }
        
        @media (max-width: 319px) {
          .layout-carousel .reviewhub-review-item {
            width: calc(100vw - 80px) !important;
            min-width: calc(100vw - 80px) !important;
            max-width: 240px !important;
            height: 260px !important;
            margin: 0 4px !important;
          }
          .reviewhub-carousel-container {
            padding: 0 35px !important;
          }
          .reviewhub-carousel-prev, .reviewhub-carousel-next {
            width: 28px !important;
            height: 28px !important;
            font-size: 10px !important;
          }
          .reviewhub-carousel-prev {
            left: 4px !important;
          }
          .reviewhub-carousel-next {
            right: 4px !important;
          }
        }
      `;
      document.head.appendChild(style);
    },
    generateStars: function(rating) {
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
    
    formatDate: function(dateString) {
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
    getInitials: function(name) {
      if (!name) return '?';
      const words = name.trim().split(' ').filter(word => word.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].charAt(0).toUpperCase();
      return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    },
    renderWidget: function(container, widgetData, config) {
      console.log("WIDGET DATA", widgetData);
      console.log("CONFIG", config);
      console.log("CONTAINER", container);
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = widgetData;
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';
      const themeColorDark = this.darkenColor(themeColor, 20);
      container.style.setProperty('--widget-theme-color', themeColor);
      container.style.setProperty('--widget-theme-color-dark', themeColorDark);
      if (widgetSettings.layout === 'badge') {
        const googleLogoUrl = 'https://assetsforscraper.b-cdn.net/Google-logo.png';
        const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : '5.0';
        const reviewCount = totalReviewCount || reviews.length;
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
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
          modalBtn.addEventListener('click', function(e) {
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
                         margin-top: 12px;
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
                  <div style="max-height: 70vh; overflow-y: auto;">
                    ${reviews.map((r) => {
                      const formattedDate = window.ReviewHub.formatDate(r.postedAt);
                      return `
                      <div style="background: #fff; border-radius: 10px; padding: 14px 12px; border: 1px solid #f3f4f6; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
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
                </div>
            `;
            document.body.appendChild(bodyOverlay);
            document.body.style.overflow = 'hidden'; 
            setTimeout(() => {
              const panel = bodyOverlay.querySelector('.reviewhub-badge-modal-panel');
              if (panel) panel.style.transform = 'translateX(0)';
            }, 10);
            const closeBtn = bodyOverlay.querySelector('.reviewhub-badge-modal-close');
            function closeModal() {
              const panel = bodyOverlay.querySelector('.reviewhub-badge-modal-panel');
              if (panel) panel.style.transform = 'translateX(-100%)';
              setTimeout(() => {
                document.body.removeChild(bodyOverlay);
                document.body.style.overflow = '';
              }, 350);
            }
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            bodyOverlay.addEventListener('click', function(e) {
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
          
          if (width < 768) return 2;
          
          if (width < 992) return 2;
          
          if (width < 1200) return 3;
          
          if (width < 1440) return 4;
          
          if (width < 1680) return 4;
          
          return 5;
        }
        let visibleCount = getVisibleCount();
        let currentIndex = 0;
        let autoPlayInterval = null;
        let isAutoPlaying = true;
        const AUTO_PLAY_DELAY = 4000; 
        const totalReviews = typeof totalReviewCount === 'number' ? totalReviewCount : reviews.length;
        const platformName = widgetSettings.businessUrl?.source === 'facebook' ? 'Facebook' : 'Google';
        
        const reviewsHtml = reviews.map((review, index) => {
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
              </div>
            </div>
            <button class="reviewhub-carousel-next" aria-label="Next">${chevronRight}</button>
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

        function renderCarousel() {
          const maxIndex = getMaxIndex();
          if (currentIndex > maxIndex) {
            currentIndex = maxIndex;
          }
          
          updateArrows();
          goTo(currentIndex, false);
          startAutoPlay();
        }
        
        function startAutoPlay() {
          if (autoPlayInterval) clearInterval(autoPlayInterval);
          const currentVisibleCount = getVisibleCount();
          const maxIndex = getMaxIndex();
          if (reviews.length <= currentVisibleCount || maxIndex === 0) return;
          autoPlayInterval = setInterval(() => {
            if (isAutoPlaying) {
              const currentMaxIndex = getMaxIndex();
              if (currentIndex >= currentMaxIndex) {
                goTo(0);
              } else {
                const nextIndex = Math.min(currentIndex + 1, currentMaxIndex);
                goTo(nextIndex);
              }
            }
          }, AUTO_PLAY_DELAY);
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
        setTimeout(() => {
          renderCarousel();
        }, 50);
        window.addEventListener('resize', () => {
          updateVisibleCount();
          stopAutoPlay();
          renderCarousel();
        });
        function updateVisibleCount() {
          visibleCount = getVisibleCount();
          const maxIndex = getMaxIndex();
          if (currentIndex > maxIndex) currentIndex = maxIndex;
          renderCarousel();
        }
        function getMaxIndex() {
          if (reviews.length <= visibleCount) {
            return 0; 
          }
          const currentVisibleCount = getVisibleCount();
          return Math.max(0, reviews.length - currentVisibleCount);
        }
        function updateArrows() {
          const maxIndex = getMaxIndex();
          prevBtn.style.display = 'flex';
          nextBtn.style.display = 'flex';
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
        function goTo(index, animate = true) {
          const maxIndex = getMaxIndex();
          if (index < 0) index = 0;
          if (index > maxIndex) index = maxIndex;
          currentIndex = index;
          
          if (track.children.length > 0) {
            const cardElement = track.children[0];
            const cardWidth = cardElement.offsetWidth;
            const width = window.innerWidth;
            let margin = 12; 
            if (width < 576) margin = 0;
            else margin = 12;
            const visibleCount = getVisibleCount();
            let translateX = 0;
            if (currentIndex > 0) {
              if (visibleCount === 1) {
                translateX = currentIndex * cardWidth;
              } else {
                const cardsToMove = Math.min(currentIndex, reviews.length - visibleCount);
                if (cardsToMove > 0) {
                  translateX = cardsToMove * (cardWidth + margin);
                }
              }
            }
            
            track.style.transition = animate ? 'transform 0.5s cubic-bezier(0.4,0,0.2,1)' : 'none';
            track.style.transform = `translateX(-${translateX}px)`;
          }
          
          updateArrows();
        }
        prevBtn.addEventListener('click', () => {
          pauseAutoPlay();
          goTo(currentIndex - 1);
          setTimeout(() => resumeAutoPlay(), 2000);
        });
        
        nextBtn.addEventListener('click', () => {
          pauseAutoPlay();
          goTo(currentIndex + 1);
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
        this.attachEventListeners(container, reviews);
        return;
      }
      const reviewsHtml = reviews.map((review, index) => {
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
      this.attachEventListeners(container, reviews);
    },
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
    showReviewModal: function(review) {
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
          closeModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    },
    
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
    
    escapeHtml: function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
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
    
    initWidget: function(config) {
      let container = null;
      this.log('info', 'Initializing widget', config);
      this.injectStyles();
      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element not found: ${config.containerId}`);
          return;
        }
      } else {
        this.log('error', 'No data-container-id provided for widget. Widget will not be rendered.');
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
      const params = new URLSearchParams();
      if (config.themeColor) params.append('themeColor', config.themeColor);
      if (config.layout) params.append('layout', config.layout);
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;
      console.log("API URL", apiUrl);
      const retryLoad = () => {
        this.log('info', 'Retrying widget load', { widgetId: config.widgetId });
        this.initWidget(config);
      };
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

  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id]');
    window.ReviewHub.log('info', `Found ${scriptTags.length} widget script(s)`);
    scriptTags.forEach(function(script) {
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