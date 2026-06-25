export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,windspeed_10m,weathercode&timezone=auto`
    );
    const data = await response.json();
    const current = data.current;

    res.status(200).json({
      temperature: current.temperature_2m,
      precipitation: current.precipitation,
      windspeed: current.windspeed_10m,
      weathercode: current.weathercode,
      unit: data.current_units?.temperature_2m || '°C'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch climate data' });
  }
}