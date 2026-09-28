module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ===== ASTHL ID check (access gate) =====
  if (req.body && req.body.checkId !== undefined) {
    // ACCESS_IDS format: "ID1,ID2:2026-12-31,..." — ID ke saath expiry date (YYYY-MM-DD ya DD-MM-YYYY dono chalega)
    // v29: comma / newline /semicolon sab separator; date flexible; ek hi ID kai baar likhi ho to koi bhi valid entry chalegi
    const entries = (process.env.ACCESS_IDS || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    const idv = String(req.body.checkId).trim().toUpperCase();
    let ok = false, expired = false;
    for (const entry of entries) {
      const cIdx = entry.indexOf(':');
      const eid = (cIdx === -1 ? entry : entry.slice(0, cIdx)).trim().toUpperCase();
      const expRaw = cIdx === -1 ? '' : entry.slice(cIdx + 1).trim();
      if (eid !== idv) continue;
      if (!expRaw) { ok = true; continue; } // bina date = hamesha valid
      const until = parseExpiry(expRaw);
      if (until && Date.now() <= until.getTime()) { ok = true; continue; }
      expired = true; // date beet chuki ya samajh nahi aayi
    }
    return res.status(200).json({ access: ok, expired: expired && !ok });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    const { messages, sessionId, patientName, patientAge, patientMobile, mobileVerified, category, clinic, address, accessId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const trimmedMessages = messages.slice(-30);
    const apiKey = process.env.GEMINI_API_KEY;
    const sheetUrl = process.env.GOOGLE_SHEET_URL;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
    }

    // v33: 4 ALAG-ALAG models — har model ka apna quota hota hai
    // (gemini-flash-latest = gemini-2.5-flash hi hai, duplicate try bekar tha)
    // Free tier limits (2026): flash 250/din, flash-lite 1000/din, pro 100/din
    const models = [
      'gemini-2.5-flash',        // sabse achha quality
      'gemini-2.5-flash-lite',   // 4x zyada daily quota — fallback hero
      'gemini-2.0-flash',        // purana model, agar zinda ho to kaam aayega
      'gemini-2.5-pro'           // last resort (kam quota, best quality)
    ];

    let reply = null;
    let lastErr = 0; // v33: aakhri error status yaad rakho (429=quota, 400/403=key)

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
          let errDetail = '';
          try { const errBody = await geminiResponse.text(); errDetail = errBody.slice(0, 200); } catch (e) {}
          console.error(`Model ${model} error:`, geminiResponse.status, errDetail);
          if (geminiResponse.status === 429) { lastErr = 429; } else { lastErr = lastErr || geminiResponse.status; }
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
          accessId: accessId || '',
              category: category || '',
              clinic: clinic || '',
              address: (address || '').slice(0, 500),
              userMessage: displayMsg.slice(0, 40000),
              botReply: reply.slice(0, 40000)
            })
          });
          console.log('Logged to Google Sheet:', patientName, patientMobile);
        } catch (logErr) {
          console.error('Sheet log error (non-fatal):', logErr.message);
        }
      }

      return res.status(200).json({ reply: reply });
    } else {
      // v33: user ko sahi wajah batado
      if (lastErr === 429) {
        return res.status(503).json({ error: 'Aaj ka free limit lagbhag khatam ho gaya hai ya bahut tezi se requests ho rahi hain. Thodi der ruk kar dobara try karein. (Limit roz raat ~1:30 PM Indian time par reset hoti hai)' });
      } else if (lastErr === 400 || lastErr === 401 || lastErr === 403) {
        return res.status(500).json({ error: 'Server ki API key me dikkat hai. Admin se sampark karein: +91-7903873282' });
      }
      return res.status(503).json({ error: 'Abhi sab models busy hain. 1-2 minute baad try karein.' });
    }

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Thodi der baad try karein.' });
  }
};


// ===== Expiry date parser (v29) =====
// YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY — sab formats samajhta hai
function parseExpiry(s) {
  s = String(s).trim();
  let m = s.match(/^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})$/);
  if (m) return new Date(m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') + 'T23:59:59+05:30');
  m = s.match(/^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})$/);
  if (m) return new Date(m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0') + 'T23:59:59+05:30');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
