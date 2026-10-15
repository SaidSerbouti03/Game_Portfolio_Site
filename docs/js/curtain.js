// ══════════════════════════════════════════
// CURTAIN — self-contained stage curtain.
//
// Usage: one line in the <head> of any page
//   <script src="../js/curtain.js"></script>
// (plus css/curtain.css). The script builds its own markup.
//
// Optional settings, as data attributes on that script tag:
//   data-text="Click to raise the curtain"   text on the plaque
//   data-label="Open the curtain..."         screen-reader label
//   data-once="true"                         show it only once per
//                                            browser session, so it
//                                            doesn't close on every page
// ══════════════════════════════════════════

(function () {
  var script = document.currentScript;
  var data = (script && script.dataset) || {};

  var options = {
    text: data.text || 'Click to raise the curtain',
    label: data.label || 'Open the curtain to view the page',
    once: data.once === 'true'
  };

  var STORAGE_KEY = 'curtain-opened';
  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Storage can be blocked (private mode, file://), so never let it break the page
  function wasOpened() {
    try { return options.once && sessionStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
  }

  function rememberOpened() {
    try { if (options.once) sessionStorage.setItem(STORAGE_KEY, '1'); }
    catch (e) { /* ignore */ }
  }

  if (wasOpened()) return;

  // Set as early as possible (script sits in <head>) so the page
  // never flashes before the curtain is drawn.
  root.classList.add('curtain-closed');

  function div(className) {
    var el = document.createElement('div');
    el.className = className;
    return el;
  }

  function build() {
    var curtain = div('curtain');
    curtain.setAttribute('role', 'button');
    curtain.setAttribute('tabindex', '0');
    curtain.setAttribute('aria-label', options.label);

    var prompt = div('curtain-prompt');
    var text = document.createElement('span');
    text.className = 'curtain-prompt__text';
    text.textContent = options.text;
    prompt.appendChild(text);

    curtain.appendChild(div('curtain-panel curtain-panel--left'));
    curtain.appendChild(div('curtain-panel curtain-panel--right'));
    curtain.appendChild(div('curtain-valance'));
    curtain.appendChild(prompt);
    document.body.insertBefore(curtain, document.body.firstChild);

    // Everything else on the page is unreachable (keyboard and
    // screen readers) until the curtain is open. Works on any layout.
    var pageParts = Array.prototype.filter.call(document.body.children, function (el) {
      return el !== curtain && el.tagName !== 'SCRIPT' && el.tagName !== 'NOSCRIPT';
    });
    pageParts.forEach(function (el) { el.inert = true; });

    function openCurtain() {
      if (curtain.classList.contains('is-open')) return;

      curtain.classList.add('is-open');
      curtain.removeAttribute('tabindex');
      root.classList.remove('curtain-closed');
      pageParts.forEach(function (el) { el.inert = false; });
      rememberOpened();

      // Remove the overlay once the folds and the valance are gone
      setTimeout(function () { curtain.remove(); }, reducedMotion ? 350 : 2400);
    }

    curtain.addEventListener('click', openCurtain);
    curtain.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCurtain();
      }
    });

    curtain.focus({ preventScroll: true });
  }

  function start() {
    try { build(); }
    catch (e) { root.classList.remove('curtain-closed'); }   // never trap the visitor
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();