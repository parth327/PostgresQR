const ExcelJS = require('exceljs');

const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const DEFAULT_HEADER_COLOR = 'FF4F46E5';
const HYPERLINK_FONT = { color: { argb: 'FF1D4ED8' }, underline: true };

// Strips characters that are unsafe in filenames on Windows/Mac/Linux.
function safeFilename(str) {
  return String(str || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
}

// Builds a Content-Disposition header that works for both plain-ASCII
// filenames and ones containing non-ASCII text (e.g. Gujarati event names).
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '').trim() || 'export.xlsx';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Builds an .xlsx workbook from plain data and streams it to the client as
 * a file download.
 *
 * @param {import('express').Response} res
 * @param {Object} opts
 * @param {string} opts.filename   - download filename, e.g. "users-2026-08-18.xlsx"
 * @param {string} opts.sheetName  - Excel tab name (auto-truncated to 31 chars)
 * @param {string} [opts.title]    - big banner row shown above the header row
 * @param {string} [opts.subtitle] - smaller line under the title (counts, filters, generated-at)
 * @param {string} [opts.headerColor] - ARGB hex for the header row fill (defaults to indigo)
 * @param {Array<{header:string, key:string, width?:number, hyperlink?:boolean}>} opts.columns
 * @param {Array<Object>} opts.rows - plain objects keyed by each column's `key`
 */
async function sendExcelFile(res, { filename, sheetName, title, subtitle, headerColor, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PostgresQR Admin Panel';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet((sheetName || 'Sheet1').slice(0, 31));
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width || 18 }));

  let cursor = 1;

  if (title) {
    const row = sheet.getRow(cursor);
    row.height = 26;
    for (let c = 1; c <= columns.length; c++) {
      const cell = row.getCell(c);
      cell.fill = TITLE_FILL;
      if (c === 1) {
        cell.value = title;
        cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      }
    }
    sheet.mergeCells(cursor, 1, cursor, columns.length);
    cursor++;
  }

  if (subtitle) {
    const row = sheet.getRow(cursor);
    row.getCell(1).value = subtitle;
    row.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    sheet.mergeCells(cursor, 1, cursor, columns.length);
    cursor++;
  }

  if (title || subtitle) cursor++; // blank spacer row

  const headerRowNum = cursor;
  const headerRow = sheet.getRow(headerRowNum);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor || DEFAULT_HEADER_COLOR } };
    cell.alignment = { vertical: 'middle' };
  });
  headerRow.height = 20;
  cursor++;

  rows.forEach((r) => {
    const row = sheet.getRow(cursor);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const val = r[c.key];
      const isEmpty = val === undefined || val === null || val === '';
      if (c.hyperlink && !isEmpty) {
        cell.value = { text: String(val), hyperlink: String(val) };
        cell.font = HYPERLINK_FONT;
      } else {
        cell.value = isEmpty ? '\u2014' : val;
      }
    });
    cursor++;
  });

  sheet.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum, column: columns.length } };
  sheet.views = [{ state: 'frozen', ySplit: headerRowNum }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', contentDisposition(filename));
  res.setHeader('Cache-Control', 'no-store');

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { sendExcelFile, safeFilename };
