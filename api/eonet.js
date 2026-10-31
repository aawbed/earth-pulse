function extractLatLon(geo) {
  if (!geo || !Array.isArray(geo.coordinates)) return null;

  // GeoJSON Point: [lon, lat]
  if (geo.type === 'Point' || typeof geo.coordinates[0] === 'number') {
    const [lon, lat] = geo.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    return null;
  }

  // GeoJSON Polygon: [[[lon, lat], ...]] -> compute outer ring centroid
  const ring = Array.isArray(geo.coordinates[0]) ? geo.coordinates[0] : null;
  if (ring && ring.length > 0 && Array.isArray(ring[0])) {
    let sumLat = 0;
    let sumLon = 0;
    let count = 0;
    for (const pt of ring) {
      if (Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
        sumLon += pt[0];
        sumLat += pt[1];
        count++;
      }
    }
    if (count > 0) return [sumLat / count, sumLon / count];
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=20'
    );
    if (!response.ok) {
      throw new Error(`NASA EONET responded with ${response.status}`);
    }
    const data = await response.json();

    const events = (data.events || [])
      .map(e => {
        if (!Array.isArray(e.geometry) || e.geometry.length === 0) return null;
        const geo = e.geometry[e.geometry.length - 1];
        const coords = extractLatLon(geo);
        if (!coords) return null;

        return {
          id: e.id,
          title: e.title,
          category: e.categories?.[0]?.title || 'Natural Event',
          categoryId: e.categories?.[0]?.id || 'other',
          date: geo.date,
          coordinates: coords,
          sourceUrl: e.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov'
        };
      })
      .filter(Boolean);

    return res.status(200).json({ events });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
