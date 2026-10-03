// ASTHL Admin API — admin.asthl.in ke liye
// IMPORTANT: password SERVER par check hota hai (frontend me nahi) — taaki koi dekh na sake.
// Password Vercel → Settings → Environment Variables me ADMIN_PASSWORD rakhein.
// (Agar set na ho to niche wala default chalega — baad me badal sakte hain.)
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

    if (action === 'adminConfirmAssign') {
      const r = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'adminConfirmAssign', caseId: body.caseId, consultantId: body.consultantId })
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch (e) { return res.status(502).json({ error: 'Apps Script purana version hai — naya deploy karein.', detail: text.slice(0, 300), urlTail: sheetUrl.slice(-10) }); }
      return res.status(200).json(data);
    }

    if (action === 'adminPayoutDone') {
      const r = await fetch(sheetUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'adminPayoutDone', consultantId: body.consultantId || '' })
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch (e) { return res.status(502).json({ error: 'Apps Script purana version hai — naya deploy karein.', detail: text.slice(0, 300), urlTail: sheetUrl.slice(-10) }); }
      return res.status(200).json(data);
    }

    if (action === 'adminTransferAssign') {
      const r = await fetch(sheetUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'adminTransferAssign', caseId: body.caseId, oldConsultantId: body.oldConsultantId || '', newConsultantId: body.newConsultantId, newConsultantName: body.newConsultantName || '' })
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch (e) { return res.status(502).json({ error: 'Apps Script purana version hai — naya deploy karein.', detail: text.slice(0, 300), urlTail: sheetUrl.slice(-10) }); }
      return res.status(200).json(data);
    }

    if (action === 'adminSetCell' || action === 'adminVerifyDoctor') {
      const r = await fetch(sheetUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(Object.assign({ action: action }, body))
      });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch (e) { return res.status(502).json({ error: 'Apps Script purana version hai — naya deploy karein.', detail: text.slice(0, 300), urlTail: sheetUrl.slice(-10) }); }
      return res.status(200).json(data);
    }

    if (action === 'getAll') {
      const r = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'adminGetAll' })
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({ error: 'शीट का Apps Script पुराना वर्शन है — नया google-sheet-script.js डिप्लॉय करें।', detail: text.slice(0, 300), urlTail: sheetUrl.slice(-10), http: r.status });
      }
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
