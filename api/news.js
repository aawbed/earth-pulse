export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { topic, region } = req.query;

  if (!process.env.GNEWS_API_KEY) {
    return res.status(200).json({ articles: [], error: 'GNEWS_API_KEY not set' });
  }

  try {
    const query = encodeURIComponent(`${topic}`);
    const response = await fetch(
      `https://gnews.io/api/v4/search?q=${query}&lang=en&max=3&apikey=${process.env.GNEWS_API_KEY}`
    );
    const data = await response.json();

    if (data.errors) {
      return res.status(200).json({ articles: [], error: data.errors[0] });
    }

    const articles = (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt
    }));

    res.status(200).json({ articles });
  } catch (err) {
    res.status(200).json({ articles: [], error: err.message });
  }
}