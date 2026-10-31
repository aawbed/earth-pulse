// ================================
// EARTH PULSE — Cards, Counters & Scroll Interactions
// ================================

// Animate Hero stat counters & Earth Health Score bar on load
window.addEventListener('load', () => {
  animateCounter('stat-problems', 0, 30, 1800);
  animateCounter('stat-countries', 0, 195, 2000);
  animateCounter('stat-health', 0, 42, 1900);

  const healthFill = document.getElementById('health-fill');
  if (healthFill) {
    requestAnimationFrame(() => {
      healthFill.style.width = '42%';
    });
  }
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

// Interactive Category Showcase Cards -> scroll to globe & apply filter
document.querySelectorAll('.showcase-card[data-category]').forEach(card => {
  const triggerFilter = () => {
    const category = card.dataset.category;
    window.__globeModule?.setFilter?.(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  card.addEventListener('click', triggerFilter);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerFilter();
    }
  });
});

// Footer "Back to Globe" smooth scroll
const backToGlobe = document.getElementById('back-to-globe');
if (backToGlobe) {
  backToGlobe.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

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

// Hide scroll hint & fixed globe HUD when scrolling into editorial sections
window.addEventListener('scroll', () => {
  const hint = document.querySelector('.scroll-hint');
  if (hint) {
    hint.style.transition = 'opacity 0.4s ease';
    hint.style.opacity = window.scrollY > 100 ? '0' : '1';
  }

  const scrolled = window.scrollY > window.innerHeight * 0.85;
  const ids = ['time-machine', 'bottom-tray', 'hero-text'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = scrolled ? '0' : '1';
    el.style.pointerEvents = scrolled ? 'none' : 'auto';
  });

  const tooltip = document.getElementById('tooltip');
  if (tooltip && scrolled) tooltip.classList.add('hidden');

  // Disable globe interaction when scrolled past it so footer/cards stay clickable
  const canvas = document.getElementById('globe-canvas');
  if (canvas) {
    canvas.style.pointerEvents = scrolled ? 'none' : 'auto';
  }
}, { passive: true });
