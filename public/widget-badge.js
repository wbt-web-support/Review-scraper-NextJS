(function() {
  if (window.ReviewHubBadge && window.ReviewHubBadge.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget-badge.js"]');
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
    TIMEOUT: 10000
  };

  window.ReviewHubBadge = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    log: function(level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHubBadge v${this.version}]`;
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

    injectStyles: function() {
      if (document.getElementById('reviewhub-badge-widget-styles')) return;

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
      style.id = 'reviewhub-badge-widget-styles';
      style.textContent = `
        /* Global styles */
        .reviewhub-badge-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-badge-widget-container *::before,
        .reviewhub-badge-widget-container *::after,
        .reviewhub-badge-widget-container * {
          box-sizing: border-box;
        }

        /* Loading state */
        .reviewhub-badge-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-badge-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid #F3F4F6;
          border-top: 2px solid var(--badge-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-badge-spin 0.8s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes rh-badge-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-badge-error {
          padding: 30px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
          font-size: 14px;
        }
        .reviewhub-badge-error-title {
          font-size: 1em;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .reviewhub-badge-error-message {
          font-size: 0.85em;
          margin-bottom: 12px;
          opacity: 0.9;
        }
        .reviewhub-badge-retry-button {
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
        .reviewhub-badge-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }

        /* Badge Widget Styles */
        .reviewhub-badge-widget {
          background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFC 100%);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
          margin: 10px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #F1F5F9;
          min-width: 220px;
          max-width: 320px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .reviewhub-badge-widget:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08);
        }

        .reviewhub-badge-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .reviewhub-badge-logo {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .reviewhub-badge-title {
          font-weight: 600;
          font-size: 1.1rem;
          color: #1F2937;
          margin: 0;
        }

        .reviewhub-badge-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, #E5E7EB 50%, transparent 100%);
          margin: 12px 0 16px 0;
        }

        .reviewhub-badge-rating-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
          gap: 8px;
        }

        .reviewhub-badge-rating-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1F2937;
          line-height: 1;
        }

        .reviewhub-badge-stars {
          color: #F59E0B;
          font-size: 1.4rem;
          letter-spacing: 1px;
          line-height: 1;
        }

        .reviewhub-badge-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
          width: 100%;
        }

        .reviewhub-badge-review-link {
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

        .reviewhub-badge-review-link:hover {
          color: var(--badge-theme-color, #3B82F6);
          background: var(--badge-theme-color-light, #EFF6FF);
          border-color: var(--badge-theme-color, #3B82F6);
          transform: translateY(-1px);
        }

        .reviewhub-badge-write-review {
          background: var(--badge-theme-color, #3B82F6);
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

        .reviewhub-badge-write-review:hover {
          background: var(--badge-theme-color-dark, #2563EB);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        /* Modal styles */
        .reviewhub-badge-modal-overlay {
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
        .reviewhub-badge-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .reviewhub-badge-modal-panel {
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

        .reviewhub-badge-modal-overlay.visible .reviewhub-badge-modal-panel {
          transform: translateX(0);
        }

        .reviewhub-badge-modal-close {
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

        .reviewhub-badge-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
        }

        .reviewhub-badge-modal-title {
          font-size: 1.4rem;
          font-weight: 700;
          margin-bottom: 24px;
          color: #1F2937;
        }

        .reviewhub-badge-modal-summary {
          background: #F9FAFB;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          border: 1px solid #E5E7EB;
        }

        .reviewhub-badge-modal-summary-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          gap: 10px;
        }

        .reviewhub-badge-modal-summary-logo {
          width: 28px;
          height: 28px;
        }

        .reviewhub-badge-modal-summary-title {
          font-weight: 600;
          font-size: 1.1rem;
          color: #1F2937;
          margin: 0;
        }

        .reviewhub-badge-modal-summary-rating {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .reviewhub-badge-modal-summary-number {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1F2937;
        }

        .reviewhub-badge-modal-summary-stars {
          color: #F59E0B;
          font-size: 1.1rem;
          letter-spacing: 2px;
        }

        .reviewhub-badge-modal-summary-count {
          color: #6B7280;
          font-size: 0.95rem;
        }

        .reviewhub-badge-modal-cta {
          background: var(--badge-theme-color, #3B82F6);
          color: #fff;
          border-radius: 10px;
          font-weight: 600;
          font-size: 1rem;
          text-decoration: none;
          transition: background 0.2s ease-in-out;
          text-align: center;
          width: 100%;
          padding: 12px 0px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }

        .reviewhub-badge-modal-cta:hover {
          background: var(--badge-theme-color-dark, #2563EB);
        }

        .reviewhub-badge-modal-reviews {
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 8px;
        }

        .reviewhub-badge-modal-review {
          background: #fff;
          border-radius: 12px;
          padding: 18px;
          border: 1px solid #F3F4F6;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: all 0.2s ease;
        }

        .reviewhub-badge-modal-review:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }

        .reviewhub-badge-modal-review-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          gap: 12px;
        }

        .reviewhub-badge-modal-review-avatar {
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

        .reviewhub-badge-modal-review-info {
          flex: 1;
        }

        .reviewhub-badge-modal-review-author {
          font-weight: 600;
          color: #1F2937;
          font-size: 1rem;
          margin: 0 0 2px 0;
        }

        .reviewhub-badge-modal-review-date {
          font-size: 0.85rem;
          color: #6B7280;
          margin: 0;
        }

        .reviewhub-badge-modal-review-rating {
          color: #F59E0B;
          font-size: 1rem;
          margin-bottom: 8px;
          letter-spacing: 2px;
        }

        .reviewhub-badge-modal-review-content {
          color: #374151;
          font-size: 0.95rem;
          margin-bottom: 8px;
          line-height: 1.6;
        }

        .reviewhub-badge-modal-review-source {
          display: flex;
          align-items: center;
          font-size: 0.8rem;
          color: #6B7280;
          gap: 4px;
        }

        .reviewhub-badge-modal-review-source-logo {
          width: 14px;
          height: 14px;
        }

        /* Mobile responsive */
        @media (max-width: 640px) {
          .reviewhub-badge-widget {
            min-width: 200px;
            max-width: 280px;
            padding: 16px;
            margin: 8px;
          }

          .reviewhub-badge-modal-panel {
            max-width: 100%;
            border-radius: 0;
            padding: 24px 20px;
          }

          .reviewhub-badge-modal-title {
            font-size: 1.2rem;
          }

          .reviewhub-badge-modal-reviews {
            max-height: 55vh;
          }

          .reviewhub-badge-modal-review {
            padding: 14px;
          }

          .reviewhub-badge-modal-review-avatar {
            width: 36px;
            height: 36px;
            font-size: 0.8rem;
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
            this.log('error', `Failed to fetch ${url} after ${retries + 1} attempts`, error);
            throw error;
          }
          this.log('warn', `Retrying request to ${url}. Attempt ${attempt} of ${retries}. Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt -1))); // Exponential backoff
        }
      }
    },

    showError: function(container, error, config, retryCallback) {
      this.log('error', 'Displaying error in badge widget', { error: error.message, config });
      const themeColor = config.themeColor || '#3B82F6';
      container.style.setProperty('--badge-theme-color', themeColor);
      container.style.setProperty('--badge-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--badge-theme-color-light', this.lightenColor(themeColor, 80));

      container.innerHTML = `
        <div class="reviewhub-badge-error">
          <div class="reviewhub-badge-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-badge-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-badge-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-badge-retry-button');
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
      this.log('info', 'Rendering badge widget', { data, config });
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';
      
      container.style.setProperty('--badge-theme-color', themeColor);
      container.style.setProperty('--badge-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--badge-theme-color-light', this.lightenColor(themeColor, 90));

      if (!reviews || reviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-badge-error"><div class="reviewhub-badge-error-title">No reviews to display.</div><div class="reviewhub-badge-error-message">Check back later or add some reviews!</div></div>';
        return;
      }

      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : '5.0';
      const reviewCount = totalReviewCount || reviews.length;
      const reviewText = reviewCount === 1 ? 'Review' : 'Reviews';
      const platformName = widgetSettings.platformName || "Google";
      
      // Determine review URL
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

      const googleLogoUrl = 'https://assetsforscraper.b-cdn.net/Google-logo.png';
      const stars = this.generateStars(parseFloat(avgRating));

      const badgeHtml = `
        <div class="reviewhub-badge-widget">
          <div class="reviewhub-badge-header">
            <div class="reviewhub-badge-logo">
              <img src="${googleLogoUrl}" alt="${platformName}" style="width: 28px; height: 28px; border-radius: 4px;" />
            </div>
            <h3 class="reviewhub-badge-title">${platformName} Reviews</h3>
          </div>
          
          <div class="reviewhub-badge-divider"></div>
          
          <div class="reviewhub-badge-rating-container">
            <span class="reviewhub-badge-rating-number">${avgRating}</span>
            <span class="reviewhub-badge-stars">${stars}</span>
          </div>
          
          <div class="reviewhub-badge-actions">
            <button class="reviewhub-badge-review-link reviewhub-badge-modal-btn">
              📖 Read our ${reviewCount} ${reviewText}
            </button>
            <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" class="reviewhub-badge-write-review">
              Write a Review
            </a>
          </div>
        </div>
      `;

      container.innerHTML = badgeHtml;
      this.attachModalEventListener(container, data, config);
    },

    attachModalEventListener: function(container, data, config) {
      const modalBtn = container.querySelector('.reviewhub-badge-modal-btn');
      if (!modalBtn) return;

      modalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showReviewsModal(data, config);
      });
    },

    showReviewsModal: function(data, config) {
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : '5.0';
      const reviewCount = totalReviewCount || reviews.length;
      const platformName = widgetSettings.platformName || "Google";
      const googleLogoUrl = 'https://assetsforscraper.b-cdn.net/Google-logo.png';
      const stars = this.generateStars(parseFloat(avgRating));

      // Determine review URL
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

      const reviewsHtml = reviews.map((review) => {
        const formattedDate = this.formatDate(review.postedAt);
        const reviewStars = this.generateStars(review.rating || 0);
        const initials = this.getInitials(review.author);
        
        return `
          <div class="reviewhub-badge-modal-review">
            <div class="reviewhub-badge-modal-review-header">
              ${review.profilePicture ? 
                `<img src="${review.profilePicture}" alt="${this.escapeHtml(review.author)}" class="reviewhub-badge-modal-review-avatar" />` :
                `<div class="reviewhub-badge-modal-review-avatar">${initials}</div>`
              }
              <div class="reviewhub-badge-modal-review-info">
                <div class="reviewhub-badge-modal-review-author">${this.escapeHtml(review.author)}</div>
                <div class="reviewhub-badge-modal-review-date">${formattedDate}</div>
              </div>
            </div>
            <div class="reviewhub-badge-modal-review-rating">${reviewStars}</div>
            <div class="reviewhub-badge-modal-review-content">${this.escapeHtml(review.content)}</div>
            <div class="reviewhub-badge-modal-review-source">
              <img src="${googleLogoUrl}" alt="${platformName}" class="reviewhub-badge-modal-review-source-logo" />
              Posted on ${platformName}
            </div>
          </div>
        `;
      }).join('');

      const modalHtml = `
        <div class="reviewhub-badge-modal-overlay">
          <div class="reviewhub-badge-modal-panel">
            <button class="reviewhub-badge-modal-close" aria-label="Close modal">&times;</button>
            
            <h2 class="reviewhub-badge-modal-title">What our customers say</h2>
            
            <div class="reviewhub-badge-modal-summary">
              <div class="reviewhub-badge-modal-summary-header">
                <img src="${googleLogoUrl}" alt="${platformName}" class="reviewhub-badge-modal-summary-logo" />
                <h3 class="reviewhub-badge-modal-summary-title">${platformName} Reviews</h3>
              </div>
              <div class="reviewhub-badge-modal-summary-rating">
                <span class="reviewhub-badge-modal-summary-number">${avgRating}</span>
                <span class="reviewhub-badge-modal-summary-stars">${stars}</span>
                <span class="reviewhub-badge-modal-summary-count">(${reviewCount})</span>
              </div>
              <a href="${reviewUrl}" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 class="reviewhub-badge-modal-cta">
                Review us on ${platformName}
              </a>
            </div>
            
            <div class="reviewhub-badge-modal-reviews">
              ${reviewsHtml}
            </div>
          </div>
        </div>
      `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement);
      document.body.style.overflow = 'hidden';

      const overlay = modalElement.querySelector('.reviewhub-badge-modal-overlay');
      const closeBtn = modalElement.querySelector('.reviewhub-badge-modal-close');

      // Show modal with animation
      setTimeout(() => overlay.classList.add('visible'), 10);

      const closeModal = () => {
        overlay.classList.remove('visible');
        setTimeout(() => {
          document.body.removeChild(modalElement);
          document.body.style.overflow = '';
        }, 350);
      };

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

    initWidget: async function(userConfig) {
      let container;
      const config = { 
          widgetId: null, 
          containerId: null, 
          themeColor: '#3B82F6', 
          layout: 'badge',
          ...userConfig 
      };

      this.log('info', 'Initializing badge widget', config);
      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element #${config.containerId} not found.`);
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-badge-widget-container';
          this.showError(errDiv, new Error(`Container #${config.containerId} not found.`), config, null);
          document.body.insertAdjacentElement('beforeend', errDiv);
          return;
        }
      } else if (config._scriptTag) {
          container = document.createElement('div');
          config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
          this.log('info', `No containerId, created one after script tag: ${config._scriptTag.src}`);
      } else {
        this.log('error', 'No containerId provided and cannot infer container. Badge widget will not render.');
        return;
      }
      
      container.className = 'reviewhub-badge-widget-container';
      container.innerHTML = `
        <div class="reviewhub-badge-loading">
          <div class="reviewhub-badge-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      container.style.setProperty('--badge-theme-color', config.themeColor);
      container.style.setProperty('--badge-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--badge-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
          this.showError(container, new Error('Widget ID is missing.'), config, null);
          return;
      }

      const params = new URLSearchParams();
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;
      this.log('info', `Fetching data from: ${apiUrl}`);

      const retryLoad = () => {
        this.log('info', 'Retrying badge widget load', { widgetId: config.widgetId });
        container.innerHTML = '';
        this.initWidget(config); 
      };

      try {
        const data = await this.fetchWithRetry(apiUrl);
        if (data && data.reviews) {
          this.log('info', 'Badge widget data loaded successfully', { widgetId: config.widgetId, reviewCount: data.reviews.length });
          data.widgetSettings = data.widgetSettings || {}; 
          this.renderWidget(container, data, config);
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        this.log('error', 'Failed to load badge widget data', { widgetId: config.widgetId, error: error.message });
        this.showError(container, error, config, retryLoad);
      }
    },

    // Public init method
    init: function(userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;
      
      if (document.readyState === 'loading') {
          window.ReviewHubBadge._pendingInitializations = window.ReviewHubBadge._pendingInitializations || [];
          window.ReviewHubBadge._pendingInitializations.push(config);
      } else {
          this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-badge.js"]');
    window.ReviewHubBadge.log('info', `Found ${scriptTags.length} badge widget script tag(s) for auto-initialization.`);
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'badge',
        _scriptTag: script
      };
      
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubBadge.initWidget(config);
    });
  }
  
  function processPendingInitializations() {
      if (window.ReviewHubBadge._pendingInitializations) {
          window.ReviewHubBadge._pendingInitializations.forEach(config => window.ReviewHubBadge.initWidget(config));
          delete window.ReviewHubBadge._pendingInitializations;
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