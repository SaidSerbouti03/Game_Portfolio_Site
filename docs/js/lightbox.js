// ══════════════════════════════════════════
// LIGHTBOX — click a screenshot, gif or CV page and it grows toward
// you; then zoom, pan and move between the images of the same gallery.
//
// Usage: one line at the end of any page (plus css/lightbox.css)
//   <script src="../js/lightbox.js"></script>
// The script builds its own markup.
//
// What becomes enlargeable, on any page:
//   - every image loaded from the assets folder (screenshots, gifs, photos)
//   - the pages of the CV viewer (the CV PDF is drawn as images)
//   - any image you mark with data-lightbox
// Opt out with data-no-lightbox. Images inside links, the sidebar and the
// top bar are left alone.
//
// Controls: wheel or pinch to zoom, drag to move, double click / double tap
// to toggle zoom, ← → to change image, + − 0 to zoom, Esc to close.
// ══════════════════════════════════════════

(function () {
  'use strict';

  // Name of the folder whose images can be enlarged
  var ASSETS_FOLDER = 'assets';

  // Images of the same gallery (or the pages of the CV) can be browsed together
  var GROUPS = '.cs-gallery, .cs-gallery2, .cv-pages';
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 6;
  var DOUBLE_TAP_MS = 300;

  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = reducedMotion ? 0 : 340;

  var ui = null;                 // built the first time it is needed
  var items = [];
  var index = 0;
  var trigger = null;
  var isOpen = false;
  var hiddenEl = null;
  var loadToken = 0;
  var closeToken = 0;
  var blobUrls = new WeakMap();

  var scale = 1;
  var panX = 0;
  var panY = 0;

  // ── Which elements count ──
  function inAssetsFolder(node) {
    try {
      var url = new URL(node.currentSrc || node.src, document.baseURI);
      return url.pathname.toLowerCase().split('/').indexOf(ASSETS_FOLDER) !== -1;
    } catch (e) {
      return false;
    }
  }

  function isTarget(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.tagName !== 'IMG' && node.tagName !== 'CANVAS') return false;
    if (node.closest('a, .lb, .sidebar, .mobile-bar') || node.hasAttribute('data-no-lightbox')) return false;
    if (node.hasAttribute('data-lightbox')) return true;
    if (node.tagName === 'CANVAS') return !!node.closest('.cv-pages');   // the CV pages
    return inAssetsFolder(node);
  }

  function decorate() {
    document.querySelectorAll('img, canvas').forEach(function (node) {
      if (node.hasAttribute('data-lb-ready') || !isTarget(node)) return;
      node.dataset.lbCaption = node.dataset.lbCaption ||
        node.getAttribute('alt') || node.getAttribute('aria-label') || '';
      node.setAttribute('data-lb-ready', '');
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', (node.dataset.lbCaption || 'Image') + ' — click to enlarge');
    });
  }

  function collectGroup(node) {
    var container = node.closest(GROUPS);
    if (!container) return [node];
    return Array.prototype.filter.call(container.querySelectorAll('img, canvas'), isTarget);
  }

  // Images use their own source; CV pages (canvas) are exported to an image
  function sourceUrl(node) {
    if (node.tagName !== 'CANVAS') return Promise.resolve(node.currentSrc || node.src);
    if (blobUrls.has(node)) return Promise.resolve(blobUrls.get(node));
    return new Promise(function (resolve, reject) {
      node.toBlob(function (blob) {
        if (!blob) { reject(new Error('Could not export the page')); return; }
        var url = URL.createObjectURL(blob);
        blobUrls.set(node, url);
        resolve(url);
      }, 'image/png');
    });
  }

  // ── Building the viewer ──
  function make(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function makeButton(className, label, ariaLabel) {
    var b = make('button', className);
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', ariaLabel);
    return b;
  }

  function build() {
    if (ui) return;

    var overlay = make('div', 'lb');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image viewer');
    overlay.hidden = true;

    var backdrop = make('div', 'lb-backdrop');
    var stage = make('div', 'lb-stage');
    var frame = make('div', 'lb-frame');
    var img = make('img', 'lb-img');
    img.alt = '';
    img.draggable = false;
    frame.appendChild(img);
    stage.appendChild(frame);

    var close = makeButton('lb-btn lb-close', '×', 'Close');
    var prev = makeButton('lb-btn lb-nav lb-prev', '‹', 'Previous image');
    var next = makeButton('lb-btn lb-nav lb-next', '›', 'Next image');

    var bar = make('div', 'lb-bar');
    var caption = make('p', 'lb-caption');
    var tools = make('div', 'lb-tools');
    var counter = make('span', 'lb-counter');
    var zoomOut = makeButton('lb-btn lb-small', '−', 'Zoom out');
    var zoomReset = makeButton('lb-btn lb-small lb-level', '100%', 'Reset zoom');
    var zoomIn = makeButton('lb-btn lb-small', '+', 'Zoom in');
    [counter, zoomOut, zoomReset, zoomIn].forEach(function (n) { tools.appendChild(n); });
    bar.appendChild(caption);
    bar.appendChild(tools);

    [backdrop, stage, close, prev, next, bar].forEach(function (n) { overlay.appendChild(n); });
    document.body.appendChild(overlay);

    ui = {
      overlay: overlay, stage: stage, frame: frame, img: img,
      close: close, prev: prev, next: next, caption: caption, counter: counter,
      zoomOut: zoomOut, zoomReset: zoomReset, zoomIn: zoomIn
    };

    bindEvents();
  }

  // ── Zoom and pan ──
  function applyTransform(animate) {
    ui.img.classList.toggle('is-animating', !!animate && DURATION > 0);
    ui.img.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    ui.overlay.classList.toggle('is-zoomed', scale > 1.001);
    ui.zoomReset.textContent = Math.round(scale * 100) + '%';
    ui.zoomOut.disabled = scale <= MIN_ZOOM + 0.001;
    ui.zoomIn.disabled = scale >= MAX_ZOOM - 0.001;
  }

  function clampPan() {
    if (scale <= 1.001) { panX = 0; panY = 0; return; }
    var w = ui.frame.offsetWidth * scale;
    var h = ui.frame.offsetHeight * scale;
    var maxX = Math.max(0, (w - ui.stage.clientWidth) / 2);
    var maxY = Math.max(0, (h - ui.stage.clientHeight) / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  }

  // Zoom keeping the point under (cx, cy) in place
  function zoomTo(next, cx, cy, animate) {
    next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    var r = ui.frame.getBoundingClientRect();
    var ox = cx - (r.left + r.width / 2);
    var oy = cy - (r.top + r.height / 2);
    var ratio = next / scale;
    panX = ox - (ox - panX) * ratio;
    panY = oy - (oy - panY) * ratio;
    scale = next;
    clampPan();
    applyTransform(animate);
  }

  function zoomFromCenter(factor) {
    zoomTo(scale * factor, window.innerWidth / 2, window.innerHeight / 2, true);
  }

  function resetZoom(animate) {
    scale = 1; panX = 0; panY = 0;
    applyTransform(animate);
  }

  // ── Showing an image ──
  function setHidden(node) {
    if (hiddenEl) hiddenEl.style.visibility = '';
    hiddenEl = node;
    if (node) node.style.visibility = 'hidden';
  }

  function whenLoaded(url, callback) {
    var done = false;
    function finish() { if (!done) { done = true; callback(); } }
    ui.img.onload = finish;
    ui.img.onerror = finish;
    ui.img.src = url;
    if (ui.img.complete && ui.img.naturalWidth) finish();
  }

  function show(i, opening) {
    var item = items[i];
    index = i;
    resetZoom(false);

    ui.frame.style.transition = 'none';
    ui.frame.style.transform = 'none';
    ui.frame.style.opacity = '0';
    setHidden(null);

    ui.caption.textContent = item.dataset.lbCaption || '';
    ui.caption.hidden = !ui.caption.textContent;
    ui.counter.textContent = items.length > 1 ? (i + 1) + ' / ' + items.length : '';
    ui.prev.hidden = ui.next.hidden = items.length < 2;
    ui.prev.disabled = i === 0;
    ui.next.disabled = i === items.length - 1;

    var token = ++loadToken;
    sourceUrl(item).then(function (url) {
      if (token !== loadToken || !isOpen) return;
      whenLoaded(url, function () {
        if (token !== loadToken || !isOpen) return;
        reveal(item, opening);
      });
    }).catch(function () {
      if (token === loadToken) close();
    });
  }

  // From the thumbnail's place and size to the enlarged one (and back)
  function offsetFrom(sourceRect) {
    var to = ui.frame.getBoundingClientRect();
    return {
      dx: sourceRect.left + sourceRect.width / 2 - (to.left + to.width / 2),
      dy: sourceRect.top + sourceRect.height / 2 - (to.top + to.height / 2),
      k: Math.max(0.05, sourceRect.width / to.width)
    };
  }

  function reveal(item, opening) {
    var f = ui.frame;
    var from = item.getBoundingClientRect();

    if (!DURATION) {
      f.style.opacity = '1';
    } else if (opening && from.width > 0) {
      var o = offsetFrom(from);
      f.style.opacity = '1';
      f.style.transform = 'translate(' + o.dx + 'px,' + o.dy + 'px) scale(' + o.k + ')';
      void f.offsetWidth;
      f.style.transition = 'transform ' + DURATION + 'ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      f.style.transform = 'none';
    } else {
      void f.offsetWidth;
      f.style.transition = 'opacity 220ms ease';
      f.style.opacity = '1';
    }
    setHidden(item);
  }

  // ── Opening and closing ──
  function open(node) {
    build();
    items = collectGroup(node);
    var i = items.indexOf(node);
    if (i < 0) { items = [node]; i = 0; }

    closeToken++;
    trigger = node;
    isOpen = true;
    ui.overlay.hidden = false;
    root.classList.add('lb-open');
    void ui.overlay.offsetWidth;
    ui.overlay.classList.add('is-visible');

    show(i, true);
    ui.close.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    loadToken++;
    var myClose = ++closeToken;
    var item = items[index];

    scale = 1; panX = 0; panY = 0;
    applyTransform(false);
    ui.overlay.classList.remove('is-visible');

    var f = ui.frame;
    var from = item.getBoundingClientRect();
    var onScreen = from.width > 0 && from.bottom > 0 && from.right > 0 &&
                   from.top < window.innerHeight && from.left < window.innerWidth;

    function finish() {
      if (myClose !== closeToken || isOpen) return;
      setHidden(null);
      ui.overlay.hidden = true;
      ui.img.removeAttribute('src');
      f.style.transition = 'none';
      f.style.transform = 'none';
      root.classList.remove('lb-open');
      var back = (trigger && document.contains(trigger)) ? trigger : item;
      if (back && back.focus) back.focus({ preventScroll: true });
    }

    if (DURATION && onScreen && f.style.opacity !== '0') {
      var o = offsetFrom(from);
      f.style.transition = 'transform ' + DURATION + 'ms cubic-bezier(0.4, 0, 0.2, 1)';
      f.style.transform = 'translate(' + o.dx + 'px,' + o.dy + 'px) scale(' + o.k + ')';
      setTimeout(finish, DURATION);
    } else if (DURATION) {
      f.style.transition = 'opacity 200ms ease';
      f.style.opacity = '0';
      setTimeout(finish, 220);
    } else {
      finish();
    }
  }

  function go(delta) {
    var next = index + delta;
    if (next < 0 || next >= items.length) return;
    show(next, false);
  }

  // ── Events ──
  function distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  }

  function bindEvents() {
    ui.close.addEventListener('click', close);
    ui.prev.addEventListener('click', function () { go(-1); });
    ui.next.addEventListener('click', function () { go(1); });
    ui.zoomIn.addEventListener('click', function () { zoomFromCenter(1.5); });
    ui.zoomOut.addEventListener('click', function () { zoomFromCenter(1 / 1.5); });
    ui.zoomReset.addEventListener('click', function () { resetZoom(true); });

    // Click on the empty area around the image closes it
    ui.stage.addEventListener('click', function (e) {
      if (e.target === ui.stage) close();
    });

    // Wheel (and trackpad pinch, which arrives as ctrl + wheel)
    ui.overlay.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomTo(scale * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY, false);
    }, { passive: false });

    // Drag to move, two fingers to pinch, double tap to toggle zoom
    var pointers = new Map();
    var drag = null;
    var pinch = null;
    var lastTap = { t: 0, x: 0, y: 0 };

    ui.img.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ui.img.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        pinch = { dist: distance(p[0], p[1]), scale: scale };
        drag = null;
      } else if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, px: panX, py: panY, moved: false };
      }
    });

    ui.img.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinch && pointers.size === 2) {
        var p = Array.from(pointers.values());
        zoomTo(pinch.scale * distance(p[0], p[1]) / pinch.dist,
               (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, false);
      } else if (drag) {
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        if (scale > 1.001 && drag.moved) {
          ui.overlay.classList.add('is-dragging');
          panX = drag.px + dx;
          panY = drag.py + dy;
          clampPan();
          applyTransform(false);
        }
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;

      if (pointers.size === 0) {
        ui.overlay.classList.remove('is-dragging');
        if (drag && !drag.moved && e.type === 'pointerup') handleTap(e);
        drag = null;
      } else if (pointers.size === 1) {
        var rest = pointers.values().next().value;
        drag = { x: rest.x, y: rest.y, px: panX, py: panY, moved: true };
      }
    }

    ui.img.addEventListener('pointerup', endPointer);
    ui.img.addEventListener('pointercancel', endPointer);

    function handleTap(e) {
      var now = Date.now();
      var again = now - lastTap.t < DOUBLE_TAP_MS &&
                  Math.abs(e.clientX - lastTap.x) < 30 &&
                  Math.abs(e.clientY - lastTap.y) < 30;
      if (again) {
        lastTap.t = 0;
        if (scale > 1.001) resetZoom(true);
        else zoomTo(2.5, e.clientX, e.clientY, true);
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }

    window.addEventListener('resize', function () {
      if (!isOpen) return;
      clampPan();
      applyTransform(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!isOpen) {
      // Enter / Space on a focused thumbnail opens it
      if ((e.key === 'Enter' || e.key === ' ') && isTarget(e.target) && e.target.hasAttribute('data-lb-ready')) {
        e.preventDefault();
        open(e.target);
      }
      return;
    }

    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { go(-1); }
    else if (e.key === 'ArrowRight') { go(1); }
    else if (e.key === '+' || e.key === '=') { zoomFromCenter(1.5); }
    else if (e.key === '-') { zoomFromCenter(1 / 1.5); }
    else if (e.key === '0') { resetZoom(true); }
    else if (e.key === 'Tab') {
      // Keep keyboard focus inside the viewer while it is open
      var focusable = Array.prototype.filter.call(ui.overlay.querySelectorAll('button'), function (b) {
        return !b.disabled && b.offsetParent !== null;
      });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (!ui.overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.addEventListener('click', function (e) {
    var node = e.target.closest && e.target.closest('img, canvas');
    if (isTarget(node)) {
      e.preventDefault();
      open(node);
    }
  });

  // ── Start: mark the media, and keep marking what appears later
  //    (the CV pages are drawn a moment after the page loads) ──
  function start() {
    decorate();
    if (!window.MutationObserver) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; decorate(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();