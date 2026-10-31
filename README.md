# 🌍 Earth Pulse — The World Is Alive

[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-earth--pulse--delta.vercel.app-00f5d4?style=for-the-badge&logo=vercel&logoColor=030712)](https://earth-pulse-delta.vercel.app)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D_Globe-0d1526?style=for-the-badge&logo=threedotjs&logoColor=00f5d4)](https://threejs.org/)
[![Serverless](https://img.shields.io/badge/Vercel-Serverless_APIs-0d1526?style=for-the-badge&logo=vercel&logoColor=00f5d4)](https://vercel.com/)
[![AI Analyst](https://img.shields.io/badge/Groq-GPT--OSS_120B-0d1526?style=for-the-badge&logoColor=f700ff)](https://groq.com/)

**Earth Pulse** is an interactive 3D global crisis telemetry and visualization platform that maps **30 interconnected planetary crises** alongside **real-time NASA satellite natural hazard feeds**, **live local meteorological telemetry**, **contextual crisis journalism**, and an **AI humanitarian analyst**.

🔗 **Live Platform:** [earth-pulse-delta.vercel.app](https://earth-pulse-delta.vercel.app)

---

## ✨ Core Features

- **🌐 Interactive 3D WebGL Globe (Three.js + GSAP):**
  - Custom dark-mode Earth topology, specular ocean reflections, synchronized coordinate grid, starfield, and pulsing atmospheric glow.
  - Smooth GSAP camera & globe flight (`flyToMarker` / `flyToCoords`) with front-hemisphere raycast occlusion and momentum-based drag physics.
- **🔗 Interactive Ripple-Effect Arcs:**
  - Selecting any crisis renders 3D great-circle arcs to downstream systemic crises (e.g., *Severe Droughts → Food Insecurity → Active War Zones*).
  - Click any ripple pill in the side panel or click directly on a 3D arc to fly across the globe to the linked crisis.
- **🛰️ Live NASA EONET Hazard Telemetry (`/api/eonet`):**
  - Streams active wildfires, severe storms, volcanic activity, floods, and sea-ice events from NASA's Earth Observatory Natural Event Tracker (supporting both GeoJSON `Point` and `Polygon` centroid geometries).
- **🌡️ Real-Time Climate Conditions (`/api/climate`):**
  - Queries Open-Meteo for live temperature, wind speed, and 7-day cumulative precipitation at any crisis or hazard coordinate.
- **📰 Regional Crisis News Feed (`/api/news`):**
  - Fetches live, region-scoped reporting via GNews API v4 with automatic Google News RSS fallback and Edge caching (works out-of-the-box even without a `GNEWS_API_KEY`).
- **🤖 "Ask the Globe" AI Analyst (`/api/ask-globe`):**
  - Powered by **GPT-OSS 120B** on Groq (with automatic multi-model fallback) — answers user questions grounded in the active crisis's metrics, severity, and affected regions.
- **⏳ Time Machine (1990 – 2026) & Country Jump:**
  - Scrub from `1990` to `2026` to watch global crises compound over time while tracking dynamic Active Crisis counts, People Affected, and the composite **Earth Health Score**.
  - Jump directly to **58 tracked countries** via the navbar selector or interactive country flag chips inside the crisis panel.

---

## 🗂️ Project Architecture

```text
earth_pulse/
├── api/                        # Vercel Serverless Functions (ESM)
│   ├── ask-globe.js            # POST /api/ask-globe — Groq GPT-OSS 120B crisis analyst
│   ├── climate.js              # GET  /api/climate   — Open-Meteo weather & 7-day rain
│   ├── eonet.js                # GET  /api/eonet     — NASA EONET v3 live natural hazards
│   └── news.js                 # GET  /api/news      — GNews regional crisis headlines
├── public/                     # Zero-build static frontend
│   ├── index.html              # HUD, Side Panel, Crisis Showcase, Health Dashboard
│   └── src/
│       ├── globe/globe.js      # Three.js scene, raycasting, GSAP flight, Time Machine
│       ├── components/panel.js # Crisis detail drawer, ripple navigation, live APIs
│       ├── components/cards.js # Stat counters, category showcase triggers, scroll HUD
│       ├── data/problems.json  # 30 curated global crises across 6 categories
│       ├── data/countries.json # 58 country coordinates, ISO codes & flags
│       └── styles/main.css     # Deep-space retrofuturist design system
├── dev-server.js               # Local Node.js dev server (serves public/ + /api/*)
├── vercel.json                 # Vercel static + serverless routing config
└── .env.example                # Environment variable template
```

---

## 🚀 Running Locally

### 1. Clone & install dev dependencies

```bash
git clone https://github.com/aawbed/earth-pulse.git
cd earth-pulse
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GROQ_API_KEY` | Yes (for AI) | API key from [console.groq.com](https://console.groq.com) for *Ask the Globe* |
| `GNEWS_API_KEY` | Optional | API key from [gnews.io](https://gnews.io) for *Latest News* (falls back to Google News RSS if omitted; *NASA EONET & Open-Meteo require no keys*) |

### 3. Start the local full-stack dev server

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** — both the 3D frontend and all `/api/*` serverless routes run locally out of the box.

---

## 🛠️ Tech Stack

- **3D & Animation:** Three.js (`WebGLRenderer`), GSAP 3
- **Frontend:** Semantic HTML5, Vanilla ES Modules, CSS3 Custom Properties
- **Backend:** Node.js Serverless Functions on Vercel
- **Live Data & AI:** NASA EONET API v3, Open-Meteo Forecast API, GNews API v4, Groq Cloud (`openai/gpt-oss-120b`)

---

## 👤 Author

**Jermaine Obed Oyieri** — [@aawbed](https://github.com/aawbed)
