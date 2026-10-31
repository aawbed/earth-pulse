// ================================
// EARTH PULSE — Globe Engine
// Three.js 3D rotating globe + GSAP camera flight
// ================================

import { openPanel } from '../components/panel.js';

const canvas = document.getElementById('globe-canvas');
const tooltip = document.getElementById('tooltip');

// ---- Scene setup ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2.8;

const MAX_TILT = Math.PI * 0.42;

// ---- Lighting ----
const ambientLight = new THREE.AmbientLight(0x1a2a4a, 2.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0x00f5d4, 1.2);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight(0xf700ff, 0.4);
rimLight.position.set(-5, -3, -5);
scene.add(rimLight);

// ---- Globe ----
const globeGeo = new THREE.SphereGeometry(1, 64, 64);

// Load earth texture from a CDN
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load(
  'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
  () => console.log('Earth texture loaded')
);
const bumpMap = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');

const globeMat = new THREE.MeshPhongMaterial({
  map: earthTexture,
  bumpMap: bumpMap,
  bumpScale: 0.015,
  specular: new THREE.Color(0x00f5d4),
  specularMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png'),
  shininess: 18,
});
const globe = new THREE.Mesh(globeGeo, globeMat);
scene.add(globe);

// ---- Atmosphere glow ----
const atmGeo = new THREE.SphereGeometry(1.06, 64, 64);
const atmMat = new THREE.MeshPhongMaterial({
  color: 0x00f5d4,
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.08,
});
const atmosphere = new THREE.Mesh(atmGeo, atmMat);
scene.add(atmosphere);

// ---- Helper: lat/lon → Vector3 ----
function latLonToVec3(lat, lon, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// ---- Grid lines (grouped so they rotate with the globe) ----
const gridGroup = new THREE.Group();
const gridMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.06 });
for (let lat = -80; lat <= 80; lat += 20) {
  const pts = [];
  for (let lon = 0; lon <= 360; lon += 2) {
    pts.push(latLonToVec3(lat, lon, 1.002));
  }
  gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
}
for (let lon = 0; lon < 360; lon += 20) {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 2) {
    pts.push(latLonToVec3(lat, lon, 1.002));
  }
  gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
}
scene.add(gridGroup);

// ---- Stars ----
const starGeo = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 3000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 8 + Math.random() * 2;
  starPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.7 });
scene.add(new THREE.Points(starGeo, starMat));

// ---- Category colors ----
const catColors = {
  climate:   0x00f5d4,
  hunger:    0xffbe0b,
  conflict:  0xff4060,
  health:    0xa78bfa,
  education: 0x38bdf8,
  economy:   0xfb923c,
};

// Fallback year map if problem.year is absent
const crisisYears = {
  'climate-001': 2000, 'climate-002': 2019, 'climate-003': 1995,
  'climate-004': 2000, 'climate-005': 2010,
  'hunger-001': 2008, 'hunger-002': 1990, 'hunger-003': 2011,
  'hunger-004': 2000, 'hunger-005': 2015,
  'conflict-001': 2011, 'conflict-002': 2022, 'conflict-003': 2015,
  'conflict-004': 1990, 'conflict-005': 2014,
  'health-001': 2019, 'health-002': 2000, 'health-003': 1990,
  'health-004': 2010, 'health-005': 2005,
  'education-001': 1995, 'education-002': 1990, 'education-003': 2000,
  'education-004': 1995, 'education-005': 2015,
  'economy-001': 1990, 'economy-002': 2008, 'economy-003': 1995,
  'economy-004': 2000, 'economy-005': 2010,
};

// ---- State ----
let problems = [];
let countries = [];
let markers = [];
let countryMarkers = [];
let eonetMarkers = [];
let rippleLines = [];
let activeFilter = 'all';
let activeYear = 2026;
let selectedProblemId = null;
let isPanelOpen = false;
let isFlying = false;

function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
  scene.remove(group);
}

function getCrisisYear(prob) {
  return prob.year || crisisYears[prob.id] || 1990;
}

function isProblemVisible(prob) {
  const catMatch = activeFilter === 'all' || prob.category === activeFilter;
  const yearMatch = getCrisisYear(prob) <= activeYear;
  return catMatch && yearMatch;
}

// ---- Load problems & countries ----
async function loadProblems() {
  try {
    const res = await fetch('./src/data/problems.json');
    const data = await res.json();
    problems = Array.isArray(data) ? data : (data.problems || []);
    if (problems.length === 0) {
      console.warn('No problems loaded — check problems.json structure');
    }
    createMarkers();
    applyFilters(false);
  } catch (err) {
    console.error('Failed to load problems.json:', err);
  }
}

async function loadCountries() {
  try {
    const res = await fetch('./src/data/countries.json');
    const data = await res.json();
    countries = Array.isArray(data) ? data : (data.countries || []);
    createCountryMarkers();
    populateCountrySelect();
  } catch (err) {
    console.error('Failed to load countries.json:', err);
  }
}

function createMarkers() {
  markers.forEach(m => disposeGroup(m.group));
  markers = [];

  problems.forEach(prob => {
    const catColor = catColors[prob.category] || 0xffffff;
    const customColor = prob.color ? new THREE.Color(prob.color) : new THREE.Color(catColor);

    const lat = Array.isArray(prob.coordinates) ? prob.coordinates[0] : prob.coordinates.lat;
    const lon = Array.isArray(prob.coordinates) ? prob.coordinates[1] : prob.coordinates.lon;
    const pos = latLonToVec3(lat, lon, 1.02);

    // Inner dot uses per-crisis accent blended with category glow
    const dotGeo = new THREE.SphereGeometry(0.018, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: customColor });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);

    // Outer pulse ring uses category color for instant visual grouping
    const ringGeo = new THREE.RingGeometry(0.025, 0.039, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: catColor, side: THREE.DoubleSide, transparent: true, opacity: 0.65
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(new THREE.Vector3(0, 0, 0));

    const group = new THREE.Group();
    group.add(dot);
    group.add(ring);
    scene.add(group);

    markers.push({
      mesh: dot,
      ring,
      group,
      prob,
      lat,
      lon,
      basePos: pos.clone(),
      pulseT: Math.random() * Math.PI * 2
    });
  });
}

function createCountryMarkers() {
  countryMarkers.forEach(cm => disposeGroup(cm.group));
  countryMarkers = [];

  countries.forEach(country => {
    const pos = latLonToVec3(country.lat, country.lon, 1.008);
    const dotGeo = new THREE.SphereGeometry(0.0065, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.35
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);

    const group = new THREE.Group();
    group.add(dot);
    scene.add(group);

    countryMarkers.push({ group, dot, country });
  });
}

function populateCountrySelect() {
  const select = document.getElementById('country-select');
  if (!select) return;

  const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = `<option value="">🌍 Jump to Country (${sorted.length})</option>`;
  sorted.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.flag} ${c.name}`;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const code = select.value;
    if (!code) return;
    const country = countries.find(c => c.code === code);
    if (country) flyToCountry(country);
  });
}

function populateTray() {
  const tray = document.getElementById('tray-scroll');
  if (!tray) return;
  tray.innerHTML = '';

  const visibleProblems = problems.filter(isProblemVisible);
  visibleProblems.forEach(prob => {
    const hex = '#' + (catColors[prob.category] || 0xffffff).toString(16).padStart(6, '0');
    const card = document.createElement('div');
    card.className = 'tray-card' + (prob.id === selectedProblemId ? ' active' : '');
    card.dataset.problemId = prob.id;

    const dot = document.createElement('div');
    dot.className = 'tray-card-dot';
    dot.style.background = hex;
    dot.style.boxShadow = `0 0 8px ${hex}`;

    const textWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'tray-card-title';
    titleEl.textContent = prob.title;

    const regionName = Array.isArray(prob.regions) ? prob.regions[0] : prob.region;
    const matchedCountry = findCountryByName(regionName);
    const regionEl = document.createElement('div');
    regionEl.className = 'tray-card-region';
    regionEl.textContent = matchedCountry ? `${matchedCountry.flag} ${regionName}` : regionName;

    textWrap.appendChild(titleEl);
    textWrap.appendChild(regionEl);
    card.appendChild(dot);
    card.appendChild(textWrap);

    card.addEventListener('click', () => flyToMarker(prob));
    tray.appendChild(card);
  });
}

function updateActiveTrayCard(scrollIntoView = false) {
  document.querySelectorAll('.tray-card').forEach(card => {
    const isActive = card.dataset.problemId === selectedProblemId;
    card.classList.toggle('active', isActive);
    if (isActive && scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
}

function applyFilters(updateStatsImmediate = true) {
  // 1. Crisis markers
  markers.forEach(m => {
    m.group.visible = isProblemVisible(m.prob);
  });

  // 2. Live NASA EONET markers (active in 2026 under All or Climate)
  const showEonet = activeYear === 2026 && (activeFilter === 'all' || activeFilter === 'climate');
  eonetMarkers.forEach(m => {
    m.group.visible = showEonet;
  });

  // 3. Bottom tray cards
  populateTray();

  // 4. Dynamic Hero Stats (Active Crises, People Affected, Historical Earth Health Score)
  const visibleByYear = problems.filter(p => getCrisisYear(p) <= activeYear);
  const visibleFiltered = problems.filter(isProblemVisible);

  if (updateStatsImmediate) {
    const statProblemsEl = document.getElementById('stat-problems');
    if (statProblemsEl) statProblemsEl.textContent = visibleFiltered.length;
  }

  const statPeopleEl = document.getElementById('stat-people');
  if (statPeopleEl) {
    if (activeYear === 2026 && activeFilter === 'all') {
      statPeopleEl.textContent = '8.1B';
    } else {
      const cappedPeople = Math.min(
        8.1e9,
        visibleFiltered.reduce((sum, p) => sum + (p.affected || 0), 0)
      );
      statPeopleEl.textContent = cappedPeople >= 1e9
        ? (cappedPeople / 1e9).toFixed(1) + 'B'
        : cappedPeople >= 1e6
        ? Math.round(cappedPeople / 1e6) + 'M'
        : cappedPeople.toLocaleString();
    }
  }

  // Earth Health Score degrades from 64 (in 1990) down to 42 (in 2026) as global crises compound
  const ratio = problems.length > 0 ? visibleByYear.length / problems.length : 1;
  const computedHealth = Math.round(70 - ratio * 28); // 30/30 crises => 42
  if (updateStatsImmediate) {
    const statHealthEl = document.getElementById('stat-health');
    const healthFillEl = document.getElementById('health-fill');
    if (statHealthEl) statHealthEl.textContent = computedHealth;
    if (healthFillEl) healthFillEl.style.width = `${computedHealth}%`;
  }
}

// ---- Drag to rotate (with inertia & click-drag disambiguation) ----
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let pointerStart = { x: 0, y: 0 };
let maxDragDelta = 0;
let rotVel = { x: 0, y: 0 };

function stopFlightTweens() {
  isFlying = false;
  if (window.gsap) {
    window.gsap.killTweensOf(globe.rotation);
    window.gsap.killTweensOf(camera.position);
  }
}

canvas.addEventListener('mousedown', e => {
  stopFlightTweens();
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
  pointerStart = { x: e.clientX, y: e.clientY };
  maxDragDelta = 0;
  rotVel = { x: 0, y: 0 };
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    canvas.style.cursor = 'grab';
  }
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  maxDragDelta = Math.max(maxDragDelta, Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y));
  rotVel.x = dy * 0.005;
  rotVel.y = dx * 0.005;
  prevMouse = { x: e.clientX, y: e.clientY };
});

// Touch support
canvas.addEventListener('touchstart', e => {
  stopFlightTweens();
  isDragging = true;
  const touch = e.touches[0];
  prevMouse = { x: touch.clientX, y: touch.clientY };
  pointerStart = { x: touch.clientX, y: touch.clientY };
  maxDragDelta = 0;
  rotVel = { x: 0, y: 0 };
}, { passive: true });

canvas.addEventListener('touchend', () => { isDragging = false; });

canvas.addEventListener('touchmove', e => {
  if (!isDragging || !e.touches[0]) return;
  const touch = e.touches[0];
  const dx = touch.clientX - prevMouse.x;
  const dy = touch.clientY - prevMouse.y;
  maxDragDelta = Math.max(maxDragDelta, Math.hypot(touch.clientX - pointerStart.x, touch.clientY - pointerStart.y));
  rotVel.x = dy * 0.005;
  rotVel.y = dx * 0.005;
  prevMouse = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

// ---- Zoom ----
canvas.addEventListener('wheel', e => {
  if (window.gsap) window.gsap.killTweensOf(camera.position);
  camera.position.z = Math.max(1.55, Math.min(5, camera.position.z + e.deltaY * 0.003));
}, { passive: true });

// ---- Raycaster with front-hemisphere occlusion ----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
raycaster.params.Points.threshold = 0.05;
raycaster.params.Line = { threshold: 0.032 };

function getFrontOcclusionLimit() {
  const globeHits = raycaster.intersectObject(globe);
  return globeHits.length > 0 ? globeHits[0].distance + 0.05 : Infinity;
}

canvas.addEventListener('click', e => {
  // Ignore drag releases so spinning the globe doesn't accidentally click a marker
  if (maxDragDelta > 6) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const maxDist = getFrontOcclusionLimit();

  // 1. Regular crisis markers
  const visibleMarkers = markers.filter(m => m.group.visible);
  const dotHits = raycaster.intersectObjects(visibleMarkers.map(m => m.mesh))
    .filter(h => h.distance <= maxDist);
  if (dotHits.length > 0) {
    const marker = visibleMarkers.find(m => m.mesh === dotHits[0].object);
    if (marker) {
      flyToMarker(marker.prob);
      return;
    }
  }

  // 2. Live NASA EONET markers
  const visibleEonet = eonetMarkers.filter(m => m.group.visible);
  const eonetHits = raycaster.intersectObjects(visibleEonet.map(m => m.dot))
    .filter(h => h.distance <= maxDist);
  if (eonetHits.length > 0) {
    const m = visibleEonet.find(em => em.dot === eonetHits[0].object);
    if (m) {
      openEonetEvent(m.event);
      return;
    }
  }

  // 3. Ripple connection arcs (click arc to jump to connected crisis)
  const arcLines = rippleLines.map(r => r.line);
  const arcHits = raycaster.intersectObjects(arcLines)
    .filter(h => h.distance <= maxDist + 0.35);
  if (arcHits.length > 0) {
    const arc = rippleLines.find(r => r.line === arcHits[0].object);
    if (arc?.toProb) {
      flyToMarker(arc.toProb);
      return;
    }
  }

  // 4. Country reference pins
  const countryHits = raycaster.intersectObjects(countryMarkers.map(c => c.dot))
    .filter(h => h.distance <= maxDist);
  if (countryHits.length > 0) {
    const cm = countryMarkers.find(c => c.dot === countryHits[0].object);
    if (cm) {
      const select = document.getElementById('country-select');
      if (select) select.value = cm.country.code;
      flyToCountry(cm.country);
    }
  }
});

function openEonetEvent(event) {
  const [lat, lon] = event.coordinates;
  const region = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  selectedProblemId = null;
  isPanelOpen = true;
  updateActiveTrayCard(false);

  flyToCoords(lat, lon, 1.85, true);
  openPanel({
    id: event.id,
    title: event.title,
    category: 'climate',
    regions: [region],
    coordinates: [lat, lon],
    description: `🛰️ LIVE NASA EVENT — ${event.category} detected on ${new Date(event.date).toLocaleDateString()}. Real-time natural hazard telemetry tracked by the NASA Earth Observatory Natural Event Tracker (EONET).`,
    stat: event.category,
    affected: null,
    severity: 8,
    color: '#ff4500',
    ripples: [],
    sourceUrl: event.sourceUrl,
    actions: [
      'Inspect live satellite tracking via NASA EONET source link',
      'Support rapid-response disaster relief organizations on the ground',
      'Follow regional meteorological and emergency management advisories'
    ],
    icon: event.category === 'Wildfires' ? '🔥'
      : event.category === 'Severe Storms' ? '🌪️'
      : event.category === 'Volcanoes' ? '🌋'
      : event.category === 'Floods' ? '🌊'
      : '🛰️'
  });
}

// ---- Tooltip on hover (Crisis markers, EONET live markers, Ripple arcs, Countries) ----
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    tooltip.classList.add('hidden');
    return;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const maxDist = getFrontOcclusionLimit();

  const showTip = (text, isRipple = false) => {
    tooltip.textContent = text;
    tooltip.classList.toggle('ripple-tip', isRipple);
    tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth - 280) + 'px';
    tooltip.style.top = (e.clientY - 12) + 'px';
    tooltip.classList.remove('hidden');
    canvas.style.cursor = 'pointer';
  };

  // 1. Crisis markers
  const visibleMarkers = markers.filter(m => m.group.visible);
  const dotHits = raycaster.intersectObjects(visibleMarkers.map(m => m.mesh))
    .filter(h => h.distance <= maxDist);
  if (dotHits.length > 0) {
    const marker = visibleMarkers.find(m => m.mesh === dotHits[0].object);
    if (marker) {
      const region = Array.isArray(marker.prob.regions) ? marker.prob.regions[0] : marker.prob.region;
      showTip(`${marker.prob.icon || '🌍'} ${marker.prob.title} — ${region}`);
      return;
    }
  }

  // 2. Live EONET markers
  const visibleEonet = eonetMarkers.filter(m => m.group.visible);
  const eonetHits = raycaster.intersectObjects(visibleEonet.map(m => m.dot))
    .filter(h => h.distance <= maxDist);
  if (eonetHits.length > 0) {
    const m = visibleEonet.find(em => em.dot === eonetHits[0].object);
    if (m) {
      showTip(`🛰️ LIVE: ${m.event.title} (${m.event.category})`);
      return;
    }
  }

  // 3. Ripple arcs
  const arcHits = raycaster.intersectObjects(rippleLines.map(r => r.line))
    .filter(h => h.distance <= maxDist + 0.35);
  if (arcHits.length > 0) {
    const arc = rippleLines.find(r => r.line === arcHits[0].object);
    if (arc) {
      showTip(`🔗 Ripple: ${arc.fromProb.title} → ${arc.toProb.title} (click to inspect)`, true);
      return;
    }
  }

  // 4. Country pins
  const countryHits = raycaster.intersectObjects(countryMarkers.map(c => c.dot))
    .filter(h => h.distance <= maxDist);
  if (countryHits.length > 0) {
    const cm = countryMarkers.find(c => c.dot === countryHits[0].object);
    if (cm) {
      const linkedCount = problems.filter(p =>
        Array.isArray(p.regions) && p.regions.some(r => r.toLowerCase() === cm.country.name.toLowerCase())
      ).length;
      const suffix = linkedCount > 0 ? ` · ${linkedCount} tracked ${linkedCount === 1 ? 'crisis' : 'crises'}` : '';
      showTip(`${cm.country.flag} ${cm.country.name} (${cm.country.region})${suffix}`);
      return;
    }
  }

  tooltip.classList.add('hidden');
  canvas.style.cursor = 'grab';
});

// ---- Filter buttons ----
export function setFilter(category) {
  activeFilter = category || 'all';
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === activeFilter);
  });
  applyFilters(true);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setFilter(btn.dataset.filter);
  });
});

// ---- Animate ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (isDragging) {
    globe.rotation.x = Math.max(-MAX_TILT, Math.min(MAX_TILT, globe.rotation.x + rotVel.x));
    globe.rotation.y += rotVel.y;
  } else if (!isFlying) {
    // Smooth momentum decay + gentle auto-rotation when panel is closed
    const autoSpin = isPanelOpen ? 0 : 0.0015;
    globe.rotation.x = Math.max(-MAX_TILT, Math.min(MAX_TILT, globe.rotation.x + rotVel.x));
    globe.rotation.y += autoSpin + rotVel.y;
    rotVel.x *= 0.92;
    rotVel.y *= 0.92;
  }

  atmosphere.rotation.copy(globe.rotation);
  gridGroup.rotation.copy(globe.rotation);

  // Sync crisis markers with globe rotation
  markers.forEach(m => {
    if (!m.group.visible) return;
    const isSelected = m.prob.id === selectedProblemId;
    const pulse = Math.sin(t * (isSelected ? 3.5 : 2) + m.pulseT);
    m.ring.material.opacity = isSelected
      ? 0.65 + 0.35 * ((pulse + 1) / 2)
      : 0.3 + 0.3 * ((pulse + 1) / 2);
    const s = (isSelected ? 1.25 : 1) + 0.3 * ((pulse + 1) / 2);
    m.ring.scale.setScalar(s);
    m.group.rotation.copy(globe.rotation);
  });

  // Sync country markers with globe rotation
  countryMarkers.forEach(cm => {
    cm.group.rotation.copy(globe.rotation);
  });

  // Sync & subtly pulse ripple lines
  rippleLines.forEach((l, idx) => {
    l.mat.opacity = 0.5 + 0.35 * ((Math.sin(t * 2.6 - idx * 0.7) + 1) / 2);
    l.group.rotation.copy(globe.rotation);
  });

  // Animate EONET live markers
  eonetMarkers.forEach(m => {
    if (!m.group.visible) return;
    const pulse = Math.sin(t * 3 + m.pulseT);
    m.mat.opacity = 0.5 + 0.4 * ((pulse + 1) / 2);
    m.outerMat.opacity = 0.1 + 0.2 * ((pulse + 1) / 2);
    const s = 1 + 0.4 * ((pulse + 1) / 2);
    m.ring.scale.setScalar(s);
    m.outer.scale.setScalar(s);
    m.group.rotation.copy(globe.rotation);
  });

  // Atmosphere pulse
  atmosphere.material.opacity = 0.06 + 0.02 * Math.sin(t * 0.8);

  renderer.render(scene, camera);
}

// ---- Resize ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Time machine ----
const yearSlider = document.getElementById('year-slider');
const tmYear = document.getElementById('tm-year');

yearSlider.addEventListener('input', () => {
  activeYear = parseInt(yearSlider.value, 10);
  tmYear.textContent = activeYear;
  tmYear.style.color = activeYear < 2026 ? '#ffbe0b' : '#00f5d4';
  applyFilters(true);
});

// ---- NASA EONET Live Events ----
const eonetColors = {
  'Wildfires': 0xff4500,
  'Severe Storms': 0x00aaff,
  'Volcanoes': 0xff6600,
  'Floods': 0x0044ff,
  'Sea and Lake Ice': 0x88eeff,
  'Natural Event': 0xffffff,
};

async function loadEonetEvents() {
  try {
    const res = await fetch('/api/eonet');
    const data = await res.json();
    if (!Array.isArray(data.events)) return;

    eonetMarkers.forEach(m => disposeGroup(m.group));
    eonetMarkers = [];

    data.events.forEach(event => {
      if (!Array.isArray(event.coordinates)) return;
      const [lat, lon] = event.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const color = eonetColors[event.category] || 0xffffff;
      const pos = latLonToVec3(lat, lon, 1.02);

      // Outer glow ring
      const ringGeo = new THREE.RingGeometry(0.03, 0.05, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));

      // Inner dot
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);

      // LIVE outer pulse ring
      const outerGeo = new THREE.RingGeometry(0.055, 0.065, 16);
      const outerMat = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.3
      });
      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.position.copy(pos);
      outer.lookAt(new THREE.Vector3(0, 0, 0));

      const group = new THREE.Group();
      group.add(dot);
      group.add(ring);
      group.add(outer);
      scene.add(group);

      eonetMarkers.push({
        group, dot, ring, outer, event,
        basePos: pos.clone(),
        pulseT: Math.random() * Math.PI * 2,
        mat: ringMat, outerMat
      });
    });

    applyFilters(false);
    console.log(`🛰️ NASA EONET: ${eonetMarkers.length} live events loaded`);
  } catch (err) {
    console.error('EONET load failed:', err);
  }
}

// ---- Ripple Connection Arcs ----
export function showRippleLines(prob) {
  clearRippleLines();
  const ripples = prob.ripples || prob.ripple_effects || [];
  if (!ripples.length) return;

  const fromLat = Array.isArray(prob.coordinates) ? prob.coordinates[0] : prob.coordinates.lat;
  const fromLon = Array.isArray(prob.coordinates) ? prob.coordinates[1] : prob.coordinates.lon;
  const fromPos = latLonToVec3(fromLat, fromLon, 1.02);

  ripples.forEach(rippleId => {
    const target = problems.find(p => p.id === rippleId);
    if (!target) return;

    const toLat = Array.isArray(target.coordinates) ? target.coordinates[0] : target.coordinates.lat;
    const toLon = Array.isArray(target.coordinates) ? target.coordinates[1] : target.coordinates.lon;
    const toPos = latLonToVec3(toLat, toLon, 1.02);

    const chordDist = fromPos.distanceTo(toPos);
    const arcHeight = 0.14 + chordDist * 0.16;

    const points = [];
    for (let i = 0; i <= 56; i++) {
      const t = i / 56;
      const pos = new THREE.Vector3().lerpVectors(fromPos, toPos, t);
      pos.normalize().multiplyScalar(1.02 + Math.sin(Math.PI * t) * arcHeight);
      points.push(pos);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xf700ff, transparent: true, opacity: 0.78 });
    const line = new THREE.Line(geo, mat);

    const group = new THREE.Group();
    group.add(line);
    group.rotation.copy(globe.rotation);
    scene.add(group);
    rippleLines.push({ group, line, mat, fromProb: prob, toProb: target });
  });
}

export function clearRippleLines() {
  rippleLines.forEach(l => disposeGroup(l.group));
  rippleLines = [];
}

// ---- Cinematic GSAP Globe Flight & Camera Zoom ----
export function flyToCoords(lat, lon, targetZ = 1.85, panelOffset = true) {
  const p = latLonToVec3(lat, lon, 1);
  const rXZ = Math.hypot(p.x, p.z) || 1e-6;
  const offsetRad = panelOffset && window.innerWidth > 900 ? 0.14 : 0;
  const rawTargetY = -Math.atan2(p.x, p.z) - offsetRad;

  // Shortest angular turn from current globe.rotation.y
  const twoPi = Math.PI * 2;
  const deltaY = ((rawTargetY - globe.rotation.y + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  const finalY = globe.rotation.y + deltaY;
  const targetX = Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan2(p.y, rXZ)));

  rotVel = { x: 0, y: 0 };
  isFlying = true;

  if (window.gsap) {
    window.gsap.killTweensOf(globe.rotation);
    window.gsap.killTweensOf(camera.position);
    window.gsap.to(globe.rotation, {
      x: targetX,
      y: finalY,
      duration: 1.15,
      ease: 'power3.out',
      onComplete: () => { isFlying = false; }
    });
    window.gsap.to(camera.position, {
      z: targetZ,
      duration: 1.15,
      ease: 'power3.out'
    });
  } else {
    globe.rotation.x = targetX;
    globe.rotation.y = finalY;
    camera.position.z = targetZ;
    isFlying = false;
  }
}

export function flyToMarker(prob) {
  if (!prob) return;

  // Ensure marker is visible if user jumped from a cross-category ripple tag
  let filtersChanged = false;
  if (activeFilter !== 'all' && prob.category !== activeFilter) {
    activeFilter = 'all';
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
    filtersChanged = true;
  }
  const probYear = getCrisisYear(prob);
  if (probYear > activeYear) {
    activeYear = probYear;
    yearSlider.value = String(activeYear);
    tmYear.textContent = activeYear;
    tmYear.style.color = activeYear < 2026 ? '#ffbe0b' : '#00f5d4';
    filtersChanged = true;
  }
  if (filtersChanged) applyFilters(true);

  selectedProblemId = prob.id;
  isPanelOpen = true;
  updateActiveTrayCard(true);

  const lat = Array.isArray(prob.coordinates) ? prob.coordinates[0] : prob.coordinates.lat;
  const lon = Array.isArray(prob.coordinates) ? prob.coordinates[1] : prob.coordinates.lon;

  flyToCoords(lat, lon, 1.85, true);
  openPanel(prob);
}

export function flyToCountry(country) {
  if (!country) return;
  const linkedProblem = problems.find(p =>
    isProblemVisible(p) &&
    Array.isArray(p.regions) &&
    p.regions.some(r => r.toLowerCase() === country.name.toLowerCase())
  );

  if (linkedProblem) {
    flyToCoords(country.lat, country.lon, 1.9, true);
    selectedProblemId = linkedProblem.id;
    isPanelOpen = true;
    updateActiveTrayCard(true);
    openPanel(linkedProblem);
  } else {
    flyToCoords(country.lat, country.lon, 2.0, isPanelOpen);
  }
}

export function findCountryByName(name) {
  if (!name) return null;
  const norm = name.trim().toLowerCase();
  return countries.find(c =>
    c.name.toLowerCase() === norm || c.code.toLowerCase() === norm
  ) || null;
}

export function onPanelClose() {
  isPanelOpen = false;
  selectedProblemId = null;
  clearRippleLines();
  updateActiveTrayCard(false);
  const select = document.getElementById('country-select');
  if (select) select.value = '';

  if (window.gsap) {
    window.gsap.killTweensOf(camera.position);
    window.gsap.to(camera.position, {
      z: 2.8,
      duration: 0.9,
      ease: 'power2.out'
    });
  } else {
    camera.position.z = 2.8;
  }
}

// ---- Boot ----
loadCountries();
loadProblems();
loadEonetEvents();
animate();

// Loader fade
setTimeout(() => {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 900);
  }
}, 2400);

// Expose API to Side Panel & Cards modules
window.__globeModule = {
  showRippleLines,
  clearRippleLines,
  flyToMarker,
  flyToCoords,
  flyToCountry,
  findCountryByName,
  setFilter,
  onPanelClose,
  getProblemById: id => problems.find(p => p.id === id) || null,
  getCategoryColor: cat => '#' + (catColors[cat] || 0x00f5d4).toString(16).padStart(6, '0')
};

export { latLonToVec3, catColors, problems, countries };
