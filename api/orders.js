// ASTHL Orders API — ab Supabase (database) par. Front-end ko koi badlav nahi.
const db = require('./_supa.js');

function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function last10(s) { return digits(s).slice(-10); }
function nowISO() { return new Date().toISOString(); }

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const action = body.action;
  const ALLOWED = ['saveOrder', 'listMedicines', 'getPatientBill', 'getHealthAlert', 'saveMedSelection',
    'listConsultants', 'saveAssignPay', 'getMyAssignments', 'respondAssign', 'getAssignUpdates', 'markNotified',
    'saveConsultantNote', 'getConsultantNotes', 'markNoteNotified', 'getMyEarnings', 'saveRating', 'getPatientAppointments'];
  if (!action || ALLOWED.indexOf(action) === -1) return res.status(400).json({ error: 'Invalid action' });

  if (!db.ready()) return res.status(500).json({ error: 'Database settings (SUPABASE_URL / SUPABASE_KEY) Vercel me set nahi hain' });

  try {
    const out = await handle(action, body);
    return res.status(out.code || 200).json(out.json);
  } catch (e) {
    return res.status(500).json({ error: 'सर्वर त्रुटि: ' + e.message });
  }
};

async function handle(action, b) {
  switch (action) {

    case 'saveOrder': {
      // purani history (Orders) me bhi daalo
      await db.insertRow('Orders', {
        'Type': b.type || '', 'Patient ID/Mobile': b.patientRef || '', 'Name': b.name || '',
        'Mobile': b.mobile || '', 'Address': b.address || '', 'Pincode': b.pincode || '',
        'Items/Details': b.items || '', 'Amount': String(b.amount || ''), 'Pay Ref': b.payRef || '', 'Status': 'Pending'
      });
      if (b.type === 'doctor-registration') {
        await db.insertRow('Doctor Registration', {
          'Name': b.name || '', 'Mobile (WhatsApp)': digits(b.mobile), 'Qualification': b.qual || '',
          'City/District': b.city || '', 'Clinic': b.clinic || '', 'UTR/Pay Ref': String(b.payRef || ''),
          'Amount': String(b.amount || '299'), 'Payment Status': 'Pending', 'Login ID Given': '',
          'Experience (Years)': String(b.exp || ''), 'Expertise': b.expertise || '', 'Rate/Case': String(b.fee || ''),
          'About': b.about || '', 'Available': b.avail || 'Yes', 'Max Cases/Week': String(b.maxcases || ''),
          'Plan': (String(b.amount || '299') === '299' ? 'Monthly ₹299' : '2-Year ₹2,999')
        });
      }
      if (b.type === 'medicine' && b.patientRef) {
        const r = await db.getRows('Medicine Order', { limit: 400 });
        const want = last10(b.patientRef);
        for (const row of (r.data || [])) {
          if (last10(row.data['Mobile/ID']) === want || last10(row.data['Doctor ID']) === want) {
            const patch = Object.assign({}, row.data);
            if (b.address) patch['Address'] = b.address + (b.pincode ? ' - ' + b.pincode : '');
            if (b.payRef) patch['UTR Details'] = String(b.payRef);
            if (b.amount) patch['Total Cost'] = String(b.amount);
            await db.updateRow(row.id, patch);
            break;
          }
        }
      }
      return { json: { status: 'ok' } };
    }

    case 'listMedicines': {
      const r = await db.getRows('Medicines', { limit: 500, order: 'asc' });
      const list = (r.data || []).map(function (x) { return x.data; })
        .filter(function (d) { return String(d['Active'] || 'Yes').toLowerCase() !== 'no'; });
      return { json: { status: 'ok', medicines: list } };
    }

    case 'getPatientBill': {
      const r = await db.getRows('Medicine Order', { limit: 400 });
      const q = last10(b.query || b.mobile || b.patientRef || '');
      if (!q) return { json: { status: 'ok', bill: null } };
      for (const row of (r.data || [])) {
        const d = row.data;
        if (last10(d['Mobile/ID']) === q || last10(d['Doctor ID']) === q) {
          return { json: { status: 'ok', bill: d } };
        }
      }
      return { json: { status: 'ok', bill: null } };
    }

    case 'getHealthAlert': {
      const r = await db.getRows('Health Alerts', { limit: 100 });
      const aud = String(b.audience || 'All').toLowerCase();
      const list = (r.data || []).map(function (x) { return x.data; }).filter(function (d) {
        if (String(d['Active'] || 'Yes').toLowerCase() === 'no') return false;
        const a = String(d['Audience'] || 'All').toLowerCase();
        return a === 'all' || a === aud || aud === 'all';
      });
      return { json: { status: 'ok', alerts: list.slice(0, 1) } };
    }

    case 'saveMedSelection': {
      const r = await db.getRows('Medicine Selection', { limit: 200 });
      const meds = String(b.medicines || '');
      const mob = last10(b.mobile || '');
      for (const row of (r.data || [])) {
        if (last10(row.data['Mobile']) === mob && String(row.data['Medicines (AI List)'] || '') === meds) {
          return { json: { status: 'ok', duplicate: true } };
        }
      }
      await db.insertRow('Medicine Selection', {
        'Source': b.source || '', 'Patient Name': b.name || '', 'Mobile': digits(b.mobile || ''),
        'Case ID': b.caseId || '', 'Medicines (AI List)': meds, 'Final Selected': '', 'Delivered': 'No', 'Note': ''
      });
      return { json: { status: 'ok' } };
    }

    case 'listConsultants': {
      const docs = await db.getRows('Doctor Registration', { limit: 500, order: 'asc' });
      const ap = await db.getRows('Assign & Pay', { limit: 500 });
      const self = String(b.selfId || '').trim().toUpperCase();
      const load = {};
      (ap.data || []).forEach(function (row) {
        const d = row.data;
        const st = String(d['Status'] || '');
        if (st !== 'Sent to Consultant' && st !== 'Accepted') return;
        const k = String(d['Consultant ID'] || '').trim().toUpperCase();
        if (k) load[k] = (load[k] || 0) + 1;
      });
      const out = [];
      let selfSkipped = 0, totalWithId = 0;
      (docs.data || []).forEach(function (row) {
        const d = row.data;
        const id = String(d['Login ID Given'] || '').trim();
        if (!id) return;
        const avail = String(d['Available'] || 'Yes').trim().toLowerCase();
        if (avail === 'no' || avail === 'नहीं') return;
        totalWithId++;
        if (self && id.toUpperCase() === self) { selfSkipped++; return; }
        const maxc = parseFloat(String(d['Max Cases/Week'] || '').replace(/[^0-9.]/g, ''));
        if (maxc > 0 && (load[id.toUpperCase()] || 0) >= maxc) return;
        out.push({
          name: String(d['Name'] || ''), id: id, qual: String(d['Qualification'] || ''),
          exp: String(d['Experience (Years)'] || ''), expertise: String(d['Expertise'] || ''),
          fee: String(d['Rate/Case'] || ''), about: String(d['About'] || ''),
          city: String(d['City/District'] || ''), clinic: String(d['Clinic'] || ''),
          maxCases: String(d['Max Cases/Week'] || ''), load: (load[id.toUpperCase()] || 0)
        });
      });
      return { json: { status: 'ok', consultants: out, selfOnly: (out.length === 0 && selfSkipped > 0), selfId: self, totalWithId: totalWithId } };
    }

    case 'saveAssignPay': {
      const isPatient = String(b.source || '') === 'Patient Appointment';
      await db.insertRow('Assign & Pay', {
        'Case ID': b.caseId || '', 'Patient Name': b.patientName || '', 'Assigning Doctor': b.assigningDoctor || '',
        'Consultant ID': b.consultantId || '', 'Consultant Name': b.consultantName || '',
        'Fee': String(b.fee || ''), 'UTR': String(b.utr || ''), 'Payment Status': 'Pending', 'Admin Confirmed': 'No',
        'Status': 'Awaiting Confirmation', 'Accept Days & Time': '', 'Reject Reason/Suggestion': '', 'Comments': '',
        'Notified': '', 'Source': b.source || 'Doctor Referral', 'Payer': b.payer || b.assigningDoctor || '',
        'Asthl Fee %': String(b.asthlFee || (isPatient ? 30 : 13)), 'Consultant Medicine Note': '',
        'Note Notified': '', 'Payout Done': 'No', 'Case Summary': String(b.caseSummary || ''), 'Rating': '', 'Rating Comment': ''
      });
      return { json: { status: 'ok' } };
    }

    case 'getMyAssignments': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const me = String(b.consultantId || '').trim().toUpperCase();
      const out = [];
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Consultant ID'] || '').trim().toUpperCase() !== me) return;
        const st = String(d['Status'] || '').trim();
        if (st !== 'Sent to Consultant' && st !== 'Accepted') return;
        out.push({
          caseId: String(d['Case ID'] || ''), patientName: String(d['Patient Name'] || ''),
          assigningDoctor: String(d['Assigning Doctor'] || ''), fee: String(d['Fee'] || ''),
          status: st, date: row.created_at, when: String(d['Accept Days & Time'] || ''),
          comment: String(d['Comments'] || ''), source: String(d['Source'] || 'Doctor Referral'),
          note: String(d['Consultant Medicine Note'] || ''), summary: String(d['Case Summary'] || '')
        });
      });
      return { json: { status: 'ok', assignments: out } };
    }

    case 'respondAssign': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const me = String(b.consultantId || '').trim().toUpperCase();
      const cid = String(b.caseId || '').trim();
      let target = null;
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === me) target = row;
      });
      if (!target) return { json: { status: 'error', error: 'Yeh case assignment nahi mila' } };
      const patch = Object.assign({}, target.data);
      if (b.decision === 'Accepted') {
        patch['Status'] = 'Accepted';
        patch['Accept Days & Time'] = String(b.days || '') + ' दिन, ' + String(b.time || '');
        patch['Comments'] = String(b.comment || '');
      } else {
        patch['Status'] = 'Rejected';
        patch['Reject Reason/Suggestion'] = String(b.rejectReason || '') + (b.suggestTo ? ' | सुझाव: ' + b.suggestTo : '');
        patch['Comments'] = String(b.comment || '');
      }
      patch['Notified'] = 'No';
      await db.updateRow(target.id, patch);
      return { json: { status: 'ok' } };
    }

    case 'getAssignUpdates': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const me = String(b.assigningDoctor || '').trim().toUpperCase();
      const out = [];
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Assigning Doctor'] || '').trim().toUpperCase() !== me) return;
        const st = String(d['Status'] || '').trim();
        if (st !== 'Accepted' && st !== 'Rejected') return;
        if (String(d['Notified'] || '').trim() === 'Yes') return;
        out.push({
          caseId: String(d['Case ID'] || ''), consultantName: String(d['Consultant Name'] || ''),
          consultantId: String(d['Consultant ID'] || ''), status: st,
          when: String(d['Accept Days & Time'] || ''), rejectReason: String(d['Reject Reason/Suggestion'] || '')
        });
      });
      return { json: { status: 'ok', updates: out } };
    }

    case 'markNotified': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(b.caseId || '').trim(), me = String(b.consultantId || '').trim().toUpperCase();
      for (const row of (r.data || [])) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === me) {
          await db.updateRow(row.id, Object.assign({}, d, { 'Notified': 'Yes' }));
          break;
        }
      }
      return { json: { status: 'ok' } };
    }

    case 'saveConsultantNote': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(b.caseId || '').trim(), me = String(b.consultantId || '').trim().toUpperCase();
      for (const row of (r.data || [])) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === me) {
          await db.updateRow(row.id, Object.assign({}, d, { 'Consultant Medicine Note': String(b.note || ''), 'Note Notified': 'No' }));
          return { json: { status: 'ok' } };
        }
      }
      return { json: { status: 'error', error: 'Case assignment nahi mila' } };
    }

    case 'getConsultantNotes': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const me = String(b.assigningDoctor || '').trim().toUpperCase();
      const out = [];
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Assigning Doctor'] || '').trim().toUpperCase() !== me) return;
        const note = String(d['Consultant Medicine Note'] || '').trim();
        if (!note) return;
        if (!b.all && String(d['Note Notified'] || '').trim() === 'Yes') return;
        out.push({
          caseId: String(d['Case ID'] || ''), patientName: String(d['Patient Name'] || ''),
          consultantName: String(d['Consultant Name'] || ''), consultantId: String(d['Consultant ID'] || ''), note: note
        });
      });
      return { json: { status: 'ok', notes: out } };
    }

    case 'markNoteNotified': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(b.caseId || '').trim(), me = String(b.consultantId || '').trim().toUpperCase();
      for (const row of (r.data || [])) {
        const d = row.data;
        if (String(d['Case ID'] || '').trim() === cid && String(d['Consultant ID'] || '').trim().toUpperCase() === me) {
          await db.updateRow(row.id, Object.assign({}, d, { 'Note Notified': 'Yes' }));
          break;
        }
      }
      return { json: { status: 'ok' } };
    }

    case 'getMyEarnings': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const me = String(b.consultantId || '').trim().toUpperCase();
      let total = 0, count = 0;
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Consultant ID'] || '').trim().toUpperCase() !== me) return;
        const paid = String(d['Payment Status'] || '').toLowerCase().indexOf('confirm') !== -1 || String(d['Admin Confirmed'] || '').toLowerCase().indexOf('yes') !== -1;
        if (!paid) return;
        if (String(d['Payout Done'] || '').trim() === 'Yes') return;
        if (String(d['Status'] || '').toLowerCase().indexOf('reject') !== -1) return;
        const fee = parseFloat(String(d['Fee'] || '0').replace(/[^0-9.]/g, '')) || 0;
        const pct = parseFloat(String(d['Asthl Fee %'] || '13').replace(/[^0-9.]/g, '')) || 0;
        total += fee * (1 - pct / 100);
        count++;
      });
      return { json: { status: 'ok', total: Math.round(total), count: count } };
    }

    case 'saveRating': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const cid = String(b.caseId || '').trim();
      for (const row of (r.data || [])) {
        if (String(row.data['Case ID'] || '').trim() === cid) {
          await db.updateRow(row.id, Object.assign({}, row.data, { 'Rating': String(b.rating || ''), 'Rating Comment': String(b.comment || '') }));
          return { json: { status: 'ok' } };
        }
      }
      return { json: { status: 'error', error: 'Case nahi mila' } };
    }

    case 'getPatientAppointments': {
      const r = await db.getRows('Assign & Pay', { limit: 500 });
      const want = last10(b.payer || '');
      const out = [];
      if (!want) return { json: { status: 'ok', appointments: [] } };
      (r.data || []).forEach(function (row) {
        const d = row.data;
        if (String(d['Source'] || '') !== 'Patient Appointment') return;
        if (last10(d['Payer']) !== want) return;
        out.push({
          caseId: String(d['Case ID'] || ''), doctorName: String(d['Consultant Name'] || ''),
          status: String(d['Status'] || ''), when: String(d['Accept Days & Time'] || ''),
          rejectReason: String(d['Reject Reason/Suggestion'] || ''), rating: String(d['Rating'] || '')
        });
      });
      return { json: { status: 'ok', appointments: out } };
    }
  }
  return { json: { error: 'Unknown action' }, code: 400 };
}
