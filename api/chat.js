module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const trimmedMessages = messages.slice(-20);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 1000,
            topP: 0.9
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return res.status(geminiResponse.status).json({
        error: `API error: ${geminiResponse.status}`
      });
    }

    const data = await geminiResponse.json();

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Sorry, samajh nahi aaya. Dobara try karein.';

    return res.status(200).json({ reply: reply });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'Server error. Thodi der baad try karein.'
    });
  }
};
