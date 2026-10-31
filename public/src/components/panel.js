// ================================
// EARTH PULSE — Side Panel Logic
// ================================

let currentProblem = null;
let typewriterTimer = null;
let activeAskId = 0;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stopTypewriter() {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }
}

export function openPanel(prob) {
  currentProblem = prob;
  activeAskId++;
  stopTypewriter();

  const panel = document.getElementById('side-panel');
  panel.classList.remove('panel-closed');
  panel.classList.add('panel-open');
  panel.setAttribute('aria-hidden', 'false');

  // Category badge
  const catEl = document.getElementById('panel-category');
  catEl.textContent = (prob.category || 'crisis').toUpperCase();
  catEl.className = `panel-category cat-${prob.category || 'climate'}`;

  document.getElementById('panel-title').textContent = prob.title;

  // Crisis icon + interactive country flag chips
  const regions = Array.isArray(prob.regions) ? prob.regions : [prob.region].filter(Boolean);
  document.getElementById('panel-flag').textContent = prob.icon || '🌍';

  const regionContainer = document.getElementById('panel-region');
  regionContainer.innerHTML = '';
  const globeApi = window.__globeModule;

  regions.forEach(regionName => {
    const matchedCountry = globeApi?.findCountryByName?.(regionName);
    const chip = document.createElement('span');
    chip.className = 'region-chip' + (matchedCountry ? ' clickable' : '');
    chip.textContent = matchedCountry ? `${matchedCountry.flag} ${regionName}` : regionName;
    if (matchedCountry) {
      chip.title = `Fly globe to ${matchedCountry.name}`;
      chip.addEventListener('click', () => {
        globeApi.flyToCoords(matchedCountry.lat, matchedCountry.lon, 1.85, true);
      });
    }
    regionContainer.appendChild(chip);
  });

  document.getElementById('panel-description').textContent = prob.description;

  // Stats + custom per-crisis color accent on severity bar
  const statsRow = document.getElementById('panel-stats-row');
  const affectedFormatted = prob.affected >= 1e9
    ? (prob.affected / 1e9).toFixed(1) + 'B'
    : prob.affected >= 1e6
    ? (prob.affected / 1e6).toFixed(0) + 'M'
    : prob.affected
    ? prob.affected.toLocaleString()
    : 'Live';

  const accentColor = /^#[0-9a-fA-F]{6}$/.test(prob.color || '') ? prob.color : '#00f5d4';
  const severity = Number(prob.severity) || 8;

  statsRow.innerHTML = `
    <div class="panel-stat-card">
      <div class="panel-stat-value">${escapeHtml(prob.stat || '—')}</div>
      <div class="panel-stat-key">Key Stat</div>
    </div>
    <div class="panel-stat-card">
      <div class="panel-stat-value">${escapeHtml(affectedFormatted)}</div>
      <div class="panel-stat-key">People Affected</div>
    </div>
    <div class="panel-stat-card">
      <div class="panel-stat-value">${escapeHtml(severity)}/10</div>
      <div class="panel-stat-key">Severity</div>
    </div>
    <div class="panel-stat-card severity-bar-card">
      <div class="severity-bar">
        <div class="severity-fill" style="width:${Math.min(100, severity * 10)}%;background:linear-gradient(90deg, ${accentColor}, var(--accent-magenta));"></div>
      </div>
      <div class="panel-stat-key">Crisis Level</div>
    </div>`;

  // Interactive Ripple tags (resolved to human-readable titles + click to fly)
  const rippleSection = document.getElementById('ripple-section');
  const rippleEl = document.getElementById('ripple-tags');
  rippleEl.innerHTML = '';
  const ripples = prob.ripples || prob.ripple_effects || [];

  if (ripples.length === 0) {
    if (rippleSection) rippleSection.style.display = 'none';
  } else {
    if (rippleSection) rippleSection.style.display = 'block';
    ripples.forEach(rippleId => {
      const targetProb = globeApi?.getProblemById?.(rippleId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ripple-tag';

      const dot = document.createElement('span');
      dot.className = 'ripple-tag-dot';
      const dotColor = targetProb
        ? (globeApi?.getCategoryColor?.(targetProb.category) || '#f700ff')
        : '#f700ff';
      dot.style.background = dotColor;
      dot.style.boxShadow = `0 0 6px ${dotColor}`;

      const label = document.createElement('span');
      label.textContent = targetProb
        ? `${targetProb.icon || ''} ${targetProb.title}`.trim()
        : rippleId;

      btn.appendChild(dot);
      btn.appendChild(label);

      if (targetProb && globeApi?.flyToMarker) {
        btn.title = `Jump to ${targetProb.title}`;
        btn.addEventListener('click', () => globeApi.flyToMarker(targetProb));
      }
      rippleEl.appendChild(btn);
    });
  }

  // Multi-step Actions (with clickable source link support for live NASA EONET events)
  const actionsEl = document.getElementById('actions-list');
  actionsEl.innerHTML = '';
  const actions = Array.isArray(prob.actions) && prob.actions.length > 0
    ? prob.actions
    : (prob.action ? [prob.action] : []);

  actions.forEach((actionText, i) => {
    const isSourceLink = i === 0 && prob.sourceUrl && /^https?:\/\//i.test(prob.sourceUrl);
    const item = document.createElement(isSourceLink ? 'a' : 'div');
    item.className = 'action-item';
    if (isSourceLink) {
      item.href = prob.sourceUrl;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
    }

    const num = document.createElement('span');
    num.className = 'action-num';
    num.textContent = String(i + 1).padStart(2, '0');

    const body = document.createElement('span');
    body.textContent = isSourceLink ? `${actionText} ↗` : actionText;

    item.appendChild(num);
    item.appendChild(body);
    actionsEl.appendChild(item);
  });

  // Reset AI input & response
  const aiRes = document.getElementById('ai-response');
  aiRes.classList.remove('loading');
  aiRes.textContent = '';
  document.getElementById('ai-input').value = '';

  // Render 3D ripple arcs on the globe
  if (globeApi) {
    globeApi.clearRippleLines();
    if (ripples.length > 0) globeApi.showRippleLines(prob);
  }

  // Load live telemetry
  loadClimateData(prob);
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
  const targetRef = prob;

  try {
    const res = await fetch(`/api/climate?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    const data = await res.json();
    if (currentProblem !== targetRef) return;
    if (!res.ok || data.error) throw new Error(data.error || 'Weather error');

    const rainLabel = data.precipitationPeriod ? `Rain (${escapeHtml(data.precipitationPeriod)})` : 'Precipitation';
    climateEl.innerHTML = `
      <div class="climate-grid">
        <div class="climate-item">
          <span class="climate-val">${escapeHtml(data.temperature)}${escapeHtml(data.unit || '°C')}</span>
          <span class="climate-key">Temperature</span>
        </div>
        <div class="climate-item">
          <span class="climate-val">${escapeHtml(data.windspeed)} km/h</span>
          <span class="climate-key">Wind Speed</span>
        </div>
        <div class="climate-item">
          <span class="climate-val">${escapeHtml(data.precipitation)} mm</span>
          <span class="climate-key">${rainLabel}</span>
        </div>
      </div>`;
  } catch {
    if (currentProblem === targetRef) {
      climateEl.innerHTML = '<span class="loading-text">Live data unavailable</span>';
    }
  }
}

// ---- Live News ----
async function loadNews(prob) {
  const newsEl = document.getElementById('news-feed');
  if (!newsEl) return;
  newsEl.innerHTML = '<span class="loading-text">Loading latest news...</span>';

  const region = Array.isArray(prob.regions) ? prob.regions[0] : (prob.region || '');
  const targetRef = prob;

  try {
    const res = await fetch(`/api/news?topic=${encodeURIComponent(prob.title)}&region=${encodeURIComponent(region)}`);
    const data = await res.json();
    if (currentProblem !== targetRef) return;

    if (!data.articles?.length) {
      newsEl.innerHTML = '<span class="loading-text">No recent articles found</span>';
      return;
    }

    newsEl.innerHTML = data.articles.map(a => {
      const safeUrl = /^https?:\/\//i.test(a.url || '') ? escapeHtml(a.url) : '#';
      const dateStr = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : '';
      return `
        <a class="news-item" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          <div class="news-source">${escapeHtml(a.source || 'News')}${dateStr ? ` · ${escapeHtml(dateStr)}` : ''}</div>
          <div class="news-title">${escapeHtml(a.title)}</div>
        </a>`;
    }).join('');
  } catch {
    if (currentProblem === targetRef) {
      newsEl.innerHTML = '<span class="loading-text">News unavailable</span>';
    }
  }
}

// ---- Close panel ----
function closePanel() {
  const panel = document.getElementById('side-panel');
  if (!panel.classList.contains('panel-open')) return;

  activeAskId++;
  stopTypewriter();
  currentProblem = null;

  panel.classList.remove('panel-open');
  panel.classList.add('panel-closed');
  panel.setAttribute('aria-hidden', 'true');

  window.__globeModule?.onPanelClose?.();
}

document.getElementById('panel-close').addEventListener('click', closePanel);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePanel();
});

// ---- AI Ask the Globe ----
document.getElementById('ai-send').addEventListener('click', askGlobe);
document.getElementById('ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') askGlobe();
});

async function askGlobe() {
  if (!currentProblem) return;
  const inputEl = document.getElementById('ai-input');
  const question = inputEl.value.trim();
  if (!question) return;

  const reqId = ++activeAskId;
  stopTypewriter();

  const responseEl = document.getElementById('ai-response');
  responseEl.textContent = '';
  responseEl.classList.add('loading');

  try {
    const res = await fetch('/api/ask-globe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, problem: currentProblem })
    });
    const data = await res.json();
    if (reqId !== activeAskId) return;

    responseEl.classList.remove('loading');

    const text = data.answer || 'No response.';
    responseEl.textContent = '';
    let i = 0;
    const type = () => {
      if (reqId !== activeAskId) return;
      if (i < text.length) {
        responseEl.textContent += text[i++];
        typewriterTimer = setTimeout(type, 16);
      } else {
        typewriterTimer = null;
      }
    };
    type();
  } catch {
    if (reqId === activeAskId) {
      responseEl.classList.remove('loading');
      responseEl.textContent = 'Connection error. Try again.';
    }
  }
}

// ---- Share button ----
document.getElementById('share-btn').addEventListener('click', () => {
  if (!currentProblem) return;
  const region = Array.isArray(currentProblem.regions) ? currentProblem.regions[0] : currentProblem.region;
  const shareUrl = window.location.origin;
  const text = `${currentProblem.icon || '🌍'} ${currentProblem.title} — ${region}\n\n${currentProblem.description}\n\nExplore live on Earth Pulse: ${shareUrl}`;

  if (navigator.share) {
    navigator.share({ title: `Earth Pulse — ${currentProblem.title}`, text, url: shareUrl }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = '✓ Copied to clipboard!';
      setTimeout(() => { btn.textContent = '↗ Share This Crisis'; }, 2000);
    });
  }
});
