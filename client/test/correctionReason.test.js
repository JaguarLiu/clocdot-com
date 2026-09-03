import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCorrectionReason, punchTypeLabel, STORED_TYPE_IN, STORED_TYPE_OUT,
} from '../src/utils/correctionReason.js'

// 這支測試釘住一個容易被「順手翻譯」破壞的不變量：
// 補卡原因在 DB 裡的格式永遠是中文，與介面語言無關。
// 若有人把 STORED_TYPE_IN 改成可翻譯字串，既有紀錄就會解析失敗。

test('解析儲存格式：[上班] 09:00 - 說明', () => {
  assert.deepEqual(parseCorrectionReason('[上班] 09:00 - 忘記打卡'), {
    type: '上班', time: '09:00', detail: '忘記打卡',
  })
})

test('解析下班、個位數小時與空白說明', () => {
  assert.deepEqual(parseCorrectionReason('[下班] 9:05 - '), {
    type: '下班', time: '9:05', detail: '',
  })
})

test('說明含連字號時只切第一個分隔符', () => {
  assert.equal(parseCorrectionReason('[上班] 09:00 - 系統當機 - 已回報 IT').detail, '系統當機 - 已回報 IT')
})

test('無法辨識的格式原樣放進 detail，不丟資料', () => {
  assert.deepEqual(parseCorrectionReason('舊格式的自由文字'), {
    type: '--', time: '--', detail: '舊格式的自由文字',
  })
})

test('null / undefined 不拋錯', () => {
  assert.equal(parseCorrectionReason(null).type, '--')
  assert.equal(parseCorrectionReason(undefined).type, '--')
})

test('儲存用的類型常數必須維持中文字面值', () => {
  assert.equal(STORED_TYPE_IN, '上班')
  assert.equal(STORED_TYPE_OUT, '下班')
})

test('顯示時才依語言轉換，無法辨識者原樣回傳', () => {
  const t = (key) => ({ 'attendance.punchIn': 'Clock in', 'attendance.punchOut': 'Clock out' }[key] ?? key)
  assert.equal(punchTypeLabel(t, STORED_TYPE_IN), 'Clock in')
  assert.equal(punchTypeLabel(t, STORED_TYPE_OUT), 'Clock out')
  assert.equal(punchTypeLabel(t, '--'), '--')
})

test('parse → label 的往返：英文介面下仍能正確辨識中文儲存值', () => {
  const t = (key) => ({ 'attendance.punchIn': 'Clock in' }[key] ?? key)
  const parsed = parseCorrectionReason('[上班] 08:30 - overslept')
  assert.equal(punchTypeLabel(t, parsed.type), 'Clock in')
})
