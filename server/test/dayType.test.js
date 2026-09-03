import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDayType } from '../src/services/dayType.js'

const company = {
  workdayWeekdays: [1, 2, 3, 4, 5],
  restDayWeekdays: [6],
  regularLeaveWeekdays: [7],
}
const holidays = new Set(['2026-10-10'])

// 2026-05-20 是週三 → 工作日
test('平日週三 → workday', () => {
  assert.equal(resolveDayType('2026-05-20', company, { holidays, exceptions: {} }), 'workday')
})

// 2026-05-23 是週六 → 休息日
test('週六 → restday', () => {
  assert.equal(resolveDayType('2026-05-23', company, { holidays, exceptions: {} }), 'restday')
})

// 2026-05-24 是週日 → 例假
test('週日 → regular_leave', () => {
  assert.equal(resolveDayType('2026-05-24', company, { holidays, exceptions: {} }), 'regular_leave')
})

test('國定假日表命中 → national_holiday（優先於週三工作日）', () => {
  // 2026-10-10 是週六，但國定假日優先
  assert.equal(resolveDayType('2026-10-10', company, { holidays, exceptions: {} }), 'national_holiday')
})

test('CompanyDayException 覆寫一切（補班日：把週六變 workday）', () => {
  const exceptions = { '2026-05-23': 'workday' }
  assert.equal(resolveDayType('2026-05-23', company, { holidays, exceptions }), 'workday')
})

test('CompanyDayException 覆寫國定假日（彈性放假反向：把假日變工作日）', () => {
  const exceptions = { '2026-10-10': 'workday' }
  assert.equal(resolveDayType('2026-10-10', company, { holidays, exceptions }), 'workday')
})
