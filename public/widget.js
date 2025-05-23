(function() {
  if (window.ReviewHub && window.ReviewHub.isInitialized) {
    return;
  }

  window.ReviewHub = {
    isInitialized: true,
    initWidget: function(config) {
      const container = document.getElementById(config.containerId);

      if (!container) {
        console.warn('ReviewHub: Container element for widget ' + config.widgetId + ' not found. Searched for ID: ' + config.containerId);
        return;
      }

      const appDomain = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
                        ? window.location.protocol + '//' + window.location.host
                        : 'YOUR_PRODUCTION_APP_URL'; 

      let iframeSrc = appDomain + '/embed/widget/' + config.widgetId;

      const params = new URLSearchParams();
      if (config.themeColor) params.append('themeColor', config.themeColor);
      if (config.layout) params.append('layout', config.layout);
      if (config.maxReviews) params.append('maxReviews', config.maxReviews);

      const queryString = params.toString();
      if (queryString) {
        iframeSrc += '?' + queryString;
      }

      const iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.title = config.name || 'ReviewHub Widget';
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.minHeight = '400px'; 
      iframe.loading = 'lazy';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowtransparency', 'true');

      container.innerHTML = '';
      container.appendChild(iframe);
    }
  };

  if (window.ReviewHubPendingWidgets && Array.isArray(window.ReviewHubPendingWidgets)) {
    window.ReviewHubPendingWidgets.forEach(function(pendingConfig) {
      window.ReviewHub.initWidget(pendingConfig);
    });
    window.ReviewHubPendingWidgets = []; 
  }
})();