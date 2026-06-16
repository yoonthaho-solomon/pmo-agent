const XLSX = require('xlsx');
const file = 'C:/Users/pgman/OneDrive/바탕 화면/앱미터데이터/tacho_statistics_20260608_20260608/통계_천안_20260608_20260608.xlsx';
const wb = XLSX.readFile(file);
const result = wb.SheetNames.map((name) => {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  return {
    sheet: name,
    rows: rows.length,
    headers: rows[0] ?? [],
    sample: rows[1] ?? [],
  };
});
console.log(JSON.stringify(result, null, 2));
