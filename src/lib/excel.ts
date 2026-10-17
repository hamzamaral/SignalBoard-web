import * as XLSX from 'xlsx';

export function downloadXlsx(filename: string, rows: Record<string, unknown>[], sheetName = 'Sayfa1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
