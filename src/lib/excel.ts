import * as XLSX from 'xlsx';

export type ExcelSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

export function downloadWorkbook(filename: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  if (!wb.SheetNames.length) return;
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function downloadXlsx(filename: string, rows: Record<string, unknown>[], sheetName = 'Sayfa1') {
  downloadWorkbook(filename, [{ name: sheetName, rows }]);
}
