(function() {
  if (window.ReviewHubMasonry && window.ReviewHubMasonry.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget-masonry.js"]');
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
    MASONRY_SETTINGS: {
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

  window.ReviewHubMasonry = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    log: function(level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHubMasonry v${this.version}]`;
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
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
          starsHtml += '<span class="rh-masonry-star rh-masonry-star-full">★</span>';
        } else if (rating >= i - 0.7 && rating < i - 0.2) {
          starsHtml += '<span class="rh-masonry-star rh-masonry-star-half">★</span>';
        } else if (rating >= i - 0.2) {
          starsHtml += '<span class="rh-masonry-star rh-masonry-star-full">★</span>';
        } else {
          starsHtml += '<span class="rh-masonry-star rh-masonry-star-empty">☆</span>';
        }
      }
      return starsHtml;
    },

    injectStyles: function() {
      if (document.getElementById('reviewhub-masonry-widget-styles')) return;

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
      style.id = 'reviewhub-masonry-widget-styles';
      style.textContent = `
        /* Global styles */
        .reviewhub-masonry-widget-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          color: #111827;
          line-height: 1.5;
          margin: 0 auto;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-masonry-widget-container *::before,
        .reviewhub-masonry-widget-container *::after,
        .reviewhub-masonry-widget-container * {
          box-sizing: border-box;
        }

        /* Loading state */
        .reviewhub-masonry-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-masonry-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #F3F4F6;
          border-top: 3px solid var(--masonry-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-masonry-spin 0.8s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes rh-masonry-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-masonry-error {
          padding: 40px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
        }
        .reviewhub-masonry-error-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .reviewhub-masonry-error-message {
          font-size: 0.9em;
          margin-bottom: 16px;
          opacity: 0.9;
        }
        .reviewhub-masonry-retry-button {
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
        .reviewhub-masonry-retry-button:hover {
          background-color: #B91C1C;
          transform: translateY(-1px);
        }

        /* Masonry Layout */
        .reviewhub-masonry-widget {
          padding: 20px;
          background: transparent;
        }

        .reviewhub-masonry-container {
          column-gap: 20px;
          column-fill: balance;
        }

        /* Review Card Styles */
        .rh-masonry-review-card {
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
          margin-bottom: 20px;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .rh-masonry-review-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 3px 10px rgba(0, 0, 0, 0.06);
        }

        .rh-masonry-card-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .rh-masonry-card-avatar {
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
        .rh-masonry-card-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .rh-masonry-card-author-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex-grow: 1;
          min-width: 0;
        }

        .rh-masonry-card-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        }

        .rh-masonry-card-author-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
          margin-right: 8px;
        }

        .rh-masonry-verified-badge {
          color: #3B82F6;
          font-size: 0.85rem;
        }

        .rh-masonry-card-review-meta {
          font-size: 0.8rem;
          color: #6B7280;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .rh-masonry-card-rating {
          color: #F59E0B;
          font-size: 0.9rem;
          margin-bottom: 12px;
          display: flex;
          gap: 1px;
        }

        .rh-masonry-star {
          font-size: 0.9rem;
        }

        .rh-masonry-star-full {
          color: #F59E0B;
        }

        .rh-masonry-star-half {
          color: #F59E0B;
          opacity: 0.6;
        }

        .rh-masonry-star-empty {
          color: #E5E7EB;
        }

        .rh-masonry-card-content {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #374151;
          margin-bottom: 12px;
          word-wrap: break-word;
          hyphens: auto;
        }

        .rh-masonry-read-more {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--masonry-theme-color, #3B82F6);
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          transition: color 0.2s ease;
          text-decoration: none;
          margin-top: auto;
        }

        .rh-masonry-read-more:hover {
          color: var(--masonry-theme-color-dark, #2563EB);
          text-decoration: underline;
        }

        .rh-masonry-source-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          border-radius: 3px;
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rh-masonry-source-logo {
          width: 14px;
          height: 14px;
        }

        /* Modal styles - similar to other widgets */
        .reviewhub-masonry-modal-overlay {
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
        .reviewhub-masonry-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }

        .reviewhub-masonry-modal {
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
        .reviewhub-masonry-modal-overlay.visible .reviewhub-masonry-modal {
          transform: scale(1) translateY(0);
        }

        .reviewhub-masonry-modal-close {
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

        .reviewhub-masonry-modal-close:hover {
          background-color: #E5E7EB;
          color: #374151;
          transform: scale(1.05);
        }

        .reviewhub-masonry-modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #F1F5F9;
        }

        .reviewhub-masonry-modal-avatar {
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
        .reviewhub-masonry-modal-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .reviewhub-masonry-modal-author-details {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .reviewhub-masonry-modal-author-line {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }

        .reviewhub-masonry-modal-author-name {
          font-weight: 600;
          font-size: 1.2rem;
          color: #111827;
          margin: 0;
          margin-right: 8px;
        }

        .reviewhub-masonry-modal-verified-badge {
          color: #3B82F6;
          font-size: 1rem;
        }

        .reviewhub-masonry-modal-review-meta {
          font-size: 0.9rem;
          color: #6B7280;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 0;
        }

        .reviewhub-masonry-modal-rating {
          color: #F59E0B;
          font-size: 1.1rem;
          margin-bottom: 0;
          display: flex;
          gap: 2px;
        }

        .reviewhub-masonry-modal-content {
          font-size: 1rem;
          line-height: 1.7;
          color: #374151;
          word-wrap: break-word;
        }

        /* Responsive Masonry Columns */
        @media (max-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.mobile}px) {
          .reviewhub-masonry-container {
            column-count: 1;
            column-gap: 16px;
          }
          
          .rh-masonry-review-card {
            padding: 20px;
            margin-bottom: 16px;
          }
          
          .rh-masonry-card-avatar {
            width: 40px;
            height: 40px;
            font-size: 0.9rem;
          }
          
          .rh-masonry-card-author-name {
            font-size: 0.9rem;
          }
          
          .rh-masonry-card-content {
            font-size: 0.85rem;
          }
          
          .reviewhub-masonry-modal {
            padding: 24px;
            border-radius: 16px;
          }
          
          .reviewhub-masonry-modal-avatar {
            width: 48px;
            height: 48px;
          }
          
          .reviewhub-masonry-modal-author-name {
            font-size: 1.1rem;
          }
          
          .reviewhub-masonry-modal-content {
            font-size: 0.95rem;
          }
        }

        @media (min-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.mobile + 1}px) and (max-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.tablet}px) {
          .reviewhub-masonry-container {
            column-count: 2;
          }
        }

        @media (min-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.tablet + 1}px) and (max-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.desktop}px) {
          .reviewhub-masonry-container {
            column-count: 2;
          }
        }

        @media (min-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.desktop + 1}px) and (max-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.wide}px) {
          .reviewhub-masonry-container {
            column-count: 3;
          }
        }

        @media (min-width: ${CONFIG.MASONRY_SETTINGS.BREAKPOINTS.wide + 1}px) {
          .reviewhub-masonry-container {
            column-count: 4;
          }
          
          .rh-masonry-review-card {
            padding: 26px;
          }
          
          .rh-masonry-card-avatar {
            width: 48px;
            height: 48px;
            font-size: 1.05rem;
          }
          
          .rh-masonry-card-author-name {
            font-size: 1rem;
          }
          
          .rh-masonry-card-content {
            font-size: 0.95rem;
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
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt -1)));
        }
      }
    },

    showError: function(container, error, config, retryCallback) {
      this.log('error', 'Displaying error in masonry widget', { error: error.message, config });
      const themeColor = config.themeColor || '#3B82F6';
      container.style.setProperty('--masonry-theme-color', themeColor);
      container.style.setProperty('--masonry-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--masonry-theme-color-light', this.lightenColor(themeColor, 80));

      container.innerHTML = `
        <div class="reviewhub-masonry-error">
          <div class="reviewhub-masonry-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-masonry-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button class="reviewhub-masonry-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-masonry-retry-button');
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
      this.log('info', 'Rendering masonry widget', { data, config });
      const { widgetSettings, reviews, businessName, businessUrlLink, totalReviewCount } = data;
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';
      
      container.style.setProperty('--masonry-theme-color', themeColor);
      container.style.setProperty('--masonry-theme-color-dark', this.darkenColor(themeColor, 15));
      container.style.setProperty('--masonry-theme-color-light', this.lightenColor(themeColor, 90));

      if (!reviews || reviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-masonry-error"><div class="reviewhub-masonry-error-title">No reviews to display.</div><div class="reviewhub-masonry-error-message">Check back later or add some reviews!</div></div>';
        return;
      }

      const googleLogoUrl = 'https://assetsforscraper.b-cdn.net/Google-logo.png';
      
      const reviewCardsHtml = reviews.map((review, index) => {
        const author = this.escapeHtml(review.author || 'Anonymous');
        const initials = this.getInitials(review.author);
        const profilePicture = review.profilePicture;
        const date = this.formatDate(review.postedAt);
        const rating = parseFloat(review.rating) || 0;
        const stars = this.generateStars(rating);
        const content = this.escapeHtml(review.content || review.text || '');
        const isVerified = true;
        const isLongText = content.length > 200;

        return `
          <div class="rh-masonry-review-card">
            <div class="rh-masonry-source-badge">
              <img src="${googleLogoUrl}" alt="Google" class="rh-masonry-source-logo">
            </div>
            
            <div class="rh-masonry-card-header">
              <div class="rh-masonry-card-avatar">
                ${profilePicture && widgetSettings.showProfilePictures !== false ? 
                  `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : 
                  `<span>${initials}</span>`
                }
              </div>
              <div class="rh-masonry-card-author-details">
                <div class="rh-masonry-card-author-line">
                  <h4 class="rh-masonry-card-author-name">${author}</h4>
                  ${isVerified ? '<span class="rh-masonry-verified-badge">✓</span>' : ''}
                </div>
                ${widgetSettings.showDates !== false && date ? `
                  <div class="rh-masonry-card-review-meta">
                    ${date}
                  </div>` : ''}
              </div>
            </div>
            
            ${widgetSettings.showRatings !== false && rating > 0 ? `<div class="rh-masonry-card-rating">${stars}</div>` : ''}
            
            <div class="rh-masonry-card-content">${content}</div>
            ${isLongText ? `<button class="rh-masonry-read-more" data-review-index="${index}">Read More</button>` : ''}
          </div>
        `;
      }).join('');

      const masonryHtml = `
        <div class="reviewhub-masonry-widget">
          <div class="reviewhub-masonry-container">
            ${reviewCardsHtml}
          </div>
        </div>
      `;

      container.innerHTML = masonryHtml;
      this.attachModalEventListeners(container, reviews, data, config);
    },

    attachModalEventListeners: function(container, reviews, allData, config) {
        container.querySelectorAll('.rh-masonry-read-more').forEach(button => {
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
        if (document.querySelector('.reviewhub-masonry-modal-overlay')) return;

        const { widgetSettings } = allData;

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
        modalOverlay.className = 'reviewhub-masonry-modal-overlay';
        
        const showAvatarsSetting = widgetSettings.showProfilePictures !== false;
        const showDatesSetting = widgetSettings.showDates !== false;
        const showRatingsSetting = widgetSettings.showRatings !== false;

        const modalHTML = `
            <div class="reviewhub-masonry-modal">
                <button class="reviewhub-masonry-modal-close" aria-label="Close modal">&times;</button>
                <div class="reviewhub-masonry-modal-header">
                    <div class="reviewhub-masonry-modal-avatar">
                        ${profilePicture && showAvatarsSetting ? 
                          `<img src="${this.escapeHtml(profilePicture)}" alt="${author}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none;">${initials}</span>` : 
                          `<span>${initials}</span>`
                        }
                    </div>
                    <div class="reviewhub-masonry-modal-author-details">
                        <div class="reviewhub-masonry-modal-author-line">
                            <h3 class="reviewhub-masonry-modal-author-name">${author}</h3>
                            ${isVerified ? '<span class="reviewhub-masonry-modal-verified-badge">✓</span>' : ''}
                        </div>
                         ${showDatesSetting && date ? `
                           <p class="reviewhub-masonry-modal-review-meta">
                             ${date}
                           </p>` : ''}
                         ${showRatingsSetting && rating > 0 ? `<div class="reviewhub-masonry-modal-rating">${stars}</div>` : ''}
                    </div>
                </div>
                <div class="reviewhub-masonry-modal-content">
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

        modalOverlay.querySelector('.reviewhub-masonry-modal-close').addEventListener('click', closeModal);
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
          layout: 'masonry',
          ...userConfig 
      };

      this.log('info', 'Initializing masonry widget', config);
      this.injectStyles();

      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          this.log('error', `Container element #${config.containerId} not found.`);
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-masonry-widget-container';
          this.showError(errDiv, new Error(`Container #${config.containerId} not found.`), config, null);
          document.body.insertAdjacentElement('beforeend', errDiv);
          return;
        }
      } else if (config._scriptTag) {
          container = document.createElement('div');
          config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
          this.log('info', `No containerId, created one after script tag: ${config._scriptTag.src}`);
      } else {
        this.log('error', 'No containerId provided and cannot infer container. Masonry widget will not render.');
        return;
      }
      
      container.className = 'reviewhub-masonry-widget-container';
      container.innerHTML = `
        <div class="reviewhub-masonry-loading">
          <div class="reviewhub-masonry-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      container.style.setProperty('--masonry-theme-color', config.themeColor);
      container.style.setProperty('--masonry-theme-color-dark', this.darkenColor(config.themeColor, 15));
      container.style.setProperty('--masonry-theme-color-light', this.lightenColor(config.themeColor, 90));

      if (!config.widgetId) {
          this.showError(container, new Error('Widget ID is missing.'), config, null);
          return;
      }

      const params = new URLSearchParams();
      const queryString = params.toString();
      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}${queryString ? '?' + queryString : ''}`;
      this.log('info', `Fetching data from: ${apiUrl}`);

      const retryLoad = () => {
        this.log('info', 'Retrying masonry widget load', { widgetId: config.widgetId });
        container.innerHTML = '';
        this.initWidget(config); 
      };

      try {
        const data = await this.fetchWithRetry(apiUrl);
        if (data && data.reviews) {
          this.log('info', 'Masonry widget data loaded successfully', { widgetId: config.widgetId, reviewCount: data.reviews.length });
          data.widgetSettings = data.widgetSettings || {}; 
          this.renderWidget(container, data, config);
        } else {
          throw new Error('No reviews data received from API.');
        }
      } catch (error) {
        this.log('error', 'Failed to load masonry widget data', { widgetId: config.widgetId, error: error.message });
        this.showError(container, error, config, retryLoad);
      }
    },

    // Public init method
    init: function(userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;
      
      if (document.readyState === 'loading') {
          window.ReviewHubMasonry._pendingInitializations = window.ReviewHubMasonry._pendingInitializations || [];
          window.ReviewHubMasonry._pendingInitializations.push(config);
      } else {
          this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-masonry.js"]');
    window.ReviewHubMasonry.log('info', `Found ${scriptTags.length} masonry widget script tag(s) for auto-initialization.`);
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'masonry',
        _scriptTag: script
      };
      
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubMasonry.initWidget(config);
    });
  }
  
  function processPendingInitializations() {
      if (window.ReviewHubMasonry._pendingInitializations) {
          window.ReviewHubMasonry._pendingInitializations.forEach(config => window.ReviewHubMasonry.initWidget(config));
          delete window.ReviewHubMasonry._pendingInitializations;
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