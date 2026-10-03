// ASTHL Admin API — ab Supabase (database) par
const db = require('./_supa.js');

const SHEETS = ['Chat Log', 'Medicine Order', 'Doctor Registration', 'Medicine Selection', 'Health Alerts', 'Case Files', 'Assign & Pay', 'Follow Ups', 'Admin Log', 'Medicines', 'Patient Bills', 'Orders'];
function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function last10(s) { return digits(s).slice(-10); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const expected = process.env.ADMIN_PASSWORD || 'Chas@827013';
    if (String(body.password || '') !== expected) return res.status(401).json({ error: 'गलत पासवर्ड — दोबारा कोशिश करें।' });
    if (!db.ready()) return res.status(500).json({ error: 'Database settings (SUPABASE_URL / SUPABASE_KEY) Vercel me set nahi hain' });

    const action = body.action || 'getAll';

    if (action === 'ping') return res.status(200).json({ status: 'ok' });

    if (action === 'getAll') {
      const tabs = {};
      for (const name of SHEETS) {
        const r = await db.getRows(name, { limit: 400, order: 'desc' });
        const rows = (r.data || []).map(function (x) { return x.data || {}; });
        // headers nikalo (sab rows ke keys ka union, Date/Time pehle)
        const hs = [];
        rows.forEach(function (d) {
          Object.keys(d).forEach(function (k) { if (hs.indexOf(k) === -1) hs.push(k); });
        });
        if (hs.indexOf('Date/Time') > 0) { hs.splice(hs.indexOf('Date/Time'), 1); hs.unshift('Date/Time'); }
        const outRows = (r.data || []).map(function (x) {
          const d = x.data || {};
          const arr = hs.map(function (h) { return d[h] === undefined ? '' : d[h]; });
          arr.push(x.id);   // aakhri element = database row id (admin isse update karta hai)
          return arr;
        });
        tabs[name] = { headers: hs, rows: outRows };
      }
      return res.status(200).json({ status: 'ok', tabs: tabs, serverTime: new Date().toISOString() });
    }

    if (action === 'adminSetCell') {
      const row = await db.getRowById(body.row);
      if (!row) return res.status(200).json({ status: 'error', error: 'Row nahi mila' });
      const oldV = row.data[body.col];
      const patch = Object.assign({}, row.data);
      patch[body.col] = body.value === undefined || body.value === null ? '' : body.value;
      await db.updateRow(body.row, patch);
      await logAdmin('setCell', body.sheet, body.row, body.col, oldV, body.value);
      return res.status(200).json({ status: 'ok' });
    }

    if (action === 'adminVerifyDoctor') {
      const r = await db.getRows('Doctor Registration', { limit: 500, order: 'asc' });
      const want = last10(body.mobile);
      let target = null;
      (r.data || []).forEach(function (row) { if (last10(row.data['Mobile (WhatsApp)']) === want) target = row; });
      if (!target) return res.status(200).json({ status: 'error', error: 'Yeh doctor nahi mila' });
      const d = target.data;
      let loginId = String(d['Login ID Given'] || '').trim();
      if (!loginId) {
        let maxN = 0;
        (r.data || []).forEach(function (row) {
          const m = String(row.data['Login ID Given'] || '').trim().match(/^DOCT(\d+)$/);
          if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
        });
        loginId = 'DOCT' + ('0000' + (maxN + 1)).slice(-4);
      }
      const plan = String(d['Plan'] || '');
      const months = (plan.indexOf('2-Year') !== -1 || plan.indexOf('2 वर्ष') !== -1) ? 24 : 1;
      const exp = new Date(); exp.setMonth(exp.getMonth() + months);
      const patch = Object.assign({}, d, {
        'Login ID Given': loginId, 'Payment Status': 'Verified',
        'Plan Start': new Date().toISOString(), 'Plan Expiry': exp.toISOString()
      });
      await db.updateRow(target.id, patch);
      await logAdmin('verifyDoctor', 'Doctor Registration', target.id, 'Login ID Given', '', loginId + ' (Verified, ' + months + ' mahine)');
      return res.status(200).json({ status: 'ok', loginId: loginId, name: d['Name'] || '', row: target.id, plan: plan, expiry: exp.toISOString() });
    }

    if (action === 'adminConfirmAssign') {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(body.caseId || '').trim(), me = String(body.consultantId || '').trim().toUpperCase();
      for (const row of (r.data || [])) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === me) {
          await db.updateRow(row.id, Object.assign({}, d, {
            'Payment Status': 'Confirmed', 'Admin Confirmed': 'Yes', 'Status': 'Sent to Consultant'
          }));
          await logAdmin('confirmAssignPayment', 'Assign & Pay', row.id, 'Payment Status', 'Pending', 'Confirmed');
          return res.status(200).json({ status: 'ok' });
        }
      }
      return res.status(200).json({ status: 'error', error: 'Yeh case assignment nahi mila' });
    }

    if (action === 'adminTransferAssign') {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(body.caseId || '').trim(), oldId = String(body.oldConsultantId || '').trim().toUpperCase();
      for (const row of (r.data || [])) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === oldId) {
          await db.updateRow(row.id, Object.assign({}, d, {
            'Consultant ID': body.newConsultantId || '', 'Consultant Name': body.newConsultantName || '',
            'Status': 'Sent to Consultant', 'Notified': 'No'
          }));
          await logAdmin('transferAssign', 'Assign & Pay', row.id, 'Consultant ID', oldId, body.newConsultantId);
          return res.status(200).json({ status: 'ok' });
        }
      }
      return res.status(200).json({ status: 'error', error: 'Yeh case assignment nahi mila' });
    }

    if (action === 'adminAddRow') {
      const data = body.data || {};
      if (data['Date/Time'] === undefined) data['Date/Time'] = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const r = await db.insertRow(body.sheet, data);
      await logAdmin('addRow', body.sheet, '', '', '', JSON.stringify(data).slice(0, 250));
      return res.status(200).json({ status: r.ok ? 'ok' : 'error', error: r.error || '' });
    }

    if (action === 'adminDeleteRow') {
      const row = await db.getRowById(body.id);
      await db.deleteRow(body.id);
      await logAdmin('deleteRow', (row && row.data && row.data['Case ID']) ? 'row ' + body.id : 'row ' + body.id, body.id, '', JSON.stringify((row && row.data) || {}).slice(0, 250), '');
      return res.status(200).json({ status: 'ok' });
    }

    if (action === 'adminPayoutDone') {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const only = String(body.consultantId || '').trim().toUpperCase();
      let n = 0;
      for (const row of (r.data || [])) {
        const d = row.data;
        const cid = String(d['Consultant ID'] || '').trim().toUpperCase();
        if (only && cid !== only) continue;
        const paid = String(d['Payment Status'] || '').toLowerCase().indexOf('confirm') !== -1 || String(d['Admin Confirmed'] || '').toLowerCase().indexOf('yes') !== -1;
        if (!paid) continue;
        if (String(d['Payout Done'] || '').trim() === 'Yes') continue;
        await db.updateRow(row.id, Object.assign({}, d, { 'Payout Done': 'Yes' }));
        n++;
      }
      await logAdmin('payoutDone', 'Assign & Pay', '', 'Payout Done', '', (only || 'ALL') + ' → ' + n + ' rows');
      return res.status(200).json({ status: 'ok', marked: n });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

async function logAdmin(action, sheet, rowRef, col, oldV, newV) {
  try {
    await db.insertRow('Admin Log', {
      'Action': String(action || ''), 'Sheet': String(sheet || ''), 'Row': String(rowRef || ''),
      'Column': String(col || ''),
      'Old Value': String(oldV === undefined || oldV === null ? '' : oldV).slice(0, 300),
      'New Value': String(newV === undefined || newV === null ? '' : newV).slice(0, 300)
    });
  } catch (e) {}
}
