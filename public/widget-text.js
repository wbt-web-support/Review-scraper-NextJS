/**
 * ReviewHub Text layout: one line of text, such as "Over 300+ 4.9★ Google Reviews",
 * with the real numbers filled in. Made for WordPress and page builders, where a
 * full widget does not fit: it goes inside a heading, a paragraph or a button.
 *
 *   <span data-reviewhub-text="WIDGET_ID" data-text="Over {count}+ {rating}★ Google Reviews">Over 300+ 4.9★ Google Reviews</span>
 *   <script async src="https://reviews.kjgroup.uk/widget-text.js"></script>
 *
 * - {count} is the business's review count rounded DOWN to a tidy number, so it is
 *   never overstated: under 100 to tens, under 1,000 to fifties, then hundreds
 *   (326 reads 300, 161 reads 150, 1,240 reads 1,200).
 * - {rating} is the real average to one decimal (4.9; a 5.0 reads 5). For Facebook
 *   it is the share who recommend (98%).
 * - It takes the page's own font, size and colour; only the ★ is gold.
 * - The text inside the span is shown until the numbers arrive, and stays if they
 *   cannot be fetched, so the spot is never blank or broken.
 *
 * Its own attribute (data-reviewhub-text), not data-widget-id, so the other widget
 * scripts on the same page never mistake it for one of theirs. Pasted twice, it runs
 * once and fills every span.
 */
(function () {
  'use strict';

  if (window.ReviewHubText) {
    window.ReviewHubText.scan();
    return;
  }

  var script = document.currentScript;
  var BASE = (function () {
    try { return new URL(script && script.src ? script.src : '').origin; } catch (e) { return 'https://reviews.kjgroup.uk'; }
  })();
  var GOLD = '#FBBC04';
  var DEFAULTS = {
    google: 'Over {count}+ {rating}★ Google Reviews',
    facebook: 'Over {count}+ Facebook reviews, {rating} recommend',
  };
  var feeds = {};

  function tidyCount(n) {
    if (n < 10) return n;
    var step = n < 100 ? 10 : n < 1000 ? 50 : 100;
    return Math.floor(n / step) * step;
  }

  function formatRating(value, source) {
    if (value === undefined || value === null || value === '') return null;
    if (source === 'facebook') {
      var text = String(value);
      return text.indexOf('%') === -1 ? text + '%' : text;
    }
    var n = parseFloat(value);
    if (isNaN(n)) return null;
    var fixed = n.toFixed(1);
    return fixed.slice(-2) === '.0' ? fixed.slice(0, -2) : fixed;
  }

  function load(id) {
    if (!feeds[id]) {
      feeds[id] = fetch(BASE + '/api/public/widget-data/' + encodeURIComponent(id) + '?limit=1')
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        });
    }
    return feeds[id];
  }

  /** Text nodes and a gold span per star: no HTML is parsed, so nothing typed can run. */
  function paint(el, text) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var parts = text.split('★');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) el.appendChild(document.createTextNode(parts[i]));
      if (i < parts.length - 1) {
        var star = document.createElement('span');
        star.textContent = '★';
        star.style.color = GOLD;
        el.appendChild(star);
      }
    }
  }

  function fill(el) {
    var id = el.getAttribute('data-reviewhub-text');
    if (!id) return;
    el.setAttribute('data-reviewhub-done', '1');
    load(id).then(function (data) {
      var count = typeof data.totalReviewCount === 'number' ? data.totalReviewCount : null;
      var source = data.widgetSettings && data.widgetSettings.businessUrl && data.widgetSettings.businessUrl.source === 'facebook' ? 'facebook' : 'google';
      var rating = formatRating(data.averageRating, source);
      // No reviews yet: keep whatever the span already says rather than "Over 0+".
      if (!count) return;
      var template = el.getAttribute('data-text') || DEFAULTS[source];
      var text = template
        .replace(/\{count\}/g, tidyCount(count).toLocaleString('en-GB'))
        .replace(/\{rating\}/g, rating || '');
      paint(el, text.replace(/\s{2,}/g, ' ').trim());
    }).catch(function () {
      // Keep the text already in the span; never break the page it sits on.
    });
  }

  function scan() {
    var spans = document.querySelectorAll('[data-reviewhub-text]:not([data-reviewhub-done])');
    for (var i = 0; i < spans.length; i++) fill(spans[i]);
  }

  window.ReviewHubText = { scan: scan, tidyCount: tidyCount, formatRating: formatRating };
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  // Page builders sometimes add their blocks after the page has loaded.
  window.addEventListener('load', scan);
})();
