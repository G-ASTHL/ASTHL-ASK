/**
 * ASTHL Chat Logger + Case Files v11 (+ Orders: medicine list, patient bills, orders)
 * - Case Close/Reopen: Status column (Open/Closed), sirf owner close kar sakta hai
 * - Case Public/Private toggle: Public column Yes/No, sirf owner badal sakta hai
 * - Case ID format: <loginID ke pehle 2 chars><yyyyMMdd><serial 01,02..> (e.g. ab2026092701)
 * - Chat logging (Chat Log tab)
 * - Case Files: saveCase / listCases / loadCase (Case Files tab)
 * - Privacy: case sirf usi Login ID se accessible, jab tak Public = Yes na ho
 */

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // ===== CASE FILES ACTIONS =====
  if (data.action === 'saveCase') return handleSaveCase(data);
  if (data.action === 'listCases') return handleListCases(data);
  if (data.action === 'loadCase') return handleLoadCase(data);
  if (data.action === 'closeCase') return handleSetCaseStatus(data, 'Closed');
  if (data.action === 'reopenCase') return handleSetCaseStatus(data, 'Open');
  if (data.action === 'publicCase') return handleSetCasePublic(data, 'Yes');
  if (data.action === 'privateCase') return handleSetCasePublic(data, 'No');

  // ===== ORDERS ACTIONS (v11) =====
  if (data.action === 'saveOrder') return handleSaveOrder(data);
  if (data.action === 'listMedicines') return handleListMedicines();
  if (data.action === 'getPatientBill') return handleGetPatientBill(data);

  // ===== CHAT LOGGING (pehle jaisa) =====
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Chat Log');
  if (!sheet) { sheet = ss.insertSheet('Chat Log'); }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Date/Time', 'Category', 'Patient Name', 'Age', 'Mobile',
      'OTP Verified', 'Clinic Name', 'Address', 'Session ID',
      'Patient Message', 'ASTHL Response', 'Login ID'
    ]);
    var range = sheet.getRange(1, 1, 1, 12);
    range.setBackground('#0d9488');
    range.setFontColor('#ffffff');
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 90);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 55);
    sheet.setColumnWidth(5, 115);
    sheet.setColumnWidth(6, 85);
    sheet.setColumnWidth(7, 140);
    sheet.setColumnWidth(8, 220);
    sheet.setColumnWidth(9, 110);
    sheet.setColumnWidth(10, 400);
    sheet.setColumnWidth(11, 400);
    sheet.setColumnWidth(12, 110);
    sheet.getRange('J:K').setWrap(true);
    sheet.getRange('J:K').setVerticalAlignment('top');
  }

  var verified = (data.mobileVerified === 'Yes' || data.mobileVerified === true) ? 'Yes' : 'No';

  sheet.appendRow([
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    data.category || '',
    data.patientName || '',
    data.patientAge || '',
    "'" + (data.patientMobile || ''),
    verified,
    data.clinic || '',
    data.address || '',
    data.sessionId || 'unknown',
    data.userMessage || '',
    data.botReply || '',
    data.accessId || ''
  ]);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 5).setNumberFormat('@');

  if (verified === 'Yes') {
    sheet.getRange(lastRow, 6).setFontColor('#166534').setFontWeight('bold');
    sheet.getRange(lastRow, 6).setBackground('#dcfce7');
  } else {
    sheet.getRange(lastRow, 6).setFontColor('#b91c1c').setBackground('#fef2f2');
  }

  if (data.category === 'doctor') {
    sheet.getRange(lastRow, 2).setFontColor('#1e40af').setBackground('#dbeafe').setFontWeight('bold');
  } else {
    sheet.getRange(lastRow, 2).setFontColor('#134e4a');
  }

  if (data.accessId) {
    sheet.getRange(lastRow, 12).setFontColor('#166534').setFontWeight('bold');
  }

  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, 12).setBackground('#f0fdfa');
    if (verified === 'Yes') sheet.getRange(lastRow, 6).setBackground('#dcfce7');
    else sheet.getRange(lastRow, 6).setBackground('#fef2f2');
    if (data.category === 'doctor') sheet.getRange(lastRow, 2).setBackground('#dbeafe');
  }

  return jsonOut({ status: 'ok' });
}

// ===== CASE FILES =====

function getCaseSheet(ss) {
  var sheet = ss.getSheetByName('Case Files');
  if (!sheet) sheet = ss.insertSheet('Case Files');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Case ID', 'Login ID', 'Patient Name', 'Issue', 'Public', 'Date/Time', 'Conversation', 'Status']);
    var h = sheet.getRange(1, 1, 1, 7);
    h.setBackground('#1e40af');
    h.setFontColor('#ffffff');
    h.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 110);
    sheet.setColumnWidth(3, 130);
    sheet.setColumnWidth(4, 220);
    sheet.setColumnWidth(5, 80);
    sheet.setColumnWidth(6, 150);
    sheet.setColumnWidth(7, 450);
  }
  return sheet;
}

function handleSaveCase(data) {
  var sheet = getCaseSheet(SpreadsheetApp.getActiveSpreadsheet());
  ensureStatusCol(sheet);
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd');
  // Login ID ko clean karke use karo (extra space / capital-small issue fix)
  var lid = String(data.accessId || '').trim();
  // Login ID ke pehle 2 characters = prefix (e.g. ab1234456 -> 'ab')
  var prefix = lid.substring(0, 2);
  var serial = 1;
  var last = sheet.getLastRow();
  if (last > 1) {
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).indexOf(prefix + today) === 0) serial++;
    }
  }
  // Case ID = prefix + date + serial: ab2026092701, ab2026092702 ...
  var caseId = prefix + today + (serial < 10 ? '0' + serial : String(serial));
  sheet.appendRow([
    caseId,
    lid,
    data.name || '',
    data.issue || '',
    'No',
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    data.conversation || '[]',
    'Open'
  ]);
  return jsonOut({ status: 'ok', caseId: caseId });
}

function handleListCases(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Case Files');
  var out = [];
  if (sheet) ensureStatusCol(sheet);
  if (sheet && sheet.getLastRow() > 1) {
    var last = sheet.getLastRow();
    var rows = sheet.getRange(2, 1, last - 1, 8).getValues();
    for (var i = 0; i < rows.length; i++) {
      var isPub = String(rows[i][4]).toLowerCase() === 'yes';
      var mine = String(rows[i][1]).trim().toLowerCase() === String(data.accessId || '').trim().toLowerCase();
      if (mine || isPub) {
        out.push({
          caseId: String(rows[i][0]),
          name: String(rows[i][2]),
          issue: String(rows[i][3]),
          date: String(rows[i][5]),
          isPublic: isPub,
          caseStatus: String(rows[i][7]).trim() === 'Closed' ? 'Closed' : 'Open'
        });
      }
    }
  }
  return jsonOut({ status: 'ok', cases: out });
}

function handleLoadCase(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Case Files');
  if (!sheet || sheet.getLastRow() < 2) return jsonOut({ status: 'error', error: 'no cases' });
  var last = sheet.getLastRow();
  ensureStatusCol(sheet);
  var rows = sheet.getRange(2, 1, last - 1, 8).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.caseId)) {
      var isPub = String(rows[i][4]).toLowerCase() === 'yes';
      var mine = String(rows[i][1]).trim().toLowerCase() === String(data.accessId || '').trim().toLowerCase();
      if (!mine && !isPub) return jsonOut({ status: 'error', error: 'not authorized' });
      return jsonOut({
        status: 'ok',
        caseId: String(rows[i][0]),
        name: String(rows[i][2]),
        issue: String(rows[i][3]),
        conversation: String(rows[i][6]),
        caseStatus: String(rows[i][7]).trim() === 'Closed' ? 'Closed' : 'Open'
      });
    }
  }
  return jsonOut({ status: 'error', error: 'case not found' });
}


// ===== CASE STATUS (Close / Reopen) =====

function ensureStatusCol(sheet) {
  if (sheet.getLastColumn() < 8) {
    sheet.insertColumnAfter(7);
  }
  if (String(sheet.getRange(1, 8).getValue()).trim() === '') {
    var h = sheet.getRange(1, 8);
    h.setValue('Status');
    h.setFontWeight('bold');
    h.setBackground('#1e40af');
    h.setFontColor('#ffffff');
    sheet.setColumnWidth(8, 90);
  }
}

function handleSetCaseStatus(data, st) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Case Files');
  if (!sheet || sheet.getLastRow() < 2) return jsonOut({ status: 'error', error: 'no cases' });
  ensureStatusCol(sheet);
  var last = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.caseId)) {
      var mine = String(rows[i][1]).trim().toLowerCase() === String(data.accessId || '').trim().toLowerCase();
      if (!mine) return jsonOut({ status: 'error', error: 'not authorized' });
      sheet.getRange(i + 2, 8).setValue(st);
      return jsonOut({ status: 'ok', caseId: String(rows[i][0]), caseStatus: st });
    }
  }
  return jsonOut({ status: 'error', error: 'case not found' });
}


// ===== CASE PUBLIC/PRIVATE TOGGLE =====

function handleSetCasePublic(data, val) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Case Files');
  if (!sheet || sheet.getLastRow() < 2) return jsonOut({ status: 'error', error: 'no cases' });
  var last = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.caseId)) {
      var mine = String(rows[i][1]).trim().toLowerCase() === String(data.accessId || '').trim().toLowerCase();
      if (!mine) return jsonOut({ status: 'error', error: 'not authorized' });
      sheet.getRange(i + 2, 5).setValue(val);
      return jsonOut({ status: 'ok', caseId: String(rows[i][0]), isPublic: val === 'Yes' });
    }
  }
  return jsonOut({ status: 'error', error: 'case not found' });
}

// ====================================================================
// v11: ORDERS — medicine list, patient bills, orders (Medicine/Orders tabs)
// ====================================================================

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    var head = sh.getRange(1, 1, 1, headers.length);
    head.setBackground('#0d9488').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function handleSaveOrder(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, 'Orders', ['Date/Time', 'Type', 'Patient ID/Mobile', 'Name', 'Mobile', 'Address', 'Pincode', 'Items/Details', 'Amount', 'Pay Ref', 'Status']);
  sh.appendRow([
    new Date(), data.type || '', data.patientRef || '', data.name || '', data.mobile || '',
    data.address || '', data.pincode || '', data.items || '', data.amount || '', data.payRef || '', 'Pending'
  ]);
  return jsonOut({ status: 'ok' });
}

function handleListMedicines() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Medicines');
  if (!sh || sh.getLastRow() < 2) return jsonOut({ status: 'ok', medicines: [] });
  var vals = sh.getDataRange().getValues();
  var meds = [];
  for (var i = 1; i < vals.length; i++) {
    var name = String(vals[i][0] || '').trim();
    if (!name) continue;
    var avail = String(vals[i][4] === undefined ? 'Yes' : vals[i][4]).trim().toLowerCase();
    if (avail && avail.indexOf('no') === 0) continue; // Available = No wali skip
    meds.push({
      name: name,
      potency: String(vals[i][1] || '').trim(),
      price: String(vals[i][2] || '').trim(),
      company: String(vals[i][3] || '').trim()
    });
  }
  return jsonOut({ status: 'ok', medicines: meds });
}

function handleGetPatientBill(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Patient Bills');
  var q = String(data.query || '').trim().toLowerCase();
  if (!sh || !q) return jsonOut({ status: 'error', message: 'Bil nahi mila — WhatsApp karein: +91-7903873282' });
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var ref = String(vals[i][0] || '').trim().toLowerCase();
    if (ref && (ref === q || ref.indexOf(q) !== -1 || q.indexOf(ref) !== -1)) {
      var amt = String(vals[i][1] || '').trim();
      if (amt) return jsonOut({ status: 'ok', amount: amt, note: String(vals[i][2] || '').trim() });
    }
  }
  return jsonOut({ status: 'error', message: 'Is ID/number par bil set nahi hai. WhatsApp karein: +91-7903873282' });
}
