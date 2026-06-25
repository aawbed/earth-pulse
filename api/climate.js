export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=precipitation_sum&timezone=auto&forecast_days=7`
    );
    const data = await response.json();
    const w = data.current_weather;

    // Sum of next 7 days precipitation
    const weeklyRain = data.daily?.precipitation_sum
      ? data.daily.precipitation_sum.reduce((a, b) => a + (b || 0), 0).toFixed(1)
      : '0.0';

    res.status(200).json({
      temperature: w.temperature,
      windspeed: w.windspeed,
      precipitation: weeklyRain + ' (7-day)',
      unit: '°C'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch climate data' });
  }
}