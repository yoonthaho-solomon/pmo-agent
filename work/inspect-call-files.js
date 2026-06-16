const XLSX = require('xlsx');
const files = [
  'C:/Users/pgman/OneDrive/바탕 화면/호출데이터/20260523_call_data/20260523_RAW_DATA_callcard_eta.xlsx',
  'C:/Users/pgman/OneDrive/바탕 화면/호출데이터/20260523_call_data/20260523_RAW_DATA_remapped.xlsx',
];
const out = [];
for (const file of files) {
  const wb = XLSX.readFile(file);
  out.push({
    file,
    sheets: wb.SheetNames.map((sheet) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null });
      return { sheet, rows: rows.length, headers: rows[0] ?? [], sample: rows[1] ?? [] };
    }),
  });
}
console.log(JSON.stringify(out, null, 2));
