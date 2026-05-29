const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('excel/Book2.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { raw: false });

const clean = (k) => k.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();

const months = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();

  // DD-Mon-YY or DD-Mon-YYYY
  let m = s.match(/^(\d{1,2})-(\w{3})-(\d{2,4})$/i);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = months[m[2].toLowerCase()];
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    if (mo) return `${y}-${mo}-${d}`;
  }

  // DD-Mon (no year → assume 2025)
  m = s.match(/^(\d{1,2})-(\w{3})$/i);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = months[m[2].toLowerCase()];
    if (mo) return `2025-${mo}-${d}`;
  }

  return null;
}

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const seqMap = {};
const lines = [];

data.forEach((r) => {
  const wo = clean(r['Work \r\nOrder #'] || '');
  const at = r['Assigned to'] || '';
  const prefix = `${wo}_${at}_`;

  if (!seqMap[prefix]) seqMap[prefix] = 1;
  const seq = seqMap[prefix]++;
  const id = `${prefix}${String(seq).padStart(4, '0')}`;

  const wc = (r['Word \r\nCount'] || '').replace(/,/g, '').trim();
  const cz = (r['Character \r\nwz Space'] || '').replace(/,/g, '').trim();
  const st = r['Status'] || '';
  const dd = clean(r['Del \r\nDate'] || '');
  const tc = r['Transcriptionist Comments'] || '';
  const rc = r['RegDeck Admin Comments'] || '';

  lines.push({
    id,
    wc: wc || null,
    cz: cz || null,
    st: st || null,
    dd: parseDate(dd),
    tc: tc || null,
    rc: rc || null
  });
});

let sql = '-- DML Script: Update work_orders from Book2.xlsx\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n';
sql += '-- Total records: ' + lines.length + '\n';
sql += '-- Columns updated: word_count, character_wz_space, status, del_date, employee_comments, regdeck_admin_comments\n\n';
sql += 'BEGIN;\n\n';

lines.forEach((l) => {
  sql += 'UPDATE work_orders SET\n';
  sql += `  word_count = ${l.wc !== null ? l.wc : 'NULL'},\n`;
  sql += `  character_wz_space = ${l.cz !== null ? l.cz : 'NULL'},\n`;
  sql += `  status = ${esc(l.st)},\n`;
  sql += `  del_date = ${l.dd ? "'" + l.dd + "'" : 'NULL'},\n`;
  sql += `  employee_comments = ${esc(l.tc)},\n`;
  sql += `  regdeck_admin_comments = ${esc(l.rc)}\n`;
  sql += `WHERE id = ${esc(l.id)};\n\n`;
});

sql += 'COMMIT;\n';

fs.writeFileSync('excel/update_work_orders.sql', sql);
console.log(`SQL file written: excel/update_work_orders.sql`);
console.log(`Total UPDATE statements: ${lines.length}`);
