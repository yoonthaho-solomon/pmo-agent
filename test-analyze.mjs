import * as XLSX from 'xlsx'

// --- callcard_eta 샘플 데이터 (asp_id는 숫자) ---
const callcardData = [
  { asp_id: 1001, EXPIRED_OUTCOME: 'ACCEPTED', STATUS: 'DONE',       surge_price_A: 1500 },
  { asp_id: 1001, EXPIRED_OUTCOME: 'ACCEPTED', STATUS: 'DONE',       surge_price_A: 0    },
  { asp_id: 1001, EXPIRED_OUTCOME: 'EXPIRED',  STATUS: 'DONE',       surge_price_A: 0    },
  { asp_id: 1001, EXPIRED_OUTCOME: '',          STATUS: 'CANCELED',   surge_price_A: 0    },
  { asp_id: 1002, EXPIRED_OUTCOME: 'ACCEPTED', STATUS: 'DONE',       surge_price_A: 2000 },
  { asp_id: 1002, EXPIRED_OUTCOME: 'ACCEPTED', STATUS: 'DONE',       surge_price_A: 3000 },
  { asp_id: 1002, EXPIRED_OUTCOME: '',          STATUS: 'D_CANCELED', surge_price_A: 0    },
  { asp_id: 1003, EXPIRED_OUTCOME: 'EXPIRED',  STATUS: 'DONE',       surge_price_A: 500  },
  // 9999는 remapped에 없으므로 필터링되어야 함
  { asp_id: 9999, EXPIRED_OUTCOME: 'ACCEPTED', STATUS: 'DONE',       surge_price_A: 0    },
]

// --- remapped 샘플 데이터 ---
const remappedData = [
  { asp_id: 1001, region: 'Seoul' },
  { asp_id: 1002, region: 'Busan' },
  { asp_id: 1003, region: 'Daegu' },
]

function makeXlsxBuffer(data) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

const callcardBuf = makeXlsxBuffer(callcardData)
const remappedBuf = makeXlsxBuffer(remappedData)

const form = new FormData()
form.append('callcard_eta', new Blob([callcardBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'callcard_eta.xlsx')
form.append('remapped',     new Blob([remappedBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'remapped.xlsx')
form.append('service_date', '2026-06-10')

console.log('POST /api/analyze ...')
const res = await fetch('http://localhost:3000/api/analyze', { method: 'POST', body: form })
const json = await res.json()

console.log(`\nHTTP ${res.status}`)
console.log(JSON.stringify(json, null, 2))
