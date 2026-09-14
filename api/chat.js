module.exports = async (req, res) => {
  // CORS — asthl.in website se access ke liye
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const trimmedMessages = messages.slice(-30);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
    }

    const models = [
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite'
    ];

    let reply = null;

    for (const model of models) {
      try {
        console.log('Trying model:', model);

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: trimmedMessages.map(m => ({
                role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
                parts: m.parts || [{ text: m.content }]
              })),
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                topP: 0.9
              }
            })
          }
        );

        if (!geminiResponse.ok) {
          console.error(`Model ${model} error:`, geminiResponse.status);
          continue;
        }

        const data = await geminiResponse.json();
        reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (reply) {
          console.log('Success with model:', model);
          break;
        }

      } catch (modelErr) {
        console.error(`Model ${model} failed:`, modelErr.message);
        continue;
      }
    }

    if (reply) {
      return res.status(200).json({ reply: reply });
    } else {
      return res.status(503).json({
        error: 'Abhi sab models busy hain. 1-2 minute baad try karein.'
      });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'Server error. Thodi der baad try karein.'
    });
  }
};
