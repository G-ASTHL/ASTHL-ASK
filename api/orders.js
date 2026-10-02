// ASTHL Orders API — medicine orders, doctor registrations, medicine list, patient bills
// (Google Sheet ke through — Apps Script GOOGLE_SHEET_URL se)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) {
      return res.status(500).json({ error: 'GOOGLE_SHEET_URL not set on server' });
    }

    const { action } = req.body || {};
    if (!action || !['saveOrder', 'listMedicines', 'getPatientBill', 'getHealthAlert', 'saveMedSelection', 'listConsultants', 'saveAssignPay'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    console.log('Orders action:', action);

    const sheetResponse = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(req.body)
    });

    if (!sheetResponse.ok) {
      console.error('Apps Script error:', sheetResponse.status);
      return res.status(502).json({ error: 'शीट से जवाब नहीं आया। थोड़ी देर बाद कोशिश करें।' });
    }

    const text = await sheetResponse.text();
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch (parseErr) {
      console.error('Apps Script ne non-JSON bheja:', text.slice(0, 200));
      return res.status(502).json({ error: 'शीट का Apps Script पुराना वर्शन है — नया google-sheet-script.js डिप्लॉय करें।' });
    }
  } catch (err) {
    console.error('Orders API error:', err.message);
    return res.status(500).json({ error: 'सर्वर त्रुटि। थोड़ी देर बाद कोशिश करें।' });
  }
};
