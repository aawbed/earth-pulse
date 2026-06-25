export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { topic, region } = req.query;

  try {
    const query = encodeURIComponent(`${topic} ${region} crisis`);
    const response = await fetch(
      `https://gnews.io/api/v4/search?q=${query}&lang=en&max=3&apikey=${process.env.GNEWS_API_KEY}`
    );
    const data = await response.json();

    const articles = (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt
    }));

    res.status(200).json({ articles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}