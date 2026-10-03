// ASTHL — Setup Checker: batata hai ki database ki setting poori hui ya nahi
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

    const checks = [];

    // 1) settings Vercel me hain?
    const urlSet = !!process.env.SUPABASE_URL;
    const keySet = !!process.env.SUPABASE_KEY;
    checks.push({
      name: 'Vercel me SUPABASE_URL set hai',
      ok: urlSet,
      hint: urlSet ? ('…' + String(process.env.SUPABASE_URL).slice(-18)) : 'Vercel → Settings → Environment Variables → SUPABASE_URL (Project URL) डालें, फिर Redeploy'
    });
    checks.push({
      name: 'Vercel me SUPABASE_KEY set hai',
      ok: keySet,
      hint: keySet ? 'set hai (service_role key)' : 'Vercel → Settings → Environment Variables → SUPABASE_KEY (service_role key) डालें, फिर Redeploy'
    });

    // 2) table bana hai?
    let tableOk = false, rowsTotal = 0, perSheet = {};
    if (urlSet && keySet) {
      const r = await db.getRows('Doctor Registration', { limit: 1 });
      tableOk = r.ok;
      checks.push({
        name: 'Database me "sheets" table bana hai',
        ok: tableOk,
        hint: tableOk ? 'table मौजूद है' : ('नहीं बना — Supabase → SQL Editor me supabase-schema.sql चलाएँ। ' + (r.error || ''))
      });
      if (tableOk) {
        const all = await db.getRows('Doctor Registration', { limit: 1 });
        const counts = {};
        for (const s of ['Chat Log', 'Doctor Registration', 'Medicine Order', 'Medicine Selection', 'Health Alerts', 'Case Files', 'Assign & Pay', 'Admin Log']) {
          const q = await db.getRows(s, { limit: 1000 });
          counts[s] = (q.data || []).length;
          rowsTotal += counts[s];
        }
        perSheet = counts;
        checks.push({
          name: 'Purana data aa gaya (migration)',
          ok: rowsTotal > 0,
          hint: rowsTotal > 0 ? (rowsTotal + ' rows मिल गए') : 'data खाली है — ai.asthl.in/migrate.html खोलकर "शीट से डेटा पढ़ें" → "डेटाबेस में भेजें" दबाएँ'
        });
      }
    }

    return res.status(200).json({ status: 'ok', checks: checks, counts: perSheet, ready: checks.every(function (c) { return c.ok; }) });
  } catch (e) {
    return res.status(500).json({ error: 'check error: ' + e.message });
  }
};
