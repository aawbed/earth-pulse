export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { question, problem } = req.body;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are an expert analyst for Earth Pulse, a global crisis visualization platform.
The user is looking at: "${problem.title}" in ${Array.isArray(problem.regions) ? problem.regions[0] : problem.region}.
Category: ${problem.category}. Description: ${problem.description}.
Answer concisely (2-4 sentences), insightful and human. No bullet points.`
        },
        { role: 'user', content: question }
      ]
    })
  });

  const data = await response.json();
  res.status(200).json({ 
    answer: data.choices?.[0]?.message?.content || 'No response.' 
  });
}