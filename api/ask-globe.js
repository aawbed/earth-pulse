const FALLBACK_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ answer: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
    const problem = body.problem;

    if (!question || !problem || typeof problem !== 'object') {
      return res.status(400).json({ answer: 'Missing question or crisis context.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({ answer: 'AI analyst unavailable: GROQ_API_KEY is not configured.' });
    }

    const regions = Array.isArray(problem.regions)
      ? problem.regions.join(', ')
      : (problem.region || 'Global');
    const statContext = problem.stat ? ` Key metric: ${problem.stat}.` : '';
    const severityContext = problem.severity ? ` Severity: ${problem.severity}/10.` : '';

    const modelsToTry = process.env.GROQ_MODEL
      ? [process.env.GROQ_MODEL, ...FALLBACK_MODELS]
      : FALLBACK_MODELS;

    let lastError = 'Upstream request failed.';

    for (const model of modelsToTry) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          max_tokens: 450,
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: `You are an expert humanitarian and environmental analyst for Earth Pulse, a global crisis telemetry platform. The user is inspecting "${problem.title}" (${problem.category}) affecting ${regions}.${statContext}${severityContext} Context: ${problem.description || ''}. Answer concisely in 2-4 insightful, human, grounded sentences. Do not use bullet points or markdown headers.`
            },
            { role: 'user', content: question }
          ]
        })
      });

      const data = await response.json();
      if (response.ok && !data.error) {
        const answer = data.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (answer) {
          return res.status(200).json({ answer });
        }
      }

      lastError = data.error?.message || `HTTP ${response.status}`;
      // Only retry next model if model was decommissioned / unavailable / rate-limited
      if (response.status !== 400 && response.status !== 404 && response.status !== 429) {
        break;
      }
    }

    return res.status(200).json({ answer: `Analyst error: ${lastError}` });
  } catch (err) {
    return res.status(200).json({ answer: `Server error: ${err.message}` });
  }
}
