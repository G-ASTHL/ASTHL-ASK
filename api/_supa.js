// ASTHL — Supabase helper (sirf server par chalta hai)
// Vercel env: SUPABASE_URL (https://xxxx.supabase.co) aur SUPABASE_KEY (service_role key)
const SUPA_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPA_KEY = process.env.SUPABASE_KEY || '';

function ready() { return !!(SUPA_URL && SUPA_KEY); }

function hdrs(extra) {
  const h = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json'
  };
  if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
  return h;
}

async function req(path, opts) {
  if (!ready()) return { ok: false, error: 'Supabase settings (SUPABASE_URL / SUPABASE_KEY) Vercel me set nahi hain' };
  try {
    const r = await fetch(SUPA_URL + '/rest/v1/' + path, opts || {});
    const t = (await r.text() || '').trim();
    let data = null;
    if (t) { try { data = JSON.parse(t); } catch (e) { data = null; } }
    if (!r.ok) return { ok: false, error: (data && (data.message || data.hint)) || ('Supabase error ' + r.status), status: r.status };
    return { ok: true, data: data };
  } catch (e) {
    return { ok: false, error: 'Supabase fetch error: ' + e.message };
  }
}

// ---- rows padho ----
// filters: { col: 'value' }  (exact match) ; ya { col: 'eq.value' } apne aap
async function getRows(sheet, opts) {
  opts = opts || {};
  let q = 'sheets?sheet=eq.' + encodeURIComponent(sheet) + '&select=id,data,row_no,created_at&order=id.' + (opts.order || 'desc') + '&limit=' + (opts.limit || 400);
  if (opts.filters) {
    Object.keys(opts.filters).forEach(function (k) {
      const v = opts.filters[k];
      q += '&data->>' + encodeURIComponent(k) + '=eq.' + encodeURIComponent(v);
    });
  }
  return req(q, { method: 'GET', headers: hdrs() });
}

// ---- ek row jodo ----
async function insertRow(sheet, data) {
  return req('sheets', {
    method: 'POST',
    headers: hdrs({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ sheet: sheet, data: data || {} })
  });
}

// ---- bahut rows ek saath ----
async function insertRows(sheet, arr) {
  const body = (arr || []).map(function (d) { return { sheet: sheet, data: d || {} }; });
  if (!body.length) return { ok: true, data: [] };
  return req('sheets', {
    method: 'POST',
    headers: hdrs({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body)
  });
}

// ---- id se update ----
async function updateRow(id, patch) {
  return req('sheets?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: hdrs({ 'Prefer': 'return=representation' }),
    body: JSON.stringify({ data: patch })
  });
}

// ---- purani row ka data padho (merge ke liye) ----
async function getRowById(id) {
  const r = await req('sheets?id=eq.' + encodeURIComponent(id) + '&select=id,data', { method: 'GET', headers: hdrs() });
  if (r.ok && r.data && r.data.length) return r.data[0];
  return null;
}

// ---- id se delete ----
async function deleteRow(id) {
  return req('sheets?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: hdrs() });
}

// ---- poore sheet ka data hatao (re-import ke liye) ----
async function clearSheet(sheet) {
  return req('sheets?sheet=eq.' + encodeURIComponent(sheet), { method: 'DELETE', headers: hdrs() });
}

module.exports = { ready, getRows, insertRow, insertRows, updateRow, getRowById, deleteRow, clearSheet, SUPA_URL };
