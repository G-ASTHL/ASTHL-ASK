// ASTHL Admin API — admin.asthl.in / ai.asthl.in/admin ke liye
// v3: Google kabhi-kabhi Apps Script par "bot check" HTML page bhejta hai —
//     isliye har request ko 4 tareeke se koshish karte hain jab tak JSON na mile.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const expected = process.env.ADMIN_PASSWORD || 'Chas@827013';
    if (String(body.password || '') !== expected) {
      return res.status(401).json({ error: 'गलत पासवर्ड — दोबारा कोशिश करें।' });
    }

    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) return res.status(500).json({ error: 'GOOGLE_SHEET_URL set nahi hai (Vercel env)' });

    const action = body.action || 'getAll';
    if (action === 'ping') return res.status(200).json({ status: 'ok' });

    const sheetAction = (action === 'getAll') ? 'adminGetAll' : action;
    const payload = Object.assign({}, body, { action: sheetAction });

    const out = await callSheet(sheetUrl, payload);
    if (out.ok) return res.status(200).json(out.data);

    return res.status(502).json({
      error: 'शीट का Apps Script जवाब नहीं दे रहा — नया version deploy करें (Version: New version + Who has access: Anyone)।',
      detail: out.detail || '',
      detail2: out.detail2 || '',
      urlTail: sheetUrl.slice(-10),
      finalUrl: out.finalUrl || '',
      http: out.http || 0,
      tries: out.tries || []
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

async function callSheet(sheetUrl, payload) {
  const getUrl = sheetUrl + '?action=' + encodeURIComponent(payload.action || '') + '&payload=' + encodeURIComponent(JSON.stringify(payload));
  const bodyStr = JSON.stringify(payload);
  const tries = [];
  let last = {};

  const attempts = [
    { name: 'GET', url: getUrl, opts: {} },
    { name: 'GET-UA', url: getUrl, opts: { headers: { 'User-Agent': UA, 'Accept': '*/*' } } },
    { name: 'POST', url: sheetUrl, opts: { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: bodyStr } },
    { name: 'POST-UA', url: sheetUrl, opts: { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': UA, 'Accept': '*/*' }, body: bodyStr } },
    { name: 'GET2', url: getUrl, opts: {} }
  ];

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    try {
      const r = await fetch(a.url, a.opts);
      const t = (await r.text() || '').trim();
      tries.push(a.name + ':' + r.status + (t.charAt(0) === '{' ? '=json' : '=html'));
      if (t.charAt(0) === '{' || t.charAt(0) === '[') {
        try { return { ok: true, data: JSON.parse(t), via: a.name, tries: tries }; } catch (e) {}
      }
      last = { detail: t.slice(0, 250), http: r.status, finalUrl: String(r.url || '').slice(0, 100) };
    } catch (e) {
      tries.push(a.name + ':err');
      last = { detail: 'fetch error: ' + e.message };
    }
    if (i < attempts.length - 1) await new Promise(function (z) { setTimeout(z, 250); });
  }
  return { ok: false, detail: last.detail, detail2: '', finalUrl: last.finalUrl, http: last.http, tries: tries };
}
