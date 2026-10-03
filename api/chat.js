const db = require('./_supa.js');   // v4: ab Supabase (database) par log

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

    // v37: system prompt (messages[0]) kabhi cut na ho — warna lambi chat me AI instructions bhool jaata tha
const trimmedMessages = messages.length > 30 ? [messages[0]].concat(messages.slice(-29)) : messages.slice();
    const apiKey = process.env.GEMINI_API_KEY;
    const sheetUrl = process.env.GOOGLE_SHEET_URL;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
    }

    // v37: (a) system prompt kabhi slice na ho — lambi chat me instructions gayab ho rahe the; (b) GROQ ko system prompt sahi 'system' role me jaata hai (user nahi) — isse faltu jawab band
// v35: v32 wala PRIMARY model wapas — gemini-flash-latest hi achhe result ka asli model tha
// (v33 me primary badalne se medicine selection quality giri thi — ab restore)
    const models = [
      'gemini-flash-latest',      // PRIMARY (v32 jaisa) — best quality
      'gemini-2.5-flash',         // fallback 1
      'gemini-2.5-flash-lite',    // fallback 2 — 4x zyada quota
      'gemini-2.5-pro'            // last resort (kam quota)
    ];

    let reply = null;
    let lastErr = 0; // v33: aakhri error status yaad rakho (429=quota, 400/403=key)

    const tryGemini = async function () {
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
          return reply;
        }
      } catch (modelErr) {
        console.error(`Model ${model} failed:`, modelErr.message);
        continue;
      }
    }
      return null;
    };

    // ===== v34: GROQ (FREE, unlimited) — v36 se PATIENT chat ka PRIMARY =====
    // console.groq.com — FREE, koi card nahi. Doctor chat me sirf backup.
    const tryGroq = async function () {
      if (!process.env.GROQ_API_KEY) return null;
      const groqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
      const groqMessages = trimmedMessages.map((m, i) => {
        const txt = (m.parts && m.parts[0] && m.parts[0].text) || m.content || '';
        // v37: ASTHL system prompt ko 'system' role me bhejo — GPT models isse hi instruction maante hain
        if (i === 0 && txt.indexOf('ASTHL') !== -1 && txt.length > 400) {
          return { role: 'system', content: txt };
        }
        return { role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user', content: txt };
      });
      for (const gm of groqModels) {
        try {
          console.log('Trying Groq model:', gm);
          const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
            },
            body: JSON.stringify({
              model: gm,
              messages: groqMessages,
              temperature: 0.7,
              max_tokens: 8192,
              top_p: 0.9
            })
          });
          if (!gr.ok) {
            let gd = '';
            try { gd = (await gr.text()).slice(0, 200); } catch (e) {}
            console.error('Groq model error:', gm, gr.status, gd);
            lastErr = lastErr || gr.status;
            continue;
          }
          const gdata = await gr.json();
          const greply = gdata.choices && gdata.choices[0] && gdata.choices[0].message && gdata.choices[0].message.content;
          if (greply) { console.log('Success via Groq:', gm); return greply; }
        } catch (gerr) {
          console.error('Groq model failed:', gm, gerr.message);
          continue;
        }
      }
      return null;
    };

    // ===== v36: ORDER — PATIENT chat = GROQ pehle (Gemini quota bachti hai),
    // DOCTOR chat = GEMINI pehle (13-point deep analysis quality) =====
    const isPatient = String(category || '').trim().toLowerCase() === 'patient';
    if (isPatient) {
      reply = await tryGroq();
      if (!reply) reply = await tryGemini();
    } else {
      reply = await tryGemini();
      if (!reply) reply = await tryGroq();
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
          await db.insertRow('Chat Log', {
              'Date/Time': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              'Category': category || '',
              'Patient Name': patientName || '',
              'Age': patientAge || '',
              'Mobile': patientMobile || '',
              'OTP Verified': mobileVerified ? 'Yes' : 'No',
              'Clinic Name': clinic || '',
              'Address': (address || '').slice(0, 500),
              'Session ID': sessionId || 'unknown',
              'Patient Message': displayMsg.slice(0, 40000),
              'ASTHL Response': reply.slice(0, 40000),
              'Login ID': accessId || ''
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

// v37: sheet me log bhejna — Google kabhi HTML de de to dobara koshish (3 baar)
async function sheetLog(sheetUrl, payload) {
  const body = JSON.stringify(payload);
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body });
      const t = (await r.text() || '').trim();
      if (t.charAt(0) === '{') return true;
    } catch (e) {}
    await new Promise(function (z) { setTimeout(z, 250); });
  }
  return false;
}
