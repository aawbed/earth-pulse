export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const latNum = parseFloat(req.query?.lat);
  const lonNum = parseFloat(req.query?.lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
    return res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
  }

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current_weather=true&daily=precipitation_sum&timezone=auto&forecast_days=7`
    );
    if (!response.ok) {
      throw new Error(`Open-Meteo responded with ${response.status}`);
    }

    const data = await response.json();
    const w = data.current_weather;
    if (!w) {
      throw new Error('Weather telemetry unavailable for coordinates');
    }

    const weeklyRain = Array.isArray(data.daily?.precipitation_sum)
      ? Number(data.daily.precipitation_sum.reduce((a, b) => a + (b || 0), 0).toFixed(1))
      : 0;

    return res.status(200).json({
      temperature: w.temperature,
      windspeed: w.windspeed,
      precipitation: weeklyRain,
      precipitationPeriod: '7-day',
      unit: '°C'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch climate data', detail: err.message });
  }
}
