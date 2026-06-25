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

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => observer.observe(el));

// Hide scroll hint after scrolling
window.addEventListener('scroll', () => {
  const hint = document.querySelector('.scroll-hint');
  if (hint && window.scrollY > 100) {
    hint.style.opacity = '0';
  }
}, { passive: true });

// Hide fixed UI when scrolling past globe
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > window.innerHeight * 0.8;
  const timeMachine = document.getElementById('time-machine');
  const bottomTray = document.getElementById('bottom-tray');
  const heroText = document.getElementById('hero-text');
  const nav = document.getElementById('nav');

  if (timeMachine) timeMachine.style.opacity = scrolled ? '0' : '1';
  if (timeMachine) timeMachine.style.pointerEvents = scrolled ? 'none' : 'auto';
  if (bottomTray) bottomTray.style.opacity = scrolled ? '0' : '1';
  if (bottomTray) bottomTray.style.pointerEvents = scrolled ? 'none' : 'auto';
  if (heroText) heroText.style.opacity = scrolled ? '0' : '1';
}, { passive: true });