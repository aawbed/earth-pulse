// ================================
// EARTH PULSE — Cards (minimal)
// Tray is populated in globe.js
// This handles any extra card logic
// ================================

// Animate stat counters on load
window.addEventListener('load', () => {
  animateCounter('stat-problems', 0, 30, 1800);
  animateCounter('stat-countries', 0, 195, 2000);
});

function animateCounter(id, from, to, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.floor(from + (to - from) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// Creator signature auto-hide
setTimeout(() => {
  const sig = document.getElementById('creator-sig');
  if (sig) sig.classList.add('hidden');
}, 5000);
