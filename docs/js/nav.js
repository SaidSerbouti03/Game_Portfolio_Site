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
