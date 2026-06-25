export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation,relativehumidity_2m&timezone=auto&forecast_days=1`
    );
    const data = await response.json();
    const w = data.current_weather;

    // Get precipitation from first hourly value
    const precipitation = data.hourly?.precipitation?.[0] ?? 0;

    res.status(200).json({
      temperature: w.temperature,
      windspeed: w.windspeed,
      precipitation: precipitation,
      unit: '°C'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch climate data' });
  }
}