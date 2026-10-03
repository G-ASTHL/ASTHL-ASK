// ASTHL Orders API — medicine orders, doctor registrations, medicine list, patient bills, assign & pay
// v2: POST pehle, jawab JSON na ho to GET se dobara (Google kabhi POST par HTML de deta hai)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) return res.status(500).json({ error: 'GOOGLE_SHEET_URL not set on server' });

    const body = req.body || {};
    const action = body.action;
    const ALLOWED = ['saveOrder', 'listMedicines', 'getPatientBill', 'getHealthAlert', 'saveMedSelection',
      'listConsultants', 'saveAssignPay', 'getMyAssignments', 'respondAssign', 'getAssignUpdates', 'markNotified',
      'saveConsultantNote', 'getConsultantNotes', 'markNoteNotified', 'getMyEarnings', 'saveRating', 'getPatientAppointments'];
    if (!action || ALLOWED.indexOf(action) === -1) return res.status(400).json({ error: 'Invalid action' });

    const out = await callSheet(sheetUrl, body);
    if (out.ok) return res.status(200).json(out.data);

    return res.status(502).json({
      error: 'शीट का Apps Script जवाब नहीं दे रहा — नया version deploy करें (Version: New version + Who has access: Anyone)।',
      detail: out.detail || '',
      detail2: out.detail2 || '',
      urlTail: sheetUrl.slice(-10),
      finalUrl: out.finalUrl || '',
      http: out.http || 0
    });
  } catch (err) {
    return res.status(500).json({ error: 'सर्वर त्रुटि। थोड़ी देर बाद कोशिश करें।' });
  }
};

async function callSheet(sheetUrl, payload) {
  try {
    const r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const t = (await r.text() || '').trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return { ok: true, data: JSON.parse(t), via: 'POST' }; } catch (e) {}
    }
    const url = sheetUrl + '?action=' + encodeURIComponent(payload.action || '') + '&payload=' + encodeURIComponent(JSON.stringify(payload));
    const r2 = await fetch(url);
    const t2 = (await r2.text() || '').trim();
    if (t2.startsWith('{') || t2.startsWith('[')) {
      try { return { ok: true, data: JSON.parse(t2), via: 'GET' }; } catch (e) {}
    }
    return {
      ok: false,
      detail: t.slice(0, 250),
      detail2: t2.slice(0, 250),
      finalUrl: String(r2.url || r.url || '').slice(0, 100),
      http: r.status
    };
  } catch (e) {
    return { ok: false, detail: 'fetch error: ' + e.message };
  }
}
