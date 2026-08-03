/**
 * Video Review Manager — embeddable widget.
 *
 *   <script src="https://your-host/w.js" data-tenant="EMBED_KEY" async></script>
 *
 * Vanilla JS. No React, no dependencies, no build step.
 *
 * Everything renders inside a shadow root. That is not a stylistic choice: this
 * script runs on websites we do not control, built by people we will never meet,
 * whose global CSS will happily do `div { box-sizing: content-box }` or
 * `* { font-family: Comic Sans }`. A shadow root is the only way to guarantee the
 * widget looks the same on all of them -- and equally, that we never leak styles
 * back out and break THEIR site.
 *
 * Videos load as click-to-play iframes. Embedding 24 Bunny players on page load
 * would tank the host page's Core Web Vitals, and the client would (rightly) blame
 * us for it.
 */
(function () {
  "use strict";

  /**
   * Find our own <script> tag.
   *
   * document.currentScript is right in the normal case, but it is null when the
   * script was injected via innerHTML or by a tag manager -- which is exactly what
   * some WordPress page builders do. Falling back to "the last script[data-tenant]
   * that hasn't been claimed yet" keeps the widget working there, and still
   * supports several widgets on one page.
   */
  function findScript() {
    if (document.currentScript && document.currentScript.getAttribute("data-tenant")) {
      return document.currentScript;
    }
    var candidates = document.querySelectorAll("script[data-tenant]");
    for (var i = candidates.length - 1; i >= 0; i--) {
      if (!candidates[i].dataset.reviewsInit) return candidates[i];
    }
    return null;
  }

  var script = findScript();
  if (!script) return;

  // Claim it, so a second copy of this script doesn't render the same widget twice.
  if (script.dataset.reviewsInit) return;
  script.dataset.reviewsInit = "1";

  var embedKey = script.getAttribute("data-tenant");
  if (!embedKey) {
    console.error("[reviews] Missing data-tenant on the widget script tag.");
    return;
  }

  // Derive the API origin from where this script was served, so the same file
  // works in dev, staging, production, and on a tenant's custom domain with no
  // configuration.
  //
  // The one case that breaks: a WordPress minify/cache plugin that copies this file
  // onto the host site as /wp-content/cache/min/1/w.js. The origin then points at a
  // server that answers 404 for /api/widget/<key>, and the widget just fails. The
  // rewritten path is the tell -- we are always served from the root -- so fall back
  // to the default host rather than hammering theirs.
  var DEFAULT_ORIGIN = "https://reviews.webuildtrades.com";
  var scriptUrl = new URL(script.src, window.location.href);
  var origin = scriptUrl.origin;
  if (scriptUrl.pathname !== "/w.js") {
    var override = (script.getAttribute("data-api-domain") || "").trim().replace(/\/+$/, "");
    origin = override || DEFAULT_ORIGIN;
    console.warn(
      "[reviews] Ignoring " + scriptUrl.href + " as the API origin: it looks like a cached " +
      "copy, and that host does not serve /api/widget. Using " + origin + ". Exclude w.js " +
      "from your minify/cache plugin."
    );
  }

  var layoutOverride = script.getAttribute("data-layout");

  var mount = document.createElement("div");

  /**
   * Where to render.
   *
   * The naive "insert right after the script tag" breaks in the single most common
   * way people install a snippet: pasting it into <head>. The widget then mounts
   * INSIDE <head>, which renders nothing at all, with no error -- it just silently
   * doesn't appear. So:
   *
   *   1. data-target="id"  -> render into that element. The explicit, recommended form.
   *   2. script is in <body> -> render right after it.
   *   3. anything else (head, or the script was moved by a CMS/tag manager)
   *      -> append to <body>, waiting for it to exist if the parser hasn't got there yet.
   */
  function mountWidget() {
    var targetId = script.getAttribute("data-target");

    if (targetId) {
      var target = document.getElementById(targetId);
      if (target) {
        target.appendChild(mount);
        return true;
      }
      // The target may not be parsed yet; fall through and retry on DOM ready.
      if (document.readyState === "loading") return false;
      console.error('[reviews] No element with id "' + targetId + '". Falling back to the end of the page.');
    }

    var parent = script.parentNode;
    if (parent && parent !== document.head && document.body && document.body.contains(script)) {
      parent.insertBefore(mount, script.nextSibling);
      return true;
    }

    if (document.body) {
      document.body.appendChild(mount);
      return true;
    }

    return false;
  }

  if (!mountWidget()) {
    document.addEventListener("DOMContentLoaded", function () {
      mountWidget();
    });
  }

  var root = mount.attachShadow({ mode: "open" });

  var CSS = [
    ":host{all:initial;display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#2d2d2a}",
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}",
    ".rail{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch}",
    ".rail::-webkit-scrollbar{height:6px}",
    ".rail::-webkit-scrollbar-thumb{background:#d4d4c8;border-radius:3px}",
    ".rail .card{flex:0 0 280px;scroll-snap-align:start}",
    ".single .card{max-width:560px;margin:0 auto}",
    ".card{background:#fff;border:1px solid #e6e6dd;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px}",
    ".head{display:flex;align-items:center;justify-content:space-between;gap:10px}",
    ".name{font-weight:600;font-size:14px}",
    ".date{font-size:12px;color:#6f6f66}",
    ".stars{display:flex;gap:2px}",
    ".stars svg{width:15px;height:15px}",
    ".quote{font-size:14px;color:#2d2d2a;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".media{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#2d2d2a;cursor:pointer;border:0;padding:0;width:100%;display:block}",
    ".media img{width:100%;height:100%;object-fit:cover;display:block}",
    ".media iframe,.media video{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}",
    ".play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);transition:background .2s}",
    ".media:hover .play{background:rgba(0,0,0,.4)}",
    ".play span{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center}",
    ".play svg{width:20px;height:20px;margin-left:3px}",
    ".empty{padding:28px;text-align:center;color:#6f6f66;font-size:14px;border:1px dashed #d4d4c8;border-radius:14px}",
    ".cta{margin-top:20px;display:flex;justify-content:center}",
    ".cta button,.cta a{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;border:0;cursor:pointer;font-family:inherit;text-decoration:none;transition:opacity .2s}",
    ".cta button:hover,.cta a:hover{opacity:.9}",
    ".cta svg{width:16px;height:16px}",
    "@media(prefers-reduced-motion:reduce){*{transition:none!important}}",
  ].join("");

  /**
   * The dialog lives in the HOST document, not the shadow root.
   *
   * position:fixed inside a shadow root is still relative to the viewport -- until
   * some ancestor of our mount point has a transform, filter, or perspective, which
   * makes it the containing block instead. On a stranger's website (animation
   * libraries, sticky headers, parallax themes) that is a coin flip, and the dialog
   * would end up clipped inside a page section.
   *
   * So it goes on <body>, which means it cannot use the shadow root's styles and
   * needs its own. Every class is vrm- prefixed and every property is !important:
   * this stylesheet is now living in the client's global CSS, and their
   * `div { position: static }` must not be able to break the modal.
   */
  var OVERLAY_CSS = [
    ".vrm-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(20,20,18,.6)!important;padding:16px!important;margin:0!important;opacity:0;transition:opacity .2s}",
    ".vrm-overlay.vrm-open{opacity:1}",
    ".vrm-modal{position:relative!important;width:100%!important;max-width:560px!important;height:min(90vh,760px)!important;background:#fff!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 24px 60px -12px rgba(0,0,0,.35)!important;display:flex!important;flex-direction:column!important;padding:0!important;margin:0!important}",
    ".vrm-modal iframe{flex:1!important;width:100%!important;height:100%!important;border:0!important;display:block!important;margin:0!important}",
    ".vrm-close{position:absolute!important;top:10px!important;right:10px!important;z-index:1!important;width:34px!important;height:34px!important;border-radius:50%!important;border:0!important;cursor:pointer!important;background:rgba(255,255,255,.92)!important;box-shadow:0 1px 4px rgba(0,0,0,.15)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important}",
    ".vrm-close svg{width:16px!important;height:16px!important}",
  ].join("");

  var overlayStyled = false;
  function ensureOverlayStyles() {
    if (overlayStyled) return;
    var style = document.createElement("style");
    style.setAttribute("data-vrm", "");
    style.textContent = OVERLAY_CSS;
    (document.head || document.documentElement).appendChild(style);
    overlayStyled = true;
  }

  function esc(value) {
    // Everything from the API is user-submitted (a reviewer typed it). Never
    // interpolate it into innerHTML unescaped -- that would be stored XSS on the
    // client's own website, which is about the worst thing this widget could do.
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function starsHtml(rating, color) {
    var out = "";
    for (var i = 1; i <= 5; i++) {
      var on = i <= rating;
      out +=
        '<svg viewBox="0 0 24 24" fill="' +
        (on ? color : "none") +
        '" stroke="' +
        (on ? color : "#d4d4c8") +
        '" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47L2.6 9.35l6.5-.95L12 2.5z"/></svg>';
    }
    return '<div class="stars" role="img" aria-label="' + rating + ' out of 5">' + out + "</div>";
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  // A Supabase-hosted video is a plain file; a Bunny one is an HLS stream that
  // needs Bunny's player.
  function isDirect(url) {
    return Boolean(url && url.indexOf("/storage/v1/object/public/") !== -1);
  }

  function cardHtml(review, color, libraryId) {
    var media = "";
    var playable =
      review.type === "video" &&
      review.video_guid &&
      (isDirect(review.video_url) || libraryId);

    if (playable) {
      var poster = review.thumbnail_url
        ? '<img src="' + esc(review.thumbnail_url) + '" alt="" loading="lazy">'
        : "";
      // Click-to-play either way. Embedding 24 players (iframe or <video
      // preload>) on page load would wreck the host page's Core Web Vitals, and
      // the client would rightly blame us.
      media =
        '<button class="media" data-video="' +
        esc(review.video_guid) +
        '" data-src="' +
        esc(review.video_url || "") +
        '" aria-label="Play video review from ' +
        esc(review.reviewer_name) +
        '">' +
        poster +
        '<span class="play"><span><svg viewBox="0 0 24 24" fill="#2d2d2a" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span>' +
        "</button>";
    }

    var quote = review.text_review
      ? '<p class="quote">' + esc(review.text_review) + "</p>"
      : "";

    return (
      '<article class="card">' +
      media +
      quote +
      '<div class="head"><div>' +
      '<div class="name">' +
      esc(review.reviewer_name) +
      "</div>" +
      '<div class="date">' +
      esc(fmtDate(review.created_at)) +
      "</div></div>" +
      starsHtml(review.rating, color) +
      "</div></article>"
    );
  }

  /**
   * "Leave a review" button, pointing at the tenant's collection page.
   *
   * On by default -- a testimonial wall that doesn't invite the next testimonial
   * is a wasted opportunity, and an empty widget with no call to action is just a
   * dead box. Opt out with data-cta="false".
   */
  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';

  /**
   * "Leave a review".
   *
   * openMode is set by the agency, not the tenant:
   *   dialog -> a <button> that opens the collection page in a modal, in place.
   *             The visitor never leaves the client's website, which is where the
   *             conversion is won. This is the default.
   *   page   -> a plain <a> to collectUrl (the tenant's verified custom domain if
   *             they have one, else our host), opened in a new tab. An anchor, not
   *             a scripted window.open, so middle-click and "open in new tab" work.
   */
  function ctaHtml(data, color) {
    if (script.getAttribute("data-cta") === "false") return "";

    if (data.openMode === "page") {
      return (
        '<div class="cta"><a href="' +
        esc(data.collectUrl) +
        '" target="_blank" rel="noopener" style="background:' +
        esc(color) +
        '">' +
        ICON +
        "Leave a review</a></div>"
      );
    }

    return (
      '<div class="cta"><button type="button" data-open-collect style="background:' +
      esc(color) +
      '">' +
      ICON +
      "Leave a review</button></div>"
    );
  }

  /**
   * The collection page, in a dialog on the host's own page.
   *
   * An iframe, because the collection page needs the camera and our own origin's
   * MediaRecorder logic -- reimplementing that inside the widget would mean
   * shipping the whole recorder to every embed.
   *
   * allow="camera; microphone" is what delegates those permissions to a
   * cross-origin frame. Without it the browser's default policy (`self`) silently
   * denies the camera and the reviewer just sees a dead "Turn on camera" button.
   */
  var overlay = null;

  function openCollect(url) {
    if (overlay) return;
    ensureOverlayStyles();

    overlay = document.createElement("div");
    overlay.className = "vrm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Leave a review");

    var modal = document.createElement("div");
    modal.className = "vrm-modal";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "vrm-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#2d2d2a" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    var frame = document.createElement("iframe");
    frame.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "embed=1";
    frame.setAttribute("allow", "camera; microphone");
    frame.setAttribute("title", "Leave a review");

    modal.appendChild(close);
    modal.appendChild(frame);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Stop the page behind from scrolling while the dialog is open.
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(function () {
      if (overlay) overlay.classList.add("vrm-open");
    });

    function shut() {
      if (!overlay) return;
      document.body.style.overflow = previousOverflow;
      overlay.remove();
      overlay = null;
      document.removeEventListener("keydown", onKey);
    }

    function onKey(event) {
      if (event.key === "Escape") shut();
    }

    close.addEventListener("click", shut);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) shut(); // backdrop only, not the modal
    });
    document.addEventListener("keydown", onKey);

    // The collection page posts this once the review is submitted, so the dialog
    // closes itself after the thank-you screen instead of stranding the visitor.
    //
    // The frame may be on OUR origin or on the tenant's custom domain, so accept
    // either -- but only those two. The message carries nothing we act on beyond
    // "close yourself", so an unexpected sender's blast radius is nil.
    var frameOrigin = new URL(frame.src, window.location.href).origin;

    window.addEventListener("message", function onMessage(event) {
      if (event.origin !== origin && event.origin !== frameOrigin) return;
      if (event.data && event.data.type === "vrm:submitted") {
        setTimeout(shut, 2200);
        window.removeEventListener("message", onMessage);
      }
    });
  }

  function render(data) {
    var color = data.tenant.brandColor || "#8a9a5b";
    var layout = layoutOverride || data.settings.layout || "grid";
    var libraryId = data.libraryId;

    var style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    var container = document.createElement("div");

    if (!data.reviews.length) {
      container.innerHTML =
        '<div class="empty">Be the first to leave a review.</div>' + ctaHtml(data, color);
    } else {
      var cls = layout === "carousel" ? "rail" : layout === "single" ? "single" : "grid";

      // The CTA sits outside the grid/rail, or it would become a grid cell / a
      // horizontally-scrolling card.
      var list = document.createElement("div");
      list.className = cls;
      list.innerHTML = data.reviews
        .map(function (r) {
          return cardHtml(r, color, libraryId);
        })
        .join("");
      container.appendChild(list);
      container.insertAdjacentHTML("beforeend", ctaHtml(data, color));
    }

    // Bound for BOTH states, and this is the whole point: the empty widget is the
    // one that most needs its "Leave a review" button to work, since a business
    // with no reviews yet is exactly who is trying to collect the first one.
    container.addEventListener("click", function (event) {
      if (!event.target.closest) return;

      // "Leave a review" -> open the collection page in a dialog, in place.
      if (event.target.closest("[data-open-collect]")) {
        openCollect(data.collectUrl);
        return;
      }

      // Click-to-play: swap the poster for a real player only when asked.
      var button = event.target.closest(".media");
      if (!button || !button.dataset.video) return;

      var src = button.dataset.src;
      var player;

      if (isDirect(src)) {
        // Supabase-hosted file: a plain <video> is all it needs.
        player = document.createElement("video");
        player.src = src;
        player.controls = true;
        player.autoplay = true;
        player.playsInline = true;
        player.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      } else {
        // Bunny HLS: use their player, since Chrome and Firefox cannot play HLS.
        player = document.createElement("iframe");
        player.src =
          "https://iframe.mediadelivery.net/embed/" +
          encodeURIComponent(libraryId) +
          "/" +
          encodeURIComponent(button.dataset.video) +
          "?autoplay=true";
        player.setAttribute(
          "allow",
          "accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen",
        );
        player.setAttribute("title", "Customer video review");
      }

      button.innerHTML = "";
      button.appendChild(player);
      button.style.cursor = "default";
    });

    root.appendChild(container);
  }

  fetch(origin + "/api/widget/" + encodeURIComponent(embedKey))
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      // Fail silently on the client's page. A broken widget must never render an
      // error box on a tradesperson's homepage.
      console.error("[reviews] Could not load reviews:", err);
    });
})();
