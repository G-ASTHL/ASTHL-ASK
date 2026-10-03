// ASTHL — purana Google Sheet ka data database (Supabase) me laane ke liye
const db = require('./_supa.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const expected = process.env.ADMIN_PASSWORD || 'Chas@827013';
    if (String(body.password || '') !== expected) return res.status(401).json({ error: 'गलत पासवर्ड' });
    if (!db.ready()) return res.status(500).json({ error: 'Database settings (SUPABASE_URL / SUPABASE_KEY) Vercel me set nahi hain' });

    const tabs = body.tabs || {};
    const clear = !!body.clear;
    const summary = {};
    const names = Object.keys(tabs);

    for (const name of names) {
      const t = tabs[name] || {};
      const hs = t.headers || [];
      const rows = t.rows || [];
      if (clear) { try { await db.clearSheet(name); } catch (e) {} }
      const objs = [];
      rows.forEach(function (r) {
        const o = {};
        hs.forEach(function (h, i) {
          const v = r[i];
          o[h] = (v === undefined || v === null) ? '' : v;
        });
        // khali row skip
        const any = Object.keys(o).some(function (k) { return String(o[k]).trim() !== ''; });
        if (any) objs.push(o);
      });
      let n = 0;
      for (let i = 0; i < objs.length; i += 40) {
        const chunk = objs.slice(i, i + 40);
        const r = await db.insertRows(name, chunk);
        if (r.ok) n += chunk.length;
      }
      summary[name] = n;
    }

    return res.status(200).json({ status: 'ok', imported: summary, cleared: clear });
  } catch (err) {
    return res.status(500).json({ error: 'Migration error: ' + err.message });
  }
};
