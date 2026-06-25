// ================================
// EARTH PULSE — Side Panel Logic
// ================================

let currentProblem = null;

export function openPanel(prob) {
  currentProblem = prob;

  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-closed');
  panel.classList.add('panel-open');

  // Category badge
  const catEl = document.getElementById('panel-category');
  catEl.textContent = prob.category.toUpperCase();
  catEl.className = `panel-category cat-${prob.category}`;

  document.getElementById('panel-title').textContent = prob.title;

  // Flag + regions
  const regions = Array.isArray(prob.regions) ? prob.regions : [prob.region];
  document.getElementById('panel-flag').textContent = prob.icon || '🌍';
  document.getElementById('panel-region').textContent = regions.join(', ');

  document.getElementById('panel-description').textContent = prob.description;

  // Stats
  const statsRow = document.getElementById('panel-stats-row');
  const affectedFormatted = prob.affected >= 1e9
    ? (prob.affected / 1e9).toFixed(1) + 'B'
    : prob.affected >= 1e6
    ? (prob.affected / 1e6).toFixed(0) + 'M'
    : prob.affected?.toLocaleString() || '—';

  statsRow.innerHTML = `
    <div class="panel-stat-card">
      <div class="panel-stat-value">${prob.stat || '—'}</div>
      <div class="panel-stat-key">Key Stat</div>
    </div>
    <div class="panel-stat-card">
      <div class="panel-stat-value">${affectedFormatted}</div>
      <div class="panel-stat-key">People Affected</div>
    </div>
    <div class="panel-stat-card">
      <div class="panel-stat-value">${prob.severity}/10</div>
      <div class="panel-stat-key">Severity</div>
    </div>
    <div class="panel-stat-card severity-bar-card">
      <div class="severity-bar">
        <div class="severity-fill" style="width:${prob.severity * 10}%"></div>
      </div>
      <div class="panel-stat-key">Crisis Level</div>
    </div>`;

  // Ripple tags
  const rippleEl = document.getElementById('ripple-tags');
  rippleEl.innerHTML = '';
  const ripples = prob.ripples || prob.ripple_effects || [];
  ripples.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'ripple-tag';
    span.textContent = tag;
    rippleEl.appendChild(span);
  });

  // Actions
  const actionsEl = document.getElementById('actions-list');
  actionsEl.innerHTML = '';
  const actions = prob.actions || (prob.action ? [prob.action] : []);
  actions.forEach((action, i) => {
    actionsEl.innerHTML += `
      <div class="action-item">
        <span class="action-num">0${i + 1}</span>
        <span>${action}</span>
      </div>`;
  });

  // Reset AI
  document.getElementById('ai-response').textContent = '';
  document.getElementById('ai-input').value = '';

  // Show ripple lines
  if (window.__globeModule) {
    window.__globeModule.clearRippleLines();
    window.__globeModule.showRippleLines(prob);
  }

  // Load live climate data
  loadClimateData(prob);

  // Load live news
  loadNews(prob);

  panel.scrollTop = 0;
}

// ---- Live Climate Data ----
async function loadClimateData(prob) {
  const climateEl = document.getElementById('climate-data');
  if (!climateEl) return;
  climateEl.innerHTML = '<span class="loading-text">Fetching live data...</span>';

  const coords = Array.isArray(prob.coordinates) ? prob.coordinates : [prob.coordinates.lat, prob.coordinates.lon];
  const [lat, lon] = coords;

  try {
    const res = await fetch(`/api/climate?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    climateEl.innerHTML = `
      <div class="climate-grid">
        <div class="climate-item">
          <span class="climate-val">${data.temperature}${data.unit}</span>
          <span class="climate-key">Temperature</span>
        </div>
        <div class="climate-item">
          <span class="climate-val">${data.windspeed} km/h</span>
          <span class="climate-key">Wind Speed</span>
        </div>
        <div class="climate-item">
          <span class="climate-val">${data.precipitation} mm</span>
          <span class="climate-key">Precipitation</span>
        </div>
      </div>`;
  } catch {
    climateEl.innerHTML = '<span class="loading-text">Live data unavailable</span>';
  }
}

// ---- Live News ----
async function loadNews(prob) {
  const newsEl = document.getElementById('news-feed');
  if (!newsEl) return;
  newsEl.innerHTML = '<span class="loading-text">Loading latest news...</span>';

  const region = Array.isArray(prob.regions) ? prob.regions[0] : prob.region;

  try {
    const res = await fetch(`/api/news?topic=${encodeURIComponent(prob.title)}&region=${encodeURIComponent(region)}`);
    const data = await res.json();

    if (!data.articles?.length) {
      newsEl.innerHTML = '<span class="loading-text">No recent articles found</span>';
      return;
    }

    newsEl.innerHTML = data.articles.map(a => `
      <a class="news-item" href="${a.url}" target="_blank" rel="noopener">
        <div class="news-source">${a.source} · ${new Date(a.publishedAt).toLocaleDateString()}</div>
        <div class="news-title">${a.title}</div>
      </a>`).join('');
  } catch {
    newsEl.innerHTML = '<span class="loading-text">News unavailable</span>';
  }
}

// ---- Close panel ----
document.getElementById('panel-close').addEventListener('click', () => {
  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
});

// ---- AI Ask the Globe ----
document.getElementById('ai-send').addEventListener('click', askGlobe);
document.getElementById('ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') askGlobe();
});

async function askGlobe() {
  if (!currentProblem) return;
  const input = document.getElementById('ai-input').value.trim();
  if (!input) return;

  const responseEl = document.getElementById('ai-response');
  responseEl.textContent = '';
  responseEl.classList.add('loading');

  try {
    const res = await fetch('/api/ask-globe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: input, problem: currentProblem })
    });
    const data = await res.json();
    responseEl.classList.remove('loading');

    // Typewriter effect
    const text = data.answer || 'No response.';
    responseEl.textContent = '';
    let i = 0;
    const type = () => {
      if (i < text.length) {
        responseEl.textContent += text[i++];
        setTimeout(type, 18);
      }
    };
    type();
  } catch {
    responseEl.classList.remove('loading');
    responseEl.textContent = 'Connection error. Try again.';
  }
}

// ---- Share button ----
document.getElementById('share-btn').addEventListener('click', () => {
  if (!currentProblem) return;
  const regions = Array.isArray(currentProblem.regions) ? currentProblem.regions[0] : currentProblem.region;
  const text = `${currentProblem.icon || '🌍'} ${currentProblem.title} — ${regions}\n\n${currentProblem.description}\n\nExplore on Earth Pulse 🌐`;
  if (navigator.share) {
    navigator.share({ title: 'Earth Pulse', text });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = '✓ Copied to clipboard!';
      setTimeout(() => btn.textContent = '↗ Share This Crisis', 2000);
    });
  }
});