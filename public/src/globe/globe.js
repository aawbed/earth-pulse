// ================================
// EARTH PULSE — Globe Engine
// Three.js 3D rotating globe
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

// ---- Grid lines ----
const gridMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.06 });
for (let lat = -80; lat <= 80; lat += 20) {
  const pts = [];
  for (let lon = 0; lon <= 360; lon += 2) {
    pts.push(latLonToVec3(lat, lon, 1.002));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
}
for (let lon = 0; lon < 360; lon += 20) {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 2) {
    pts.push(latLonToVec3(lat, lon, 1.002));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
}

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

// ---- Category colors ----
const catColors = {
  climate:   0x00f5d4,
  hunger:    0xffbe0b,
  conflict:  0xff4060,
  health:    0xa78bfa,
  education: 0x38bdf8,
  economy:   0xfb923c,
};

// ---- Load problems & create markers ----
let problems = [];
let markers = [];
let activeFilter = 'all';
let rippleLines = [];

async function loadProblems() {
  try {
    const res = await fetch('/src/data/problems.json');
    const data = await res.json();
    // Handle both {problems: [...]} and plain array
    problems = Array.isArray(data) ? data : (data.problems || []);
    if (problems.length === 0) {
      console.warn('No problems loaded — check problems.json structure');
    }
    createMarkers();
    populateTray();
  } catch (err) {
    console.error('Failed to load problems.json:', err);
  }
}

function createMarkers() {
  // Clear existing
  markers.forEach(m => {
    m.group.remove(m.mesh);
    m.group.remove(m.ring);
    scene.remove(m.group);
  });
  markers = [];

  const filtered = activeFilter === 'all'
    ? problems
    : problems.filter(p => p.category === activeFilter);

  filtered.forEach(prob => {
    const color = catColors[prob.category] || 0xffffff;

    // Get coordinates from array format [lat, lon]
    const lat = Array.isArray(prob.coordinates) ? prob.coordinates[0] : prob.coordinates.lat;
    const lon = Array.isArray(prob.coordinates) ? prob.coordinates[1] : prob.coordinates.lon;

    const pos = latLonToVec3(lat, lon, 1.02);

    // Inner dot
    const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);

    // Outer pulse ring
    const ringGeo = new THREE.RingGeometry(0.025, 0.038, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color, side: THREE.DoubleSide, transparent: true, opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(new THREE.Vector3(0, 0, 0));

    // Group dot + ring so they rotate together with the globe
    const group = new THREE.Group();
    group.add(dot);
    group.add(ring);
    scene.add(group);

    markers.push({
      mesh: dot,
      ring,
      group,
      prob,
      basePos: pos.clone(),
      pulseT: Math.random() * Math.PI * 2
    });
  });
}

function populateTray() {
  const tray = document.getElementById('tray-scroll');
  tray.innerHTML = '';
  const filtered = activeFilter === 'all' ? problems : problems.filter(p => p.category === activeFilter);
  filtered.forEach(prob => {
    const hex = '#' + (catColors[prob.category] || 0xffffff).toString(16).padStart(6, '0');
    const card = document.createElement('div');
    card.className = 'tray-card';
    card.innerHTML = `
      <div class="tray-card-dot" style="background:${hex};box-shadow:0 0 8px ${hex}"></div>
      <div>
        <div class="tray-card-title">${prob.title}</div>
        <div class="tray-card-region">${Array.isArray(prob.regions) ? prob.regions[0] : prob.region}</div>
      </div>
    `;
    card.addEventListener('click', () => openPanel(prob));
    tray.appendChild(card);
  });
}

// ---- Drag to rotate ----
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let rotVel = { x: 0, y: 0 };

canvas.addEventListener('mousedown', e => {
  isDragging = true;
  prevMouse = { x: e.clientX, y: e.clientY };
  rotVel = { x: 0, y: 0 };
});
window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  rotVel.x = dy * 0.005;
  rotVel.y = dx * 0.005;
  prevMouse = { x: e.clientX, y: e.clientY };
});

// Touch support
canvas.addEventListener('touchstart', e => {
  isDragging = true;
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});
canvas.addEventListener('touchend', () => { isDragging = false; });
canvas.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const dx = e.touches[0].clientX - prevMouse.x;
  const dy = e.touches[0].clientY - prevMouse.y;
  rotVel.x = dy * 0.005;
  rotVel.y = dx * 0.005;
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
});

// ---- Zoom ----
canvas.addEventListener('wheel', e => {
  camera.position.z = Math.max(1.6, Math.min(5, camera.position.z + e.deltaY * 0.003));
});

// ---- Raycaster for click ----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
raycaster.params.Points.threshold = 0.05;

canvas.addEventListener('click', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Check regular markers first
  const dotMeshes = markers.map(m => m.mesh);
  const hits = raycaster.intersectObjects(dotMeshes);
  if (hits.length > 0) {
    const marker = markers.find(m => m.mesh === hits[0].object);
    if (marker) { openPanel(marker.prob); zoomToMarker(marker.basePos); return; }
  }

  // Check EONET markers
  const eonetDots = eonetMarkers.map(m => m.dot);
  const eonetHits = raycaster.intersectObjects(eonetDots);
  if (eonetHits.length > 0) {
    const m = eonetMarkers.find(m => m.dot === eonetHits[0].object);
    if (m) {
      // Show tooltip with live event info
      const region = Array.isArray(m.event.coordinates)
        ? `${m.event.coordinates[0].toFixed(2)}, ${m.event.coordinates[1].toFixed(2)}`
        : '';
      openPanel({
        title: m.event.title,
        category: 'climate',
        regions: [region],
        coordinates: m.event.coordinates,
        description: `🛰️ LIVE NASA EVENT — ${m.event.category} detected on ${new Date(m.event.date).toLocaleDateString()}. This is a real-time natural event tracked by NASA Earth Observatory.`,
        stat: m.event.category,
        affected: null,
        severity: 8,
        ripples: [],
        actions: ['Monitor updates at nasa.gov/eonet', 'Support disaster relief organizations', 'Follow local emergency services guidance'],
        icon: m.event.category === 'Wildfires' ? '🔥' : m.event.category === 'Severe Storms' ? '🌪️' : m.event.category === 'Volcanoes' ? '🌋' : '⚠️'
      });
    }
  }
});

// Tooltip on hover
canvas.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const dotMeshes = markers.map(m => m.mesh);
  const hits = raycaster.intersectObjects(dotMeshes);
  if (hits.length > 0) {
    const marker = markers.find(m => m.mesh === hits[0].object);
    if (marker) {
      const region = Array.isArray(marker.prob.regions) ? marker.prob.regions[0] : marker.prob.region;
      tooltip.textContent = `${marker.prob.title} — ${region}`;
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
      tooltip.classList.remove('hidden');
      canvas.style.cursor = 'pointer';
    }
  } else {
    tooltip.classList.add('hidden');
    canvas.style.cursor = 'grab';
  }
});

// ---- Filter buttons ----
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    createMarkers();
    populateTray();
  });
});

// ---- Animate ----
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Auto-rotate
  if (!isDragging) {
    globe.rotation.y += 0.0015;
    atmosphere.rotation.y += 0.0015;
    rotVel.x *= 0.92;
    rotVel.y *= 0.92;
  } else {
    globe.rotation.x += rotVel.x;
    globe.rotation.y += rotVel.y;
    atmosphere.rotation.x += rotVel.x;
    atmosphere.rotation.y += rotVel.y;
  }

  // Sync markers with globe rotation
 // Sync markers with globe rotation
  markers.forEach(m => {
    const pulse = Math.sin(t * 2 + m.pulseT);
    m.ring.material.opacity = 0.3 + 0.3 * ((pulse + 1) / 2);
    const s = 1 + 0.3 * ((pulse + 1) / 2);
    m.ring.scale.setScalar(s);

    // Sync group rotation with globe
    m.group.rotation.copy(globe.rotation);

  });

  // Sync ripple lines with globe rotation
  rippleLines.forEach(l => {
    l.group.rotation.copy(globe.rotation);
  });

  // Animate EONET live markers
  eonetMarkers.forEach(m => {
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
// Year each crisis category became prominent
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

yearSlider.addEventListener('input', () => {
  const year = parseInt(yearSlider.value);
  tmYear.textContent = year;

  // Filter markers by year
  markers.forEach(m => {
    const crisisYear = crisisYears[m.prob.id] || 1990;
    const visible = crisisYear <= year;
    m.group.visible = visible;
  });

  // Update active crises count
  const visibleCount = markers.filter(m => {
    const crisisYear = crisisYears[m.prob.id] || 1990;
    return crisisYear <= parseInt(yearSlider.value);
  }).length;

  const statEl = document.getElementById('stat-problems');
  if (statEl) statEl.textContent = visibleCount;

  // Flash the year display
  tmYear.style.color = year < 2026 ? '#ffbe0b' : '#00f5d4';
});

// ---- NASA EONET Live Events ----
let eonetMarkers = [];

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
    if (!data.events) return;

    data.events.forEach(event => {
      const color = eonetColors[event.category] || 0xffffff;
      const lat = event.coordinates[0];
      const lon = event.coordinates[1];
      const pos = latLonToVec3(lat, lon, 1.02);

      // Outer glow ring — bigger and more dramatic than regular markers
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

      // LIVE label ring — extra outer pulse
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

    console.log(`🛰️ NASA EONET: ${data.events.length} live events loaded`);
  } catch (err) {
    console.error('EONET load failed:', err);
  }
}

// ---- Boot ----
loadProblems();
loadEonetEvents();
animate();

// Loader fade
setTimeout(() => {
  document.getElementById('loader').classList.add('fade-out');
  setTimeout(() => document.getElementById('loader').remove(), 900);
}, 2800);


export function showRippleLines(prob) {
  clearRippleLines();
  const ripples = prob.ripples || prob.ripple_effects || [];
  const fromLat = Array.isArray(prob.coordinates) ? prob.coordinates[0] : prob.coordinates.lat;
  const fromLon = Array.isArray(prob.coordinates) ? prob.coordinates[1] : prob.coordinates.lon;
  const fromPos = latLonToVec3(fromLat, fromLon, 1.02);

  ripples.forEach(rippleId => {
    const target = problems.find(p => p.id === rippleId);
    if (!target) return;

    const toLat = Array.isArray(target.coordinates) ? target.coordinates[0] : target.coordinates.lat;
    const toLon = Array.isArray(target.coordinates) ? target.coordinates[1] : target.coordinates.lon;
    const toPos = latLonToVec3(toLat, toLon, 1.02);

    const points = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const pos = new THREE.Vector3().lerpVectors(fromPos, toPos, t);
      pos.normalize().multiplyScalar(1.02 + Math.sin(Math.PI * t) * 0.3);
      points.push(pos);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xf700ff, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(geo, mat);

    // Wrap in group so it rotates with globe
    const group = new THREE.Group();
    group.add(line);
    group.rotation.copy(globe.rotation);
    scene.add(group);
    rippleLines.push({ group, mat });
  });
}

export function clearRippleLines() {
  rippleLines.forEach(l => scene.remove(l.group));
  rippleLines = [];
}

// ---- Fly to marker ----
  function flyToMarker(prob) {
  const targetMarker = markers.find(m => m.prob.id === prob.id);
  if (!targetMarker) return;
  openPanel(prob);
}

// ---- Cinematic zoom ----
function zoomToMarker(targetPos) {
  const startZ = camera.position.z;
  const targetZ = 1.8;
  const duration = 1000;
  const start = performance.now();

  function animateZoom(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.z = startZ + (targetZ - startZ) * ease;
    if (t < 1) requestAnimationFrame(animateZoom);
  }
  requestAnimationFrame(animateZoom);
}

// Expose to panel
window.__globeModule = { showRippleLines, clearRippleLines };

export { latLonToVec3, catColors, problems };