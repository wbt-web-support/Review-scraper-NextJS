(function() {
  if (window.ReviewHubMain && window.ReviewHubMain.isInitialized) {
    return;
  }

  const CONFIG = {
    API_DOMAIN: (function() {
      const scripts = document.querySelectorAll('script[src*="widget-main.js"]');
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

    log: function(level, message, data) {
      if (window.console && window.console[level]) {
        const prefix = `[ReviewHubMain v${this.version}]`;
        if (data) {
          console[level](prefix, message, data);
        } else {
          console[level](prefix, message);
        }
      }
    },

    // Dynamically load widget script
    loadWidgetScript: function(layout) {
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

        this.log('info', `Loading widget script for layout: ${layout}`, { file: widgetFile });

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
          script.src = `${CONFIG.API_DOMAIN}/${widgetFile}`;
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
                this.log('info', `Successfully loaded widget: ${layout}`);
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

    // Initialize widget with retry logic
    initWidget: async function(config) {
      const layout = config.layout || CONFIG.DEFAULT_LAYOUT;
      
      this.log('info', 'Initializing widget via main router', { layout, config });

      let attempt = 0;
      while (attempt < CONFIG.RETRY_ATTEMPTS) {
        try {
          // Load the appropriate widget script
          const WidgetClass = await this.loadWidgetScript(layout);
          
          // Initialize the widget
          if (WidgetClass && typeof WidgetClass.initWidget === 'function') {
            await WidgetClass.initWidget(config);
            this.log('info', `Widget initialized successfully: ${layout}`);
            return;
          } else if (WidgetClass && typeof WidgetClass.init === 'function') {
            WidgetClass.init(config);
            this.log('info', `Widget initialized successfully: ${layout}`);
            return;
          } else {
            throw new Error(`Widget class for ${layout} does not have init method`);
          }
        } catch (error) {
          attempt++;
          this.log('error', `Attempt ${attempt} failed for layout ${layout}`, { error: error.message });
          
          if (attempt >= CONFIG.RETRY_ATTEMPTS) {
            // Fallback to default layout if current layout fails
            if (layout !== CONFIG.DEFAULT_LAYOUT) {
              this.log('warn', `Falling back to default layout: ${CONFIG.DEFAULT_LAYOUT}`);
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

    // Show error when all attempts fail
    showError: function(config, error) {
      this.log('error', 'All widget initialization attempts failed', { config, error: error.message });
      
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
    init: function(userConfig) {
      const config = typeof userConfig === 'string' ? { widgetId: userConfig } : userConfig;
      
      if (document.readyState === 'loading') {
          window.ReviewHubMain._pendingInitializations = window.ReviewHubMain._pendingInitializations || [];
          window.ReviewHubMain._pendingInitializations.push(config);
      } else {
          this.initWidget(config);
      }
    }
  };

  // Auto-initialize widgets from script tags
  function initializeWidgetsFromScripts() {
    const scriptTags = document.querySelectorAll('script[data-widget-id][src*="widget-main.js"]');
    window.ReviewHubMain.log('info', `Found ${scriptTags.length} main widget script tag(s) for auto-initialization.`);
    
    scriptTags.forEach(script => {
      const config = {
        widgetId: script.getAttribute('data-widget-id'),
        containerId: script.getAttribute('data-container-id') || null,
        themeColor: script.getAttribute('data-theme-color') || undefined,
        layout: script.getAttribute('data-layout') || CONFIG.DEFAULT_LAYOUT,
        
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
      
      window.ReviewHubMain.initWidget(config);
    });
  }
  
  function processPendingInitializations() {
      if (window.ReviewHubMain._pendingInitializations) {
          window.ReviewHubMain._pendingInitializations.forEach(config => window.ReviewHubMain.initWidget(config));
          delete window.ReviewHubMain._pendingInitializations;
      }
  }

  // Support for direct widget creation
  window.ReviewHub = {
    create: function(config) {
      return window.ReviewHubMain.init(config);
    },
    
    // Backward compatibility aliases
    createCarousel: function(config) {
      return window.ReviewHubMain.init({ ...config, layout: 'carousel' });
    },
    
    createBadge: function(config) {
      return window.ReviewHubMain.init({ ...config, layout: 'badge' });
    },
    
    createGrid: function(config) {
      return window.ReviewHubMain.init({ ...config, layout: 'grid' });
    },
    
    createMasonry: function(config) {
      return window.ReviewHubMain.init({ ...config, layout: 'masonry' });
    },
    
    createList: function(config) {
      return window.ReviewHubMain.init({ ...config, layout: 'list' });
    }
  };

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