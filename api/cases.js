// ASTHL Case Files API — ab Supabase (database) par
const db = require('./_supa.js');
function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    const action = b.action;
    const accessId = String(b.accessId || '').trim();
    if (!accessId) return res.status(400).json({ error: 'Login ID required' });
    if (!db.ready()) return res.status(500).json({ error: 'Database settings (SUPABASE_URL / SUPABASE_KEY) Vercel me set nahi hain' });

    const all = await db.getRows('Case Files', { limit: 400, order: 'asc' });
    const mine = (all.data || []).filter(function (r) { return String(r.data['Login ID'] || '').trim().toUpperCase() === accessId.toUpperCase(); });

    if (action === 'list') {
      const cases = mine.map(function (r) {
        const d = r.data;
        return {
          caseId: String(d['Case ID'] || ''), name: String(d['Name'] || ''), issue: String(d['Issue'] || ''),
          caseStatus: String(d['Status'] || 'Open'), isPublic: (String(d['Public'] || 'No') === 'Yes')
        };
      }).reverse();
      return res.status(200).json({ status: 'ok', cases: cases });
    }

    if (action === 'save') {
      if (!b.name || !b.issue || !b.conversation) return res.status(400).json({ error: 'name, issue, conversation required' });
      // purana case (caseId diya hai) → wahi row update karo
      if (b.caseId) {
        for (const r of mine) {
          if (String(r.data['Case ID'] || '').trim() === String(b.caseId).trim()) {
            const patch = Object.assign({}, r.data, { 'Name': b.name || '', 'Issue': b.issue || '', 'Conversation': b.conversation || '[]' });
            await db.updateRow(r.id, patch);
            const um = digits(b.mobile);
            if (um) await updateMedOrderMobile(accessId, b.name, um);
            return res.status(200).json({ status: 'ok', caseId: String(b.caseId), updated: true });
          }
        }
      }
      // naya case: caseId = login id ke pehle 2 akshar + date + serial
      const d = new Date();
      const p2 = function (n) { return (n < 10 ? '0' : '') + n; };
      const today = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
      const prefix = accessId.substring(0, 2);
      let serial = 1;
      (all.data || []).forEach(function (r) {
        if (String(r.data['Case ID'] || '').indexOf(prefix + today) === 0) serial++;
      });
      const caseId = prefix + today + (serial < 10 ? '0' + serial : String(serial));
      await db.insertRow('Case Files', {
        'Case ID': caseId, 'Login ID': accessId, 'Name': b.name || '', 'Issue': b.issue || '',
        'Public': 'No', 'Date/Time': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        'Conversation': b.conversation || '[]', 'Status': 'Open'
      });
      const pmob = digits(b.mobile);
      await db.insertRow('Medicine Order', {
        'Doctor ID': accessId, 'Mobile/ID': pmob || caseId, 'Name': b.name || '', 'Address': '',
        'Dieses': b.issue || '', 'Medicine Cost': '', 'Delivery Cost': '', 'Total Cost': '',
        'Comment': '', 'UTR Details': '', 'Payment Status': 'Pending', 'Delivered': 'No'
      });
      return res.status(200).json({ status: 'ok', caseId: caseId });
    }

    if (action === 'load') {
      for (const r of mine) {
        if (String(r.data['Case ID'] || '').trim() === String(b.caseId).trim()) {
          return res.status(200).json({ status: 'ok', case: r.data, conversation: r.data['Conversation'] || '[]' });
        }
      }
      return res.status(200).json({ status: 'error', error: 'Case nahi mila' });
    }

    if (action === 'close' || action === 'reopen' || action === 'open' || action === 'public' || action === 'private') {
      for (const r of mine) {
        if (String(r.data['Case ID'] || '').trim() === String(b.caseId).trim()) {
          const patch = Object.assign({}, r.data);
          if (action === 'close') patch['Status'] = 'Closed';
          if (action === 'reopen' || action === 'open') patch['Status'] = 'Open';
          if (action === 'public') patch['Public'] = 'Yes';
          if (action === 'private') patch['Public'] = 'No';
          await db.updateRow(r.id, patch);
          return res.status(200).json({ status: 'ok' });
        }
      }
      return res.status(200).json({ status: 'error', error: 'Case nahi mila' });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

async function updateMedOrderMobile(accessId, name, mobile) {
  try {
    const r = await db.getRows('Medicine Order', { limit: 400 });
    const nm = String(name || '').trim().toLowerCase();
    for (const row of (r.data || [])) {
      const d = row.data;
      if (String(d['Doctor ID'] || '').trim().toUpperCase() === String(accessId).trim().toUpperCase() &&
          String(d['Name'] || '').trim().toLowerCase() === nm) {
        await db.updateRow(row.id, Object.assign({}, d, { 'Mobile/ID': mobile }));
        break;
      }
    }
  } catch (e) {}
}
