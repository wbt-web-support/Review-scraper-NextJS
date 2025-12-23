(function () {
  if (window.ReviewHubMain && window.ReviewHubMain.isInitialized) {
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
      return 'https://reviews.webuildtrades.com/'; // Default API domain
    })(),

    // Widget file mappings
    WIDGET_FILES: {
      'carousel': 'widget-new.js',
      'badge': 'widget-badge.js',
      'grid': 'widget-grid.js',
      'masonry': 'widget-masonry.js',
      'list': 'widget-list.js'
    },

    // Widget class mappings
    WIDGET_CLASSES: {
      'carousel': 'ReviewHubV2',
      'badge': 'ReviewHubBadge',
      'grid': 'ReviewHubGrid',
      'masonry': 'ReviewHubMasonry',
      'list': 'ReviewHubList'
    },

    DEFAULT_LAYOUT: 'carousel',
    SCRIPT_LOAD_TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3
  };

  window.ReviewHubMain = {
    isInitialized: true,
    version: '1.0.0',
    buildId: Date.now(),
    loadedWidgets: new Set(),
    pendingLoads: new Map(),

    log: function (level, message, data) {
      // Console logging disabled for production
    },

    // Dynamically load widget script
    loadWidgetScript: function (layout) {
      return new Promise((resolve, reject) => {
        const widgetFile = CONFIG.WIDGET_FILES[layout];
        const widgetClass = CONFIG.WIDGET_CLASSES[layout];

        if (!widgetFile) {
          reject(new Error(`Unknown layout: ${layout}`));
          return;
        }

        // Check if widget is already loaded
        if (this.loadedWidgets.has(layout) && window[widgetClass]) {
          resolve(window[widgetClass]);
          return;
        }

        // Check if already loading
        if (this.pendingLoads.has(layout)) {
          this.pendingLoads.get(layout).then(resolve).catch(reject);
          return;
        }

        // Create promise for this load
        const loadPromise = new Promise((resolveLoad, rejectLoad) => {
          // Check if script already exists
          const existingScript = document.querySelector(`script[src*="${widgetFile}"]`);
          if (existingScript && window[widgetClass]) {
            this.loadedWidgets.add(layout);
            resolveLoad(window[widgetClass]);
            return;
          }

          const script = document.createElement('script');
          script.src = `${CONFIG.API_DOMAIN}/${widgetFile}?v=${this.version}&t=${Date.now()}`;
          script.async = true;

          // Set up timeout
          const timeoutId = setTimeout(() => {
            rejectLoad(new Error(`Timeout loading ${widgetFile}`));
          }, CONFIG.SCRIPT_LOAD_TIMEOUT);

          script.onload = () => {
            clearTimeout(timeoutId);

            // Wait a bit for the widget to initialize
            setTimeout(() => {
              if (window[widgetClass]) {
                this.loadedWidgets.add(layout);
                resolveLoad(window[widgetClass]);
              } else {
                rejectLoad(new Error(`Widget class ${widgetClass} not found after loading ${widgetFile}`));
              }
            }, 100);
          };

          script.onerror = () => {
            clearTimeout(timeoutId);
            rejectLoad(new Error(`Failed to load ${widgetFile}`));
          };

          document.head.appendChild(script);
        });

        this.pendingLoads.set(layout, loadPromise);

        loadPromise
          .then((widgetClass) => {
            this.pendingLoads.delete(layout);
            resolve(widgetClass);
          })
          .catch((error) => {
            this.pendingLoads.delete(layout);
            reject(error);
          });
      });
    },

    // Preload common widget scripts for better performance
    preloadCommonWidgets: function () {
      // Preload badge and grid widgets as they're commonly used together
      const commonLayouts = ['badge', 'grid'];
      commonLayouts.forEach(layout => {
        // Start loading but don't wait for it
        this.loadWidgetScript(layout).catch(() => {
          // Silently fail preloading - widgets will load when needed
        });
      });
    },

    // Initialize widget with retry logic
    initWidget: async function (config) {
      const layout = config.layout || CONFIG.DEFAULT_LAYOUT;

      let attempt = 0;
      while (attempt < CONFIG.RETRY_ATTEMPTS) {
        try {
          // Load the appropriate widget script
          const WidgetClass = await this.loadWidgetScript(layout);

          // Initialize the widget
          if (WidgetClass && typeof WidgetClass.initWidget === 'function') {
            await WidgetClass.initWidget(config);
            return;
          } else if (WidgetClass && typeof WidgetClass.init === 'function') {
            WidgetClass.init(config);
            return;
          } else {
            throw new Error(`Widget class for ${layout} does not have init method`);
          }
        } catch (error) {
          attempt++;

          if (attempt >= CONFIG.RETRY_ATTEMPTS) {
            // Fallback to default layout if current layout fails
            if (layout !== CONFIG.DEFAULT_LAYOUT) {
              config.layout = CONFIG.DEFAULT_LAYOUT;
              return this.initWidget(config);
            } else {
              this.showError(config, error);
              return;
            }
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    },

    // Initialize multiple widgets in parallel
    initWidgetsParallel: async function (configs) {
      // Group configs by layout to load scripts efficiently
      const layoutGroups = new Map();
      configs.forEach(config => {
        const layout = config.layout || CONFIG.DEFAULT_LAYOUT;
        if (!layoutGroups.has(layout)) {
          layoutGroups.set(layout, []);
        }
        layoutGroups.get(layout).push(config);
      });

      // Load all required scripts in parallel
      const scriptLoadPromises = Array.from(layoutGroups.keys()).map(layout =>
        this.loadWidgetScript(layout)
      );

      try {
        // Wait for all scripts to load
        await Promise.all(scriptLoadPromises);

        // Initialize all widgets in parallel
        const initPromises = configs.map(config => this.initWidget(config));
        await Promise.allSettled(initPromises);

      } catch (error) {
        console.error('Error loading widgets in parallel:', error);
        // Fallback to sequential loading
        for (const config of configs) {
          try {
            await this.initWidget(config);
          } catch (widgetError) {
            console.error(`Failed to initialize widget ${config.widgetId}:`, widgetError);
          }
        }
      }
    },

    // Show error when all attempts fail
    showError: function (config, error) {
      let container;
      if (config.containerId) {
        container = document.getElementById(config.containerId);
      } else if (config._scriptTag) {
        container = document.createElement('div');
        config._scriptTag.parentNode.insertBefore(container, config._scriptTag.nextSibling);
      }

      if (container) {
        container.className = 'reviewhub-main-error-container';
        container.innerHTML = `
          <div style="
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px 20px;
            text-align: center;
            background-color: #FEF2F2;
            border: 1px solid #FECACA;
            color: #DC2626;
            border-radius: 12px;
            font-weight: 500;
          ">
            <div style="font-size: 1.1em; font-weight: 600; margin-bottom: 8px;">
              ⚠️ Widget Loading Failed
            </div>
            <div style="font-size: 0.9em; margin-bottom: 16px; opacity: 0.9;">
              Unable to load the review widget. Please try again later.
            </div>
            <button onclick="location.reload()" style="
              background-color: #DC2626;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 500;
              font-size: 0.9em;
              transition: all 0.2s ease;
            ">
              Retry
            </button>
          </div>
        `;
      }
    },

    // Public init method
    init: function (userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;

      if (document.readyState === 'loading') {
        window.ReviewHubMain._pendingInitializations = window.ReviewHubMain._pendingInitializations || [];
        window.ReviewHubMain._pendingInitializations.push(config);
      } else {
        this.initWidget(config);
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
        return '<div class="rh-main-recommendation-status rh-main-recommended"><i class="rh-fas rh-fa-thumbs-up"></i> Recommended</div>';
      } else if (recommendationStatus === 'not_recommended') {
        return '<div class="rh-main-recommendation-status rh-main-not-recommended"><i class="rh-fas rh-fa-thumbs-down"></i> Not Recommended</div>';
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
      if (userThemeColor && userThemeColor !== '#3B82F6') {
        return userThemeColor;
      }

      // Use platform-specific colors
      if (source === 'facebook') {
        return '#1877F2'; // Facebook blue
      } else {
        return '#4285F4'; // Google blue
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    // Find scripts with either attribute type
    const allScriptTags = document.querySelectorAll('script[src*="widget.js"]');
    const scriptTags = Array.from(allScriptTags).filter(script =>
      script.getAttribute('data-widget-id') || script.getAttribute('data-reviewhub-widget-id')
    );

    window.ReviewHubMain.log('info', `Found ${scriptTags.length} widget script tag(s) for auto-initialization.`);

    // Collect all widget configs first
    const widgetConfigs = [];

    scriptTags.forEach(script => {
      // Get layout first to determine which attribute to use
      const layout = script.getAttribute('data-layout') || CONFIG.DEFAULT_LAYOUT;

      // For carousel, prefer data-reviewhub-widget-id, for others prefer data-widget-id
      let widgetId;
      if (layout === 'carousel') {
        widgetId = script.getAttribute('data-reviewhub-widget-id') || script.getAttribute('data-widget-id');
      } else {
        widgetId = script.getAttribute('data-widget-id') || script.getAttribute('data-reviewhub-widget-id');
      }

      if (!widgetId) {
        window.ReviewHubMain.log('warn', 'Script tag found but no widget ID attribute present', { layout });
        return;
      }

      const config = {
        widgetId: widgetId,
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: layout,

        // Pass through all data attributes for specific widgets
        cardsToShowDesktop: script.getAttribute('data-cards-desktop') || undefined,
        cardsToShowTablet: script.getAttribute('data-cards-tablet') || undefined,
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

      // Filter out undefined values
      Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);

      // Ensure layout is passed to the widget
      if (!config.layout) {
        config.layout = CONFIG.DEFAULT_LAYOUT;
      }

      widgetConfigs.push(config);
    });

    // Initialize all widgets in parallel
    if (widgetConfigs.length > 0) {
      window.ReviewHubMain.initWidgetsParallel(widgetConfigs);
    }
  }

  function processPendingInitializations() {
    if (window.ReviewHubMain._pendingInitializations) {
      window.ReviewHubMain.initWidgetsParallel(window.ReviewHubMain._pendingInitializations);
      delete window.ReviewHubMain._pendingInitializations;
    }
  }

  // Support for direct widget creation
  window.ReviewHub = {
    create: function (config) {
      return window.ReviewHubMain.init(config);
    },

    // Backward compatibility aliases
    createCarousel: function (config) {
      return window.ReviewHubMain.init({ ...config, layout: 'carousel' });
    },

    createBadge: function (config) {
      return window.ReviewHubMain.init({ ...config, layout: 'badge' });
    },

    createGrid: function (config) {
      return window.ReviewHubMain.init({ ...config, layout: 'grid' });
    },

    createMasonry: function (config) {
      return window.ReviewHubMain.init({ ...config, layout: 'masonry' });
    },

    createList: function (config) {
      return window.ReviewHubMain.init({ ...config, layout: 'list' });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Start preloading common widgets
      window.ReviewHubMain.preloadCommonWidgets();
      initializeWidgetsFromScripts();
      processPendingInitializations();
    });
  } else {
    setTimeout(() => {
      // Start preloading common widgets
      window.ReviewHubMain.preloadCommonWidgets();
      initializeWidgetsFromScripts();
      processPendingInitializations();
    }, 0);
  }

})(); 