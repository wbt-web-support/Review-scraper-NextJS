/**
 * ReviewHub Summary layout: a compact block with the platform's logo, its stars,
 * the review count and a label, such as
 *
 *    [G]  ★★★★★
 *         327+
 *         Google reviews
 *
 *   <div id="reviewhub-summary-WIDGET_ID" class="reviewhub-summary" data-reviewhub-summary="WIDGET_ID"
 *        data-size="medium" data-caption="Local heating experts"></div>
 *   <script async src="https://reviews.kjgroup.uk/widget-summary.js"></script>
 *
 * - One platform per widget. For Google and Facebook side by side, place the
 *   client's two Summary widgets next to each other.
 * - The count is the real count of every review (the feed's allReviews), with a
 *   "+" (327+). Google shows its real average as stars (4.3 fills 4.3 stars);
 *   Facebook has no star rating, so it shows the share who recommend (98%).
 * - data-size: small, medium (default) or large. data-caption: an optional line
 *   underneath.
 * - A white box by default (background, padding, rounded corners); change it with
 *   site CSS on .reviewhub-summary, e.g. background: transparent.
 * - Takes the page's font. Every style is a zero-weight rule (:where), so a site's
 *   own CSS for these classes wins without !important. Classes: reviewhub-summary,
 *   rh-summary-logo, rh-summary-stars, rh-summary-count, rh-summary-label,
 *   rh-summary-caption. Each part also gets an id made from the box's id
 *   (reviewhub-summary-ID-count and so on), to style one exact element.
 * - Fresh within about a minute; if the numbers cannot be fetched, the box stays
 *   empty rather than showing anything wrong.
 *
 * Its own attribute (data-reviewhub-summary), so the other widget scripts on the
 * page never mistake it for theirs. Pasted twice, it runs once and fills every box.
 */
(function () {
  'use strict';

  if (window.ReviewHubSummary) {
    window.ReviewHubSummary.scan();
    return;
  }

  var script = document.currentScript;
  var BASE = (function () {
    try { return new URL(script && script.src ? script.src : '').origin; } catch (e) { return 'https://reviews.kjgroup.uk'; }
  })();
  var feeds = {};

  var LOGOS = {
    google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    facebook: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path fill="#fff" d="M26.6 38V25.9h4.1l.6-4.7h-4.7v-3c0-1.4.4-2.3 2.4-2.3h2.5v-4.2c-.4-.1-1.9-.2-3.6-.2-3.6 0-6 2.2-6 6.2v3.5h-4.1v4.7h4.1V38h4.7z"/></svg>',
  };

  // Zero specificity throughout, so any rule on the site beats it.
  var CSS = [
    ':where(.reviewhub-summary){display:inline-flex;flex-direction:column;align-items:center;gap:.35em;line-height:1.15;font-size:16px;background:#fff;padding:.8em 1.2em;border-radius:.75em;box-sizing:border-box}',
    ':where(.reviewhub-summary) :where(.rh-summary-row){display:flex;align-items:center;gap:.7em}',
    ':where(.reviewhub-summary) :where(.rh-summary-logo){flex:none;width:2.5em;height:2.5em}',
    ':where(.reviewhub-summary) :where(.rh-summary-logo svg){display:block;width:100%;height:100%}',
    ':where(.reviewhub-summary) :where(.rh-summary-body){display:flex;flex-direction:column;align-items:flex-start;gap:.15em}',
    ':where(.reviewhub-summary) :where(.rh-summary-stars){position:relative;display:inline-block;font-size:.95em;letter-spacing:.08em;color:#d1d5db;white-space:nowrap}',
    ':where(.reviewhub-summary) :where(.rh-summary-stars-fill){position:absolute;left:0;top:0;overflow:hidden;color:#FBBC04;white-space:nowrap}',
    ':where(.reviewhub-summary) :where(.rh-summary-recommend){font-size:.8em;font-weight:600;color:#1877F2}',
    ':where(.reviewhub-summary) :where(.rh-summary-count){font-size:1.35em;font-weight:700;color:#111827}',
    ':where(.reviewhub-summary) :where(.rh-summary-label){font-size:.8em;color:#4b5563}',
    ':where(.reviewhub-summary) :where(.rh-summary-caption){font-size:.75em;color:#6b7280;text-align:center}',
    // Nothing to show yet (loading, or the numbers could not be fetched): take no space,
    // rather than an empty white box.
    ':where(.reviewhub-summary:empty){display:none}',
    ':where(.reviewhub-summary.rh-summary--small){font-size:12px}',
    ':where(.reviewhub-summary.rh-summary--large){font-size:21px}',
  ].join('');

  function addStyle() {
    if (document.getElementById('reviewhub-summary-style')) return;
    var style = document.createElement('style');
    style.id = 'reviewhub-summary-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function load(id) {
    if (!feeds[id]) {
      feeds[id] = fetch(BASE + '/api/public/widget-data/' + encodeURIComponent(id) + '?limit=1&m=' + Math.floor(Date.now() / 60000))
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        });
    }
    return feeds[id];
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Five grey stars with gold laid over them, cut to the real rating (4.3 fills 86%). */
  function stars(rating) {
    var wrap = el('span', 'rh-summary-stars', '★★★★★');
    var fill = el('span', 'rh-summary-stars-fill', '★★★★★');
    fill.style.width = Math.max(0, Math.min(100, (rating / 5) * 100)) + '%';
    wrap.appendChild(fill);
    wrap.setAttribute('aria-label', rating.toFixed(1) + ' out of 5 stars');
    wrap.setAttribute('role', 'img');
    return wrap;
  }

  function fill(box) {
    var id = box.getAttribute('data-reviewhub-summary');
    if (!id) return;
    box.setAttribute('data-reviewhub-done', '1');
    if (box.classList && !box.classList.contains('reviewhub-summary')) box.classList.add('reviewhub-summary');
    var size = (box.getAttribute('data-size') || 'medium').toLowerCase();
    if (size === 'small' || size === 'large') box.classList.add('rh-summary--' + size);
    load(id).then(function (data) {
      var all = data.allReviews || {};
      var count = typeof all.count === 'number' ? all.count : typeof data.totalReviewCount === 'number' ? data.totalReviewCount : 0;
      if (!count) return;
      var source = data.widgetSettings && data.widgetSettings.businessUrl && data.widgetSettings.businessUrl.source === 'facebook' ? 'facebook' : 'google';
      var rating = all.rating !== undefined && all.rating !== null ? all.rating : data.averageRating;

      var row = el('div', 'rh-summary-row');
      var logo = el('span', 'rh-summary-logo');
      logo.innerHTML = LOGOS[source];
      var body = el('div', 'rh-summary-body');
      if (source === 'google') {
        var n = parseFloat(rating);
        if (!isNaN(n)) body.appendChild(stars(n));
      } else if (rating !== undefined && rating !== null && rating !== '') {
        var pct = String(rating);
        body.appendChild(el('span', 'rh-summary-recommend', (pct.indexOf('%') === -1 ? pct + '%' : pct) + ' recommend'));
      }
      body.appendChild(el('span', 'rh-summary-count', count.toLocaleString('en-GB') + '+'));
      body.appendChild(el('span', 'rh-summary-label', source === 'facebook' ? 'Facebook reviews' : 'Google reviews'));
      row.appendChild(logo);
      row.appendChild(body);

      while (box.firstChild) box.removeChild(box.firstChild);
      box.appendChild(row);
      var caption = box.getAttribute('data-caption');
      if (caption && caption.trim()) box.appendChild(el('div', 'rh-summary-caption', caption.trim()));
      // An id on every part, made from the box's own id, for styling one exact element.
      if (box.id) {
        var parts = ['logo', 'stars', 'recommend', 'count', 'label', 'caption'];
        for (var p = 0; p < parts.length; p++) {
          var part = box.querySelector('.rh-summary-' + parts[p]);
          if (part) part.id = box.id + '-' + parts[p];
        }
      }
    }).catch(function () {
      // Leave the box empty; never break the page it sits on.
    });
  }

  function scan() {
    var boxes = document.querySelectorAll('[data-reviewhub-summary]:not([data-reviewhub-done])');
    for (var i = 0; i < boxes.length; i++) fill(boxes[i]);
  }

  window.ReviewHubSummary = { scan: scan };
  addStyle();
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  // Page builders sometimes add their blocks after the page has loaded.
  window.addEventListener('load', scan);
})();
