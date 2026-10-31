const GENERIC_REGIONS = /^(global|globally|global south|conflict zones|small island states|arctic communities|rural africa|rural asia|amazon regions|latin america highlands|pacific islands|southern europe)$/i;

const TOPIC_QUERY_MAP = {
  'rising sea levels': 'sea level rise coastal flooding',
  'catastrophic wildfires': 'wildfire forest fire',
  'severe droughts': 'drought water climate',
  'deforestation': 'deforestation rainforest',
  'air pollution': 'air pollution smog health',
  'food insecurity': 'food insecurity hunger crisis',
  'water scarcity': 'water scarcity drinking water crisis',
  'famine zones': 'famine starvation humanitarian',
  'child malnutrition': 'child malnutrition hunger',
  'crop failure & soil degradation': 'crop failure soil agriculture drought',
  'active war zones': 'armed conflict humanitarian war',
  'refugee crisis': 'refugee crisis displaced UNHCR',
  'climate-driven displacement': 'climate displacement migration refugees',
  'child soldiers': 'child soldiers armed groups',
  'landmines & uxo': 'landmines clearance unexploded ordnance',
  'disease outbreaks': 'disease outbreak epidemic WHO',
  'global mental health crisis': 'mental health crisis healthcare',
  'war trauma & ptsd': 'war trauma mental health conflict',
  'maternal mortality': 'maternal mortality childbirth health',
  'healthcare access deserts': 'healthcare access clinics shortage',
  'out-of-school children': 'out of school children education crisis',
  'gender education gap': 'girls education access school',
  'child labor': 'child labor exploitation',
  'digital divide': 'digital divide internet access connectivity',
  'teacher shortage': '"teacher shortage" education schools',
  'extreme poverty': 'extreme poverty global economy',
  'youth unemployment': 'youth unemployment jobs crisis',
  'sovereign debt traps': 'sovereign debt distress IMF',
  'corruption': 'public corruption anti-corruption',
  'extreme inequality': 'wealth inequality poverty gap'
};

const REGION_ALIASES = {
  'dr congo': 'Congo',
  'usa': 'United States',
  'uk': 'United Kingdom'
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const newsCache = new Map();

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function buildTopicQuery(rawTopic) {
  const key = rawTopic.toLowerCase().trim();
  if (TOPIC_QUERY_MAP[key]) return TOPIC_QUERY_MAP[key];

  // Handle dynamic NASA EONET titles (e.g. "Wildfire - California, United States")
  return rawTopic
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(severe|catastrophic|extreme|global|active|zones|deserts|traps)\b/gi, ' ')
    .replace(/[&/,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegion(rawRegion) {
  if (!rawRegion) return '';
  const trimmed = rawRegion.trim();
  if (GENERIC_REGIONS.test(trimmed) || /^-?\d+(\.\d+)?,\s*-?\d+/.test(trimmed)) {
    return '';
  }
  return REGION_ALIASES[trimmed.toLowerCase()] || trimmed;
}

async function fetchGNewsSingle(query, apiKey) {
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=3&apikey=${apiKey}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok || data.errors || !Array.isArray(data.articles)) {
    return [];
  }
  return data.articles
    .filter(a => typeof a.url === 'string' && /^https?:\/\//i.test(a.url))
    .slice(0, 3)
    .map(a => ({
      title: a.title || 'Untitled article',
      description: a.description || '',
      url: a.url,
      source: a.source?.name || 'News',
      publishedAt: a.publishedAt || null
    }));
}

async function fetchGoogleNewsRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return [];
  const xml = await response.text();

  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    if (items.length >= 3) break;
    const block = match[1];
    const extract = tag =>
      (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();

    const link = extract('link');
    if (!/^https?:\/\//i.test(link)) continue;

    const source = decodeXmlEntities(extract('source')) || 'News';
    let title = decodeXmlEntities(extract('title')) || 'Untitled article';
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`).length).trim();
    }

    const rawDate = extract('pubDate');
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : null;

    items.push({
      title,
      description: '',
      url: link,
      source,
      publishedAt
    });
  }
  return items;
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

  const cacheKey = `${topic.toLowerCase()}|${region.toLowerCase()}`;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ articles: cached.articles });
  }

  try {
    const topicQuery = buildTopicQuery(topic);
    const cleanRegion = normalizeRegion(region);
    const primaryQuery = cleanRegion ? `${topicQuery} ${cleanRegion}` : topicQuery;

    let articles = [];

    // 1. Primary: single GNews request (avoids 1 req/sec free-tier burst limit)
    if (process.env.GNEWS_API_KEY) {
      try {
        articles = await fetchGNewsSingle(primaryQuery, process.env.GNEWS_API_KEY);
      } catch {
        articles = [];
      }
    }

    // 2. Fallback: Google News RSS (works without API key and covers narrow regions)
    if (articles.length === 0) {
      articles = await fetchGoogleNewsRss(primaryQuery);
      if (articles.length === 0 && cleanRegion) {
        articles = await fetchGoogleNewsRss(topicQuery);
      }
    }

    if (articles.length > 0) {
      if (newsCache.size >= 100) {
        const oldestKey = newsCache.keys().next().value;
        newsCache.delete(oldestKey);
      }
      newsCache.set(cacheKey, { ts: Date.now(), articles });
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    }

    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(200).json({ articles: [], error: err.message });
  }
}
