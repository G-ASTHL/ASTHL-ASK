module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Content-Type', 'application/json');

  try {
    const { messages, sessionId, patientName, patientAge, patientMobile, mobileVerified, category, clinic, address } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const trimmedMessages = messages.slice(-30);
    const apiKey = process.env.GEMINI_API_KEY;
    const sheetUrl = process.env.GOOGLE_SHEET_URL;

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
              generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topP: 0.9 }
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
      // ===== Google Sheet mein log karo =====
      const userMessages = trimmedMessages.filter(m => m.role === 'user' || (m.parts && m.role !== 'model'));
      const lastUserMsg = userMessages[userMessages.length - 1];
      const userText = lastUserMsg?.parts?.[0]?.text || lastUserMsg?.content || '';

      // System prompt ko skip karo
      const isSystemPrompt = userText.startsWith('ASTHL') && userText.length > 500;
      const displayMsg = isSystemPrompt ? '(Session start)' : userText;

      if (sheetUrl && !isSystemPrompt && displayMsg) {
        try {
          await fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId || 'unknown',
              patientName: patientName || '',
              patientAge: patientAge || '',
              patientMobile: patientMobile || '',
              mobileVerified: mobileVerified ? 'Yes' : 'No',
              category: category || '',
              clinic: clinic || '',
              address: (address || '').slice(0, 200),
              userMessage: displayMsg.slice(0, 5000),
              botReply: reply.slice(0, 5000)
            })
          });
          console.log('Logged to Google Sheet:', patientName, patientMobile);
        } catch (logErr) {
          console.error('Sheet log error (non-fatal):', logErr.message);
        }
      }

      return res.status(200).json({ reply: reply });
    } else {
      return res.status(503).json({ error: 'Abhi sab models busy hain. 1-2 minute baad try karein.' });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Thodi der baad try karein.' });
  }
};
