// ══════════════════════════════════════════
// NAV — apertura/chiusura dei sottomenu della sidebar
// e frecce del carosello in home
// ══════════════════════════════════════════

function toggleDropdown(id) {
  const item = document.getElementById(id);
  if (!item) return;

  const isOpen = item.classList.contains('open');

  // Chiude gli altri sottomenu aperti, ne resta aperto uno alla volta
  document.querySelectorAll('.nav-item.open').forEach((el) => {
    if (el !== item) el.classList.remove('open');
  });

  item.classList.toggle('open', !isOpen);
}

// Scorrimento del carosello con le frecce (dove presenti)
function scrollCarousel(trackId, direction) {
  const track = document.getElementById(trackId);
  if (!track) return;
  const amount = track.clientWidth * 0.9;
  track.scrollBy({ left: direction * amount, behavior: 'smooth' });
}

// Form di contatto: mostra uno stato "inviato" sul pulsante
function handleContactSubmit(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  if (!button) return;
  button.textContent = 'Messaggio inviato';
  button.classList.add('is-sent');
  button.disabled = true;
}



// ══════════════════════════════════════════
// MOBILE MENU — turns the sidebar into a slide-in drawer on small
// screens. Builds its own top bar and backdrop, so no page needs
// extra HTML.
//
// PASTE AT THE END of js/nav.js
// ══════════════════════════════════════════

(function () {
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  var root = document.documentElement;
  var mobileQuery = window.matchMedia('(max-width: 780px)');

  sidebar.id = sidebar.id || 'site-sidebar';

  // Top bar: menu button + site name (links home, like the sidebar logo)
  var bar = document.createElement('div');
  bar.className = 'mobile-bar';

  var toggle = document.createElement('button');
  toggle.className = 'menu-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.innerHTML = '<span></span><span></span><span></span>';

  var logo = sidebar.querySelector('.sidebar-logo');
  var title = document.createElement('a');
  title.className = 'mobile-bar__title';
  title.href = logo ? logo.getAttribute('href') : '/';
  title.textContent = logo ? logo.firstChild.textContent.trim() : document.title;

  bar.appendChild(toggle);
  bar.appendChild(title);

  var backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';

  document.body.insertBefore(bar, document.body.firstChild);
  document.body.appendChild(backdrop);

  function setOpen(open) {
    sidebar.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-visible', open);
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function () {
    setOpen(!sidebar.classList.contains('is-open'));
  });

  backdrop.addEventListener('click', function () { setOpen(false); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setOpen(false);
  });

  // Close after tapping a real page link (the dropdown buttons stay open)
  sidebar.addEventListener('click', function (event) {
    if (event.target.closest('a')) setOpen(false);
  });

  // Back to a wide screen: make sure the drawer state is reset
  mobileQuery.addEventListener('change', function (event) {
    if (!event.matches) setOpen(false);
  });
})();