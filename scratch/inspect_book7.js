import ExcelJS from 'exceljs';
import fs from 'fs';

function parseWoDate(raw) {
  if (!raw || typeof raw !== 'number') return null;
  // Format: MDD or MMDD → e.g., 318=Mar 18, 715=Jul 15, 1205=Dec 05
  const s = String(raw);
  let month, day;
  if (s.length === 3) {
    month = s.substring(0, 1);
    day = s.substring(1, 3);
  } else if (s.length === 4) {
    month = s.substring(0, 2);
    day = s.substring(2, 4);
  } else {
    return null;
  }
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Assume year 2026 based on hearing date context
  return `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatCellAsDate(cell) {
  const val = cell.value;
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  return null;
}

function escapeSql(s) {
  return s ? s.replace(/'/g, "''") : null;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('Book7.xlsx');
  const worksheet = workbook.worksheets[0];

  const sqlStatements = [];
  let skippedNull = 0;
  let skippedBadDate = 0;

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    
    const woDateRaw = row.getCell(1).value;
    const woNumber = row.getCell(2).value;
    const fileNumber = row.getCell(5).value;
    const hearingDateCell = row.getCell(6);
    const extraCol = row.getCell(18).value;

    // Skip rows where Extra Column is null/empty
    if (extraCol === null || extraCol === undefined || String(extraCol).trim() === '') {
      skippedNull++;
      continue;
    }

    // Parse WO Date from compact MDD/MMDD format
    const woDate = parseWoDate(woDateRaw);
    if (!woDate) {
      skippedBadDate++;
      console.warn(`Row ${i}: Could not parse WO Date: ${woDateRaw}`);
      continue;
    }

    const hearingDate = formatCellAsDate(hearingDateCell);
    const woNum = woNumber ? escapeSql(String(woNumber).trim()) : null;
    const fileNum = fileNumber ? escapeSql(String(fileNumber).trim()) : null;
    const extraVal = escapeSql(String(extraCol).trim().padStart(8, '0'));

    // Build WHERE clause using wo_date, work_order_number, hearing_date, file_number
    const conditions = [];
    conditions.push(`wo_date = '${woDate}'`);
    
    if (woNum) conditions.push(`work_order_number = '${woNum}'`);
    else conditions.push(`work_order_number IS NULL`);
    
    if (hearingDate) conditions.push(`hearing_date = '${hearingDate}'`);
    else conditions.push(`hearing_date IS NULL`);
    
    if (fileNum) conditions.push(`file_number = '${fileNum}'`);
    else conditions.push(`file_number IS NULL`);

    const sql = `UPDATE public.work_orders SET additional_comments = '${extraVal}' WHERE ${conditions.join(' AND ')};`;
    sqlStatements.push(sql);
  }

  // Write SQL file
  const output = `-- ============================================
-- DML Script: Map "Extra Column" from Book7.xlsx
-- to additional_comments in work_orders table
-- Generated: ${new Date().toISOString()}
-- Total UPDATE statements: ${sqlStatements.length}
-- Skipped (null Extra Column): ${skippedNull}
-- Skipped (bad WO Date): ${skippedBadDate}
-- ============================================

BEGIN;

${sqlStatements.join('\n')}

COMMIT;
`;

  fs.writeFileSync('update_additional_comments.sql', output);
  
  console.log(`\nGenerated ${sqlStatements.length} UPDATE statements`);
  console.log(`Skipped ${skippedNull} rows (null Extra Column)`);
  console.log(`Skipped ${skippedBadDate} rows (bad WO Date)`);
  console.log(`Output: update_additional_comments.sql`);
  
  // Preview first 10
  console.log('\n--- First 10 statements:');
  sqlStatements.slice(0, 10).forEach(s => console.log(s));
}

main().catch(console.error);
