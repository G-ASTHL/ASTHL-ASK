// ASTHL Case Files API — save/load/list cases (Google Sheet ke through)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Content-Type', 'application/json');

  try {
    const { action, accessId, caseId, name, issue, conversation } = req.body || {};

    if (!accessId) {
      return res.status(400).json({ error: 'Login ID required' });
    }

    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) {
      return res.status(500).json({ error: 'GOOGLE_SHEET_URL not set on server' });
    }

    let payload = {};
    if (action === 'save') {
      if (!name || !issue || !conversation) {
        return res.status(400).json({ error: 'name, issue, conversation required' });
      }
      payload = { action: 'saveCase', accessId, name, issue, conversation };
    } else if (action === 'list') {
      payload = { action: 'listCases', accessId };
    } else if (action === 'load') {
      if (!caseId) return res.status(400).json({ error: 'caseId required' });
      payload = { action: 'loadCase', accessId, caseId };
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({ status: 'error', error: 'Sheet response invalid' }));
    console.log('Case action:', action, '->', data.status || 'unknown');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Cases server error:', err.message);
    return res.status(500).json({ error: 'Server error. Thodi der baad try karein.' });
  }
};
