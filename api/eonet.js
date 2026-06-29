export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=20'
    );
    const data = await response.json();

    const events = data.events
      .filter(e => e.geometry?.length > 0)
      .map(e => {
        const geo = e.geometry[e.geometry.length - 1];
        return {
          id: e.id,
          title: e.title,
          category: e.categories?.[0]?.title || 'Natural Event',
          categoryId: e.categories?.[0]?.id || 'other',
          date: geo.date,
          coordinates: [geo.coordinates[1], geo.coordinates[0]]
        };
      });

    res.status(200).json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}