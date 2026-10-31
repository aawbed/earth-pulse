const GENERIC_REGIONS = /^(global|globally|global south|conflict zones|small island states|arctic communities|rural africa|rural asia|amazon regions|latin america highlands)$/i;

async function fetchGNews(searchQuery, apiKey) {
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(searchQuery)}&lang=en&max=3&apikey=${apiKey}`;
  const response = await fetch(url);
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const topic = (req.query?.topic || '').trim();
  const region = (req.query?.region || '').trim();

  if (!topic) {
    return res.status(400).json({ articles: [], error: 'Missing topic parameter' });
  }

  if (!process.env.GNEWS_API_KEY) {
    return res.status(200).json({ articles: [], error: 'GNEWS_API_KEY not configured' });
  }

  try {
    const cleanTopic = topic.replace(/[&/]+/g, ' ').replace(/\s+/g, ' ').trim();
    const hasSpecificRegion = region && !GENERIC_REGIONS.test(region) && !/^-?\d+(\.\d+)?,\s*-?\d+/.test(region);

    const primaryQuery = hasSpecificRegion
      ? `${cleanTopic} ${region}`
      : `${cleanTopic} crisis`;

    let data = await fetchGNews(primaryQuery, process.env.GNEWS_API_KEY);

    if (data.errors) {
      return res.status(200).json({ articles: [], error: data.errors[0] });
    }

    // Fallback to global crisis context if regional query is too narrow
    if (hasSpecificRegion && (!data.articles || data.articles.length === 0)) {
      data = await fetchGNews(`${cleanTopic} crisis`, process.env.GNEWS_API_KEY);
    }

    const articles = (data.articles || [])
      .filter(a => typeof a.url === 'string' && /^https?:\/\//i.test(a.url))
      .map(a => ({
        title: a.title || 'Untitled article',
        description: a.description || '',
        url: a.url,
        source: a.source?.name || 'News',
        publishedAt: a.publishedAt
      }));

    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(200).json({ articles: [], error: err.message });
  }
}
