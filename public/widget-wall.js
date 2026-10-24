/**
 * Wall layout: reviews in lanes that scroll on their own, forever.
 *
 * Embed attributes, all optional:
 *   data-direction  "vertical" (columns scrolling up and down) or "horizontal" (rows scrolling sideways)
 *   data-columns    lanes in vertical mode, 1-6. Narrow screens get fewer, never squeezed ones.
 *   data-rows       lanes in horizontal mode, 1-6
 *   data-speed      "slow", "normal", "fast", or a number of pixels per second
 *   data-height     height of a vertical wall in pixels (default 600)
 *   data-theme      "light" or "dark" cards
 *
 * The scrolling is a CSS transform animation rather than anything driven from script,
 * so it runs on the compositor and keeps going smoothly while the host page is busy.
 */
(function () {
  if (window.ReviewHubWall && window.ReviewHubWall.isInitialized) {
    return;
  }

  const CONFIG = {
    // Where the API and the sibling widget scripts live. Resolved in this order so a
    // caching or minify plugin that copies this file onto the host site can't hijack it:
    //   1. an explicit data-api-domain attribute or window.REVIEWHUB_API_DOMAIN
    //   2. this script's own origin, but only when it is still served from the root of
    //      our domain. A copy at /wp-content/cache/min/1/widget-wall.js points every
    //      request back at the client's own server, which answers 404 for all of them.
    //   3. localhost during development
    //   4. the production default
    API_DOMAIN: (function () {
      const FILENAME = 'widget-wall.js';
      const DEFAULT_DOMAIN = 'https://reviews.webuildtrades.com';
      const clean = function (value) {
        return String(value || '').trim().replace(/\/+$/, '');
      };
      const isLocalHost = function (hostname) {
        return hostname === 'localhost' || hostname === '127.0.0.1';
      };

      const scripts = document.querySelectorAll('script[src*="' + FILENAME + '"]');
      const scriptTag = scripts.length > 0 ? scripts[scripts.length - 1] : null;

      const override = clean(
        (scriptTag && scriptTag.getAttribute('data-api-domain')) || window.REVIEWHUB_API_DOMAIN
      );
      if (override) {
        return override;
      }

      if (scriptTag && scriptTag.src) {
        try {
          const url = new URL(scriptTag.src);
          // A rewritten path means the file was copied somewhere it can't serve the API.
          const isRewritten = url.pathname !== '/' + FILENAME;
          // Served by the page's own host: fine for our own domains, wrong for a client site.
          const isSameOrigin = url.origin === window.location.origin;
          const isOurHost =
            /(^|\.)webuildtrades\.com$/.test(url.hostname) ||
            /\.vercel\.app$/.test(url.hostname) ||
            isLocalHost(url.hostname);

          if (!isRewritten && (!isSameOrigin || isOurHost)) {
            return clean(url.origin);
          }

          if (window.console && console.warn) {
            console.warn(
              '[ReviewHub] Ignoring ' + url.href + ' as the API origin: it looks like a cached or ' +
              'self-hosted copy, and that host does not serve /api/public/widget-data. Falling back to ' +
              DEFAULT_DOMAIN + '. Exclude ' + FILENAME + ' from your minify/cache plugin, or set ' +
              'window.REVIEWHUB_API_DOMAIN.'
            );
          }
        } catch (e) {
          // Unparseable src, fall through to the defaults below.
        }
      }

      if (isLocalHost(window.location.hostname)) {
        return clean(window.location.origin);
      }
      return DEFAULT_DOMAIN;
    })(),
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 3000,
    TIMEOUT: 10000,
    WALL_SETTINGS: {
      // More than the other layouts load, so neighbouring lanes rarely show the same
      // review side by side.
      FETCH_LIMIT: 30,
      MAX_LANES: 6,
      DEFAULT_COLUMNS: 3,
      DEFAULT_ROWS: 2,
      DEFAULT_HEIGHT: 600,
      MIN_HEIGHT: 240,
      // A vertical lane narrower than this is unreadable, so a narrow screen gets fewer
      // columns than the embed asked for rather than squeezed ones.
      MIN_COLUMN_WIDTH: 240,
      // Card width in horizontal mode, and below NARROW_VIEWPORT.
      CARD_WIDTH: 320,
      CARD_WIDTH_NARROW: 272,
      NARROW_VIEWPORT: 480,
      GAP: 20,
      // Pixels per second, so a lane holding more reviews takes longer to loop instead
      // of moving faster than its neighbours.
      SPEEDS: { slow: 18, normal: 32, fast: 56 }
    }
  };

  window.ReviewHubWall = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),

    // Per-container state, read by the delegated click handler and on relayout.
    instances: new WeakMap(),
    boundContainers: new WeakSet(),
    initializedScripts: new WeakSet(),

    log: function (level, message, data) {
      // Console logging disabled for production
    },

    escapeHtml: function (text) {
      // Quotes too: escaped text also goes inside attributes (aria-label, title).
      if (typeof text !== 'string') return '';
      return text.replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    stripHtml: function (text) {
      // Plain text only. Never parse review text as HTML: building elements from it
      // (even in a detached div) loads images and runs their onerror handlers, which
      // let any review run script on the client's website.
      if (typeof text !== 'string') return '';
      return text
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .trim();
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
      const r = Math.max(0, Math.min(5, parseFloat(rating) || 0));
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (r >= i) {
          starsHtml += '<i class="rh-fas rh-fa-star"></i>';
        } else if (r >= i - 0.5) {
          starsHtml += '<i class="rh-fas rh-fa-star-half-alt"></i>';
        } else {
          starsHtml += '<i class="rh-far rh-fa-star"></i>';
        }
      }
      return starsHtml;
    },

    generateRecommendationStatus: function (review) {
      // For Facebook reviews, show recommendation status instead of stars
      const recommendationStatus = review.recommendationStatus || '';
      if (recommendationStatus === 'recommended') {
        return '<div class="rh-wall-recommendation rh-wall-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-wall-recommendation rh-wall-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
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

    /** True for colours pale enough that white initials on them would disappear. */
    isLightColor: function (color) {
      const hex = String(color || '').trim().replace(/^#/, '');
      const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
      if (!/^[0-9a-f]{6}$/i.test(full)) return false;
      const num = parseInt(full, 16);
      const r = (num >> 16) & 0xFF;
      const g = (num >> 8) & 0xFF;
      const b = num & 0xFF;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
    },

    /** The embed attributes, clamped to what the layout can draw. */
    resolveSettings: function (config) {
      const S = CONFIG.WALL_SETTINGS;
      const direction = config.direction === 'horizontal' ? 'horizontal' : 'vertical';
      const requested = parseInt(direction === 'vertical' ? config.columns : config.rows, 10);
      const defaultLanes = direction === 'vertical' ? S.DEFAULT_COLUMNS : S.DEFAULT_ROWS;
      const speedName = String(config.speed || '').toLowerCase();
      const customSpeed = parseFloat(speedName);
      const height = parseInt(config.height, 10);

      return {
        direction,
        lanes: requested >= 1 ? Math.min(requested, S.MAX_LANES) : defaultLanes,
        speed: S.SPEEDS[speedName] || (customSpeed > 0 ? customSpeed : S.SPEEDS.normal),
        height: height >= S.MIN_HEIGHT ? height : S.DEFAULT_HEIGHT,
        theme: config.theme === 'dark' ? 'dark' : 'light'
      };
    },

    injectStyles: function () {
      if (document.getElementById('reviewhub-wall-widget-styles')) return;

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

      const S = CONFIG.WALL_SETTINGS;
      const style = document.createElement('style');
      style.id = 'reviewhub-wall-widget-styles';
      style.textContent = `
        .reviewhub-wall-widget-container {
          --wall-gap: ${S.GAP}px;
          --wall-fade: 72px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #111827;
          line-height: 1.5;
          max-width: 100%;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .reviewhub-wall-widget-container *,
        .reviewhub-wall-widget-container *::before,
        .reviewhub-wall-widget-container *::after {
          box-sizing: border-box;
        }

        /* Icon font: Font Awesome 5 Free subset (7 glyphs), inlined as woff2 data URIs.
           Self-hosted so widgets never block on the cdnjs stylesheet + webfont request.
           Font Awesome Free fonts are licensed SIL OFL 1.1 (https://fontawesome.com/license/free). */
        @font-face {
          font-family: 'RH Icons';
          font-style: normal;
          font-weight: 900;
          font-display: block;
          src: url(data:font/woff2;base64,d09GMgABAAAAAANkAAwAAAAABdAAAAMYAUuGJAAAAAAAAAAAAAAAAAAAAAAAAAAAGhYGYABUEQgKhliFQwE2AiQDIAsSAAQgBQYHIBtUBACO1FEtOvfs+5y67yugyAnLlLACzEU8ppanNyS5ZbtAsksATuFGDKqCr4lz8Ua72TjSWmEi22fYgj4q6On9Bf9Fhh9lo4/EB3/dhhRHfx8+zWbwoLeBAPgCAAAGAsEbDB70h5sET4DakQygUalvMGPScgZPDvqQTnJ9PygffXOTW3Mjg86iGwACACqhdQCiI1vAAHAARHCginigqugLHqyt+ej5sdvHXp8s39yaBlSgK9jvPwF/A3YEbPVfJTSC0HFI08AA84ACkfYD6Ik242JpeHe/joEDB2bW6/nAQD7dOInQWZc4zN27r1smduu+aGNCj25rN4f17OFckdiTWlwOfbK6aLJZXSgmLbAbyLC1dPNTKc7FRpyxxJhKKsBWeaFctV+33XD06um61BxVNNHajXo6VEBZIAh2J5HNpbvmcNmc9gWKVdkp6hzHoCQJi5aaTIu4yLRg716o1WO/AG82brlhdEWt0dS6dcu45HndYtYpRaUpi11abnBeT1necBTeQA7v26dfZFKXmRaZbbpNUI4KgroLytK1a63/WFQ3CnYD1xYI9s1Gdm+AOnaWENqDxXfvEcq22ZJsVRPn6rP33esvm+ZK3/kJtb3u80MqZ/WX7+3LnquHdLG1VRbl7jInLxbNDXYPqfHVhokI3z5d+5Fwfs4cs2biqAMHDh/ucXizqtbXbx7YHbZat8D6QLgnfHyjnSQT8UO8137Qc4T5v5fFLBkjJRpQ7u668FjvXcuWUQSX1RiVGeQpe173zMnLa/f//pZboq5u1hNMW8lTowO/ZjKKt7bc/w9P5uXkPUz2DMpsjMriImjZsl29jy3s6i4fQFKkUTJbvP6bzU9m1eFvSMyZd5tRzsj351u43ML752dw57sz0jyxauKefck0p3OngQET1+fI5X0t+cEDizAMAAK0wyybWhGmPaN4WuLLobkZkfsCAqjtlLgRNPPXgLJvvI4BAO5ljfN3+Ghvtb1MpXMAeEAsAg6eDqYIBMw+JCH+LrIqBJAFw6Is7i6WSfubxfLUB9ELCYp6gYOSdgdmAA==) format('woff2');
        }
        @font-face {
          font-family: 'RH Icons';
          font-style: normal;
          font-weight: 400;
          font-display: block;
          src: url(data:font/woff2;base64,d09GMgABAAAAAAGEAAwAAAAAAqgAAAE4AUuGJAAAAAAAAAAAAAAAAAAAAAAAAAAAGhQGYAA0EQgKeIERATYCJAMICwYABCAFBgcgG+gBAK4OOLw+Xhwpa+Y9i+JF9nNZBNFaWT3PHGJFDogWZMLGELIRsTHihAyw3J4rDWaWadv8WdtHlAi5wPnPrqvDAw08x0QmGCaYaWSBB1xAQX7Bu41B9hRHRqsmgXZACCGpj69xTQOxMQ5gjZ//NeIUSUMdr9p6YNU+x340/GiIz9VmxjIExPwQEwQS6tCvTqBfvQmoVy/40VDRpa4FICoSSKAeCZMxF9AOSCOtvH7cn+X3300rslcfRpfFnafTy/LhxZE8L4siy/KszLv65qg5MHx90j8nVlBb/k/K2CU1c64PLD15fMbxwTU+37v7Qt+iASLZ4IWDy2rMUuiqSnMiQWw4M2V6j7t2di38qy2B2uwjqrZUV6Wz8QXNEgjepNKxCyIK8GFKSEt1CSSfdILQ3KiOVGUEAA==) format('woff2');
        }
        .rh-fas, .rh-far {
          -moz-osx-font-smoothing: grayscale;
          -webkit-font-smoothing: antialiased;
          display: inline-block;
          font-style: normal;
          font-variant: normal;
          text-rendering: auto;
          line-height: 1;
        }
        .rh-fas { font-family: 'RH Icons'; font-weight: 900; }
        .rh-far { font-family: 'RH Icons'; font-weight: 400; }
        .rh-fa-star::before { content: "\\f005"; }
        .rh-fa-star-half-alt::before { content: "\\f5c0"; }
        .rh-fa-check-circle::before { content: "\\f058"; }
        .rh-fa-thumbs-up::before { content: "\\f164"; }
        .rh-fa-thumbs-down::before { content: "\\f165"; }

        /* Loading state */
        .reviewhub-wall-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px 20px;
          text-align: center;
          color: #6B7280;
        }
        .reviewhub-wall-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(107, 114, 128, 0.2);
          border-top-color: var(--wall-theme-color, #3B82F6);
          border-radius: 50%;
          animation: rh-wall-spin 0.8s linear infinite;
        }
        @keyframes rh-wall-spin {
          to { transform: rotate(360deg); }
        }

        /* Error state */
        .reviewhub-wall-error {
          padding: 40px 20px;
          text-align: center;
          background-color: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          border-radius: 12px;
          font-weight: 500;
        }
        .reviewhub-wall-error-title {
          font-size: 1.1em;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .reviewhub-wall-error-message {
          font-size: 0.9em;
          opacity: 0.9;
        }
        .reviewhub-wall-widget-container .reviewhub-wall-retry-button {
          all: unset;
          margin-top: 16px;
          background-color: #DC2626;
          color: #FFFFFF;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.9em;
        }
        .reviewhub-wall-widget-container .reviewhub-wall-retry-button:hover {
          background-color: #B91C1C;
        }

        /* The wall. Each lane's track holds its cards twice over, in two identical
           groups. Sliding the track by exactly one group (-50%) puts the second group
           where the first started, so the loop restarts without a visible jump. */
        .rh-wall-viewport {
          display: flex;
          gap: var(--wall-gap);
          overflow: hidden;
        }
        .rh-wall-vertical .rh-wall-viewport {
          -webkit-mask-image: linear-gradient(to bottom, transparent, #000 var(--wall-fade), #000 calc(100% - var(--wall-fade)), transparent);
          mask-image: linear-gradient(to bottom, transparent, #000 var(--wall-fade), #000 calc(100% - var(--wall-fade)), transparent);
        }
        .rh-wall-horizontal .rh-wall-viewport {
          flex-direction: column;
          -webkit-mask-image: linear-gradient(to right, transparent, #000 var(--wall-fade), #000 calc(100% - var(--wall-fade)), transparent);
          mask-image: linear-gradient(to right, transparent, #000 var(--wall-fade), #000 calc(100% - var(--wall-fade)), transparent);
        }
        .rh-wall-lane {
          position: relative;
          min-width: 0;
          overflow: hidden;
        }
        .rh-wall-vertical .rh-wall-lane {
          flex: 1 1 0;
        }
        .rh-wall-track {
          display: flex;
          animation-duration: 60s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .rh-wall-vertical .rh-wall-track {
          flex-direction: column;
          animation-name: rh-wall-up;
        }
        .rh-wall-horizontal .rh-wall-track {
          width: max-content;
          animation-name: rh-wall-left;
        }
        .rh-wall-track.rh-wall-reverse {
          animation-direction: reverse;
        }
        .rh-wall-group {
          display: flex;
          flex-shrink: 0;
          gap: var(--wall-gap);
        }
        /* The trailing gap belongs to the group so both groups are exactly the same size. */
        .rh-wall-vertical .rh-wall-group {
          flex-direction: column;
          padding-bottom: var(--wall-gap);
        }
        .rh-wall-horizontal .rh-wall-group {
          padding-right: var(--wall-gap);
        }
        @keyframes rh-wall-up {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, -50%, 0); }
        }
        @keyframes rh-wall-left {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }

        /* Hold still while someone is reading. Hover only where there is a real pointer:
           on a touch screen :hover sticks after a tap and the wall would never restart. */
        @media (hover: hover) {
          .rh-wall:hover .rh-wall-track {
            animation-play-state: paused;
          }
        }
        /* Its own rule: a browser without :has() drops every selector in a rule it can't parse. */
        .rh-wall:has(:focus-visible) .rh-wall-track {
          animation-play-state: paused;
        }

        /* No motion: a still wall whose lanes scroll by hand, without the repeats. */
        @media (prefers-reduced-motion: reduce) {
          .rh-wall-track {
            animation: none;
          }
          .rh-wall-group[aria-hidden="true"],
          .rh-wall-card[aria-hidden="true"] {
            display: none;
          }
          .rh-wall-vertical .rh-wall-viewport,
          .rh-wall-horizontal .rh-wall-viewport {
            -webkit-mask-image: none;
            mask-image: none;
          }
          .rh-wall-vertical .rh-wall-lane {
            overflow-y: auto;
          }
          .rh-wall-horizontal .rh-wall-lane {
            overflow-x: auto;
          }
        }

        /* Cards */
        .rh-wall-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 22px;
          border-radius: 16px;
          background: #FFFFFF;
          border: 1px solid #EDEFF2;
          box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 14px rgba(16, 24, 40, 0.05);
          color: #111827;
          text-align: left;
        }
        .rh-wall-horizontal .rh-wall-card {
          width: var(--wall-card-width, ${S.CARD_WIDTH}px);
          flex-shrink: 0;
        }
        .rh-wall-card-rating {
          display: flex;
          gap: 3px;
          color: #F5B50A;
          font-size: 0.85rem;
          line-height: 1;
        }
        .rh-wall-recommendation {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          line-height: 1;
        }
        .rh-wall-recommended {
          color: #16A34A;
        }
        .rh-wall-not-recommended {
          color: #DC2626;
        }
        .rh-wall-card-text {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 7;
          overflow: hidden;
          font-size: 0.95rem;
          line-height: 1.6;
          color: #1F2937;
          overflow-wrap: break-word;
        }
        .rh-wall-horizontal .rh-wall-card-text {
          -webkit-line-clamp: 4;
        }
        .reviewhub-wall-widget-container .rh-wall-read-more {
          all: unset;
          align-self: flex-start;
          margin-top: -6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .reviewhub-wall-widget-container .rh-wall-read-more:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
          border-radius: 2px;
        }
        .rh-wall-card-footer {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: auto;
          min-width: 0;
        }
        .rh-wall-card-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--wall-theme-color, #3B82F6);
          color: var(--wall-theme-ink, #FFFFFF);
          font-size: 0.85rem;
          font-weight: 600;
        }
        .rh-wall-card-author {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .rh-wall-card-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rh-wall-card-date {
          font-size: 0.78rem;
          color: #6B7280;
        }
        .reviewhub-wall-widget-container .rh-wall-card-source {
          display: block;
          width: 18px;
          height: 18px;
          max-width: none;
          margin: 0 0 0 auto;
          padding: 0;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          flex-shrink: 0;
        }

        /* Dark cards, for dark sites */
        .reviewhub-wall-widget-container.rh-wall-dark {
          color: #F3F4F6;
        }
        .rh-wall-dark .rh-wall-card {
          background: #17191F;
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: none;
          color: #F3F4F6;
        }
        .rh-wall-dark .rh-wall-card-text {
          color: #E5E7EB;
        }
        .rh-wall-dark .rh-wall-card-name {
          color: #F9FAFB;
        }
        .rh-wall-dark .rh-wall-card-date,
        .rh-wall-dark .reviewhub-wall-loading {
          color: #9CA3AF;
        }
        /* Keeps a dark brand colour's avatar visible against a dark card. */
        .rh-wall-dark .rh-wall-card-avatar {
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16);
        }

        /* Full review modal */
        .reviewhub-wall-modal-overlay {
          position: fixed;
          inset: 0;
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
        .reviewhub-wall-modal-overlay.visible {
          opacity: 1;
          visibility: visible;
        }
        .reviewhub-wall-modal {
          background: #FFFFFF;
          color: #111827;
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
          line-height: 1.5;
          text-align: left;
          box-sizing: border-box;
        }
        .reviewhub-wall-modal-overlay.visible .reviewhub-wall-modal {
          transform: scale(1) translateY(0);
        }
        .reviewhub-wall-modal .reviewhub-wall-modal-close {
          all: unset;
          position: absolute;
          top: 20px;
          right: 20px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #F3F4F6;
          color: #6B7280;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }
        .reviewhub-wall-modal .reviewhub-wall-modal-close:hover {
          background: #E5E7EB;
          color: #374151;
        }
        .reviewhub-wall-modal .reviewhub-wall-modal-close:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }
        .reviewhub-wall-modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          padding-right: 44px;
          border-bottom: 1px solid #F1F5F9;
        }
        .reviewhub-wall-modal .rh-wall-card-avatar {
          width: 56px;
          height: 56px;
          font-size: 1.2rem;
        }
        .reviewhub-wall-modal-author {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .reviewhub-wall-modal-name {
          font-size: 1.15rem;
          font-weight: 600;
        }
        .reviewhub-wall-modal-date {
          font-size: 0.9rem;
          color: #6B7280;
        }
        .reviewhub-wall-modal-content {
          font-size: 1rem;
          line-height: 1.7;
          color: #374151;
          overflow-wrap: break-word;
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal {
          background: #17191F;
          color: #F9FAFB;
          border-color: rgba(255, 255, 255, 0.08);
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal-header {
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal-content {
          color: #E5E7EB;
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal-date {
          color: #9CA3AF;
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal-close {
          background: rgba(255, 255, 255, 0.08);
          color: #D1D5DB;
        }
        .reviewhub-wall-modal-overlay.rh-wall-dark .reviewhub-wall-modal-close:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #FFFFFF;
        }

        @media (max-width: 640px) {
          .rh-wall-card {
            padding: 18px;
          }
          .rh-wall-card-text {
            font-size: 0.9rem;
          }
          .reviewhub-wall-modal {
            padding: 24px;
            border-radius: 16px;
          }
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
                  const httpError = new Error(`HTTP ${res.status}: ${res.statusText}`); httpError.status = res.status; throw httpError;
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
          // A 4xx (widget not found, deactivated) will not change on a retry.
          if (error && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
          attempt++;
          if (attempt > retries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1)));
        }
      }
    },

    fetchReviews: async function (config) {
      const params = new URLSearchParams();
      params.append('limit', CONFIG.WALL_SETTINGS.FETCH_LIMIT.toString());
      params.append('offset', '0');
      params.append('layout', 'wall');
      if (config.nocache) params.append('nocache', 'true');
      if (config.t) params.append('t', config.t);

      const apiUrl = `${CONFIG.API_DOMAIN}/api/public/widget-data/${config.widgetId}?${params.toString()}`;
      return await this.fetchWithRetry(apiUrl);
    },

    showError: function (container, retryCallback) {
      container.innerHTML = `
        <div class="reviewhub-wall-error">
          <div class="reviewhub-wall-error-title">⚠️ Oops! Something went wrong.</div>
          <div class="reviewhub-wall-error-message">We couldn't load the reviews at the moment. Please try again later.</div>
          ${retryCallback ? '<button type="button" class="reviewhub-wall-retry-button">Try Again</button>' : ''}
        </div>
      `;
      if (retryCallback) {
        const retryButton = container.querySelector('.reviewhub-wall-retry-button');
        if (retryButton) {
          retryButton.addEventListener('click', (e) => {
            e.preventDefault();
            retryCallback();
          });
        }
      }
    },

    /**
     * One review card. `clone` marks the copies that exist only to keep the loop
     * seamless: hidden from screen readers and out of the tab order, but still
     * clickable, since they are on screen half the time.
     */
    renderCard: function (review, index, clone, clamped, state) {
      const { widgetSettings } = state;
      const author = this.escapeHtml(review.author || 'Anonymous');
      const date = widgetSettings.showDates !== false ? this.formatDate(review.postedAt) : '';
      const content = this.escapeHtml(this.stripHtml(review.content || review.text || ''));
      const source = this.detectReviewSource(review, widgetSettings);
      const platformName = source === 'facebook' ? 'Facebook' : 'Google';

      let ratingHtml = '';
      if (widgetSettings.showRatings !== false) {
        const rating = parseFloat(review.rating) || 0;
        if (source === 'facebook') {
          ratingHtml = this.generateRecommendationStatus(review);
        } else if (rating > 0) {
          ratingHtml = `<div class="rh-wall-card-rating" role="img" aria-label="Rated ${rating} out of 5">${this.generateStars(rating)}</div>`;
        }
      }

      const avatarHtml = widgetSettings.showProfilePictures !== false
        ? `<div class="rh-wall-card-avatar">${this.escapeHtml(this.escapeHtml(this.getInitials(review.author)))}</div>`
        : '';

      const readMoreHtml = clamped && clamped.has(index)
        ? `<button type="button" class="rh-wall-read-more" data-review-index="${index}"${clone ? ' tabindex="-1"' : ''}>Read more</button>`
        : '';

      return `
        <div class="rh-wall-card" data-review-index="${index}"${clone ? ' aria-hidden="true"' : ''}>
          ${ratingHtml}
          <div class="rh-wall-card-text">“${content}”</div>
          ${readMoreHtml}
          <div class="rh-wall-card-footer">
            ${avatarHtml}
            <div class="rh-wall-card-author">
              <span class="rh-wall-card-name">${author}</span>
              ${date ? `<span class="rh-wall-card-date">${this.escapeHtml(date)}</span>` : ''}
            </div>
            <img class="rh-wall-card-source" src="${this.getPlatformLogo(source)}" alt="${platformName}" width="18" height="18">
          </div>
        </div>
      `;
    },

    /**
     * Deals the reviews into lanes and sizes each lane's loop. Runs again whenever the
     * width changes, because card heights (and how many lanes fit) follow the width.
     */
    layoutWall: function (state) {
      const S = CONFIG.WALL_SETTINGS;
      const { viewport, reviews, settings } = state;
      const vertical = settings.direction === 'vertical';
      const width = viewport.clientWidth;

      // Hidden (a closed tab or accordion). The ResizeObserver lays it out once it has a size.
      if (!width) return;
      state.width = width;

      let laneCount = settings.lanes;
      if (vertical) {
        const fits = Math.floor((width + S.GAP) / (S.MIN_COLUMN_WIDTH + S.GAP));
        laneCount = Math.max(1, Math.min(laneCount, fits));
      }
      viewport.style.setProperty(
        '--wall-card-width',
        (width < S.NARROW_VIEWPORT ? S.CARD_WIDTH_NARROW : S.CARD_WIDTH) + 'px'
      );

      // Round-robin, so each lane gets a different mix. With fewer reviews than lanes,
      // an empty lane takes the whole list from a different starting point.
      const lanes = [];
      for (let i = 0; i < laneCount; i++) lanes.push([]);
      reviews.forEach((review, index) => lanes[index % laneCount].push(index));
      lanes.forEach((lane, i) => {
        if (lane.length === 0) {
          for (let j = 0; j < reviews.length; j++) lane.push((i + j) % reviews.length);
        }
      });

      const cards = (lane, clone, clamped) =>
        lane.map(index => this.renderCard(reviews[index], index, clone, clamped, state)).join('');

      // Pass 1: one copy of each lane, to measure it.
      viewport.innerHTML = lanes.map(lane =>
        `<div class="rh-wall-lane"><div class="rh-wall-track"><div class="rh-wall-group">${cards(lane, false, null)}</div></div></div>`
      ).join('');

      // Only offer "Read more" where the line clamp actually cut the text short at this width.
      const clamped = new Set();
      viewport.querySelectorAll('.rh-wall-card').forEach(card => {
        const text = card.querySelector('.rh-wall-card-text');
        if (text && text.scrollHeight > text.clientHeight + 1) {
          clamped.add(Number(card.getAttribute('data-review-index')));
        }
      });

      // The loop slides one group out as its copy slides in, so a group shorter than the
      // viewport would leave a gap. Repeat a short lane until one group fills the view.
      const visible = vertical ? viewport.clientHeight : width;
      const repeats = Array.prototype.map.call(viewport.querySelectorAll('.rh-wall-group'), group => {
        const size = vertical ? group.offsetHeight : group.offsetWidth;
        return size > 0 ? Math.max(1, Math.ceil(visible / size)) : 1;
      });

      // Pass 2: each lane as its cards repeated, then all of that again for the loop.
      viewport.innerHTML = lanes.map((lane, i) => {
        let group = cards(lane, false, clamped);
        let copy = cards(lane, true, clamped);
        for (let r = 1; r < repeats[i]; r++) {
          group += cards(lane, true, clamped);
          copy += cards(lane, true, clamped);
        }
        // Alternate lanes run the other way.
        return `<div class="rh-wall-lane"><div class="rh-wall-track${i % 2 === 1 ? ' rh-wall-reverse' : ''}">` +
          `<div class="rh-wall-group">${group}</div><div class="rh-wall-group" aria-hidden="true">${copy}</div>` +
          `</div></div>`;
      }).join('');

      // Duration from the distance travelled, so every lane moves at the same speed. The
      // negative delay starts each lane part-way through its loop, so the wall doesn't
      // open as a grid with every lane's first card lined up.
      viewport.querySelectorAll('.rh-wall-track').forEach((track, i) => {
        const group = track.firstElementChild;
        const size = vertical ? group.offsetHeight : group.offsetWidth;
        const duration = Math.max(size / settings.speed, 1);
        track.style.animationDuration = duration.toFixed(2) + 's';
        track.style.animationDelay = (-duration * ((i * 0.37) % 1)).toFixed(2) + 's';
      });
    },

    mountWall: function (container, data, config, settings) {
      const widgetSettings = data.widgetSettings || {};
      const reviews = this.filterReviews(data.reviews || [], widgetSettings) || [];
      const themeColor = config.themeColor || widgetSettings.themeColor || '#3B82F6';

      container.style.setProperty('--wall-theme-color', themeColor);
      container.style.setProperty('--wall-theme-ink', this.isLightColor(themeColor) ? '#111827' : '#FFFFFF');

      if (reviews.length === 0) {
        container.innerHTML = '<div class="reviewhub-wall-error"><div class="reviewhub-wall-error-title">No reviews to display.</div><div class="reviewhub-wall-error-message">Check back later or add some reviews!</div></div>';
        return;
      }

      const vertical = settings.direction === 'vertical';
      container.innerHTML = `
        <div class="rh-wall rh-wall-${settings.direction}" role="region" aria-label="Customer reviews">
          <div class="rh-wall-viewport"${vertical ? ` style="height: ${settings.height}px"` : ''}></div>
        </div>
      `;

      const state = {
        viewport: container.querySelector('.rh-wall-viewport'),
        reviews,
        widgetSettings,
        settings,
        width: 0
      };
      this.instances.set(container, state);
      this.layoutWall(state);

      // Only width changes matter. In horizontal mode laying out changes the height, so
      // reacting to height as well would loop.
      let timer = null;
      const relayout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (state.viewport.isConnected && state.viewport.clientWidth !== state.width) {
            this.layoutWall(state);
          }
        }, 150);
      };
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(relayout).observe(state.viewport);
      } else {
        window.addEventListener('resize', relayout);
      }

      // Measured with the fallback font if Inter hadn't arrived yet, and Inter wraps differently.
      if (document.fonts && document.fonts.status !== 'loaded') {
        document.fonts.ready.then(() => {
          if (state.viewport.isConnected) this.layoutWall(state);
        });
      }
    },

    /** "Read more" lives on cards that get re-rendered on every relayout, so listen once, higher up. */
    bindReadMore: function (container) {
      if (this.boundContainers.has(container)) return;
      this.boundContainers.add(container);

      container.addEventListener('click', (e) => {
        const button = e.target.closest ? e.target.closest('.rh-wall-read-more') : null;
        const state = this.instances.get(container);
        if (!button || !state) return;
        e.preventDefault();
        const review = state.reviews[Number(button.getAttribute('data-review-index'))];
        // detail is 0 for a click made from the keyboard: only then hand focus back on close.
        if (review) this.showReviewModal(review, state, e.detail === 0 ? button : null);
      });
    },

    showReviewModal: function (review, state, returnFocusTo) {
      if (document.querySelector('.reviewhub-wall-modal-overlay')) return;

      const { widgetSettings, settings } = state;
      const author = this.escapeHtml(review.author || 'Anonymous');
      const date = widgetSettings.showDates !== false ? this.formatDate(review.postedAt) : '';
      const content = this.escapeHtml(this.stripHtml(review.content || review.text || '')).replace(/\n/g, '<br>');
      const source = this.detectReviewSource(review, widgetSettings);
      const rating = parseFloat(review.rating) || 0;

      let ratingHtml = '';
      if (widgetSettings.showRatings !== false) {
        if (source === 'facebook') {
          ratingHtml = this.generateRecommendationStatus(review);
        } else if (rating > 0) {
          ratingHtml = `<div class="rh-wall-card-rating" role="img" aria-label="Rated ${rating} out of 5">${this.generateStars(rating)}</div>`;
        }
      }

      const overlay = document.createElement('div');
      overlay.className = 'reviewhub-wall-modal-overlay' + (settings.theme === 'dark' ? ' rh-wall-dark' : '');
      // The overlay sits outside the widget container, so it needs the brand colour itself.
      overlay.style.setProperty('--wall-theme-color', state.viewport.closest('.reviewhub-wall-widget-container').style.getPropertyValue('--wall-theme-color'));
      overlay.style.setProperty('--wall-theme-ink', state.viewport.closest('.reviewhub-wall-widget-container').style.getPropertyValue('--wall-theme-ink'));
      overlay.innerHTML = `
        <div class="reviewhub-wall-modal" role="dialog" aria-modal="true" aria-label="Review by ${author}">
          <button type="button" class="reviewhub-wall-modal-close" aria-label="Close">&times;</button>
          <div class="reviewhub-wall-modal-header">
            ${widgetSettings.showProfilePictures !== false ? `<div class="rh-wall-card-avatar">${this.escapeHtml(this.escapeHtml(this.getInitials(review.author)))}</div>` : ''}
            <div class="reviewhub-wall-modal-author">
              <span class="reviewhub-wall-modal-name">${author}</span>
              ${date ? `<span class="reviewhub-wall-modal-date">${this.escapeHtml(date)}</span>` : ''}
              ${ratingHtml}
            </div>
          </div>
          <div class="reviewhub-wall-modal-content">${content}</div>
        </div>
      `;

      const previousOverflow = document.body.style.overflow;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      setTimeout(() => overlay.classList.add('visible'), 10);

      const closeButton = overlay.querySelector('.reviewhub-wall-modal-close');
      closeButton.focus({ preventScroll: true });

      const handleEscape = (e) => {
        if (e.key === 'Escape') closeModal();
      };
      const closeModal = () => {
        document.removeEventListener('keydown', handleEscape);
        overlay.classList.remove('visible');
        setTimeout(() => {
          overlay.remove();
          document.body.style.overflow = previousOverflow;
        }, 300);
        if (returnFocusTo && returnFocusTo.isConnected) {
          returnFocusTo.focus({ preventScroll: true });
        }
      };

      closeButton.addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      document.addEventListener('keydown', handleEscape);
    },

    loadWall: async function (container, config, settings) {
      container.innerHTML = `
        <div class="reviewhub-wall-loading"${settings.direction === 'vertical' ? ` style="min-height: ${settings.height}px"` : ''}>
          <div class="reviewhub-wall-spinner"></div>
          <div>Loading reviews...</div>
        </div>
      `;

      try {
        let data;

        // Check for pre-fetched data from widget.js
        const cache = window.ReviewHubMain && window.ReviewHubMain.dataCache;
        if (cache && cache.has(config.widgetId)) {
          try {
            data = await cache.get(config.widgetId);
          } catch (e) {
            // Fall through to a normal fetch.
          }
        }

        if (!data) {
          data = await this.fetchReviews(config);
        }

        if (!data || !data.reviews) {
          throw new Error('No reviews data received from API.');
        }
        this.mountWall(container, data, config, settings);
      } catch (error) {
        // Retry into the same container rather than creating another one.
        this.showError(container, () => this.loadWall(container, config, settings));
      }
    },

    initWidget: async function (userConfig) {
      const config = {
        widgetId: null,
        containerId: null,
        layout: 'wall',
        ...userConfig
      };
      const settings = this.resolveSettings(config);

      this.injectStyles();

      let container;
      if (config.containerId) {
        container = document.getElementById(config.containerId);
        if (!container) {
          const errDiv = document.createElement('div');
          errDiv.className = 'reviewhub-wall-widget-container';
          this.showError(errDiv, null);
          document.body.insertAdjacentElement('beforeend', errDiv);
          return;
        }
      } else if (config._scriptTag) {
        container = document.createElement('div');
        config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
      } else {
        return;
      }

      container.classList.add('reviewhub-wall-widget-container');
      container.classList.toggle('rh-wall-dark', settings.theme === 'dark');
      if (config.themeColor) {
        container.style.setProperty('--wall-theme-color', config.themeColor);
      }
      this.bindReadMore(container);

      if (!config.widgetId) {
        this.showError(container, null);
        return;
      }

      await this.loadWall(container, config, settings);
    },

    // Public init method
    init: function (userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;

      if (document.readyState === 'loading') {
        window.ReviewHubWall._pendingInitializations = window.ReviewHubWall._pendingInitializations || [];
        window.ReviewHubWall._pendingInitializations.push(config);
      } else {
        this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-wall.js"]');
    scriptTags.forEach(script => {
      // run() can fire more than once while the page loads; each tag gets one widget.
      if (window.ReviewHubWall.initializedScripts.has(script)) return;
      window.ReviewHubWall.initializedScripts.add(script);

      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || 'wall',
        direction: script.getAttribute('data-direction') || undefined,
        columns: script.getAttribute('data-columns') || undefined,
        rows: script.getAttribute('data-rows') || undefined,
        speed: script.getAttribute('data-speed') || undefined,
        height: script.getAttribute('data-height') || undefined,
        theme: script.getAttribute('data-theme') || undefined,
        nocache: script.getAttribute('data-nocache') === 'true',
        t: script.getAttribute('data-t') || undefined,
        _scriptTag: script
      };

      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
      window.ReviewHubWall.initWidget(config);
    });
  }

  function processPendingInitializations() {
    if (window.ReviewHubWall._pendingInitializations) {
      window.ReviewHubWall._pendingInitializations.forEach(config => window.ReviewHubWall.initWidget(config));
      delete window.ReviewHubWall._pendingInitializations;
    }
  }

  // Auto-run: Try immediately, then also on various ready states
  function run() {
    initializeWidgetsFromScripts();
    processPendingInitializations();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    run();
  } else {
    run();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);
  }
})();
