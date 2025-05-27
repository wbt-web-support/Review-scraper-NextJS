(function() {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/reviewhub-widget.css'; 
  document.head.appendChild(link);
})();
import React from "react";
import { createRoot } from "react-dom/client";
import WidgetPreview from "../components/WidgetPreview";
import "../styles/globals.css"; 
(window as any).ReviewHub = (window as any).ReviewHub || {};
(window as any).ReviewHub.renderWidget = function (
  container: HTMLElement,
  props: any 
) {
  const root = createRoot(container);
  root.render(<WidgetPreview {...props} />);
};
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const script = document.querySelector('script[data-widget-id]');
    if (script) {
      const widgetId = script.getAttribute('data-widget-id');
      const container = document.createElement('div');
      script.parentNode?.insertBefore(container, script.nextSibling);
      fetch(`https://reviews.webuildtrades.com/api/public/widget-data/${widgetId}`)
        .then(res => res.json())
        .then(data => {
          (window as any).ReviewHub.renderWidget(container, {
            widget: data.widgetSettings,
            reviews: data.reviews,
            isLoadingReviews: false
          });
        });
    }
  });
} 