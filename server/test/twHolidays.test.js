import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHolidayCsv, getHolidays, getHolidayDateSet, listHolidayYears } from '../src/data/twHolidays/index.js'

const HEADER = 'date,year,name,isholiday,holidaycategory,description\n'

test('只採計國定假日與補假，排除週末與補班日', () => {
  const rows = parseHolidayCsv(HEADER + [
    '20260101,2026,中華民國開國紀念日,是,放假之紀念日及節日,全國放假一日',
    '20260103,2026,,是,星期六、星期日,',          // 一般週末 → 排除
    '20260218,2026,,是,補假,',                     // 補假且名稱空白 → 採計，名稱退回類別
    '20260501,2026,勞動節,是,勞動節,',             // 類別非上述但名稱為勞動節 → 採計
    '20260905,2026,軍人節,否,特定節日,',           // isholiday=否 → 排除
    '20261226,2026,補行上班,否,補行上班日,',        // 補班 → 排除
  ].join('\n'))

  assert.deepEqual(rows.map((r) => r.date), ['2026-01-01', '2026-02-18', '2026-05-01'])
  assert.equal(rows[0].name, '中華民國開國紀念日')
  assert.equal(rows[1].name, '補假') // name 空白時退回類別
  assert.equal(rows[0].year, 2026)
})

test('忽略格式錯誤的列與空行', () => {
  const rows = parseHolidayCsv(HEADER + [
    '2026-01-01,2026,格式錯誤,是,放假之紀念日及節日,',  // 日期非 YYYYMMDD
    '',
    '   ',
    '20260101,2026,正常,是,放假之紀念日及節日,',
  ].join('\n'))
  assert.deepEqual(rows.map((r) => r.date), ['2026-01-01'])
})

test('BOM 與 CRLF 換行都能解析', () => {
  const rows = parseHolidayCsv('﻿' + HEADER.replace('\n', '\r\n')
    + '20260101,2026,開國紀念日,是,放假之紀念日及節日,\r\n')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, '2026-01-01')
})

test('內建資料涵蓋 2026，且含幾個必備的國定假日', () => {
  assert.ok(listHolidayYears().includes(2026), '缺少 2026 年度資料')

  const dates = getHolidayDateSet(2026)
  assert.ok(dates.has('2026-01-01'), '缺少開國紀念日')
  assert.ok(dates.has('2026-05-01'), '缺少勞動節')
  assert.ok(dates.has('2026-10-10'), '缺少國慶日')

  const holidays = getHolidays(2026)
  assert.ok(holidays.length >= 12, `2026 假日數異常少：${holidays.length}`)
  for (const h of holidays) {
    assert.match(h.date, /^2026-\d{2}-\d{2}$/)
    assert.ok(h.name && h.name.length > 0, `${h.date} 缺少名稱`)
  }
})

test('日期依序排列且不重複', () => {
  const dates = getHolidays(2026).map((h) => h.date)
  assert.deepEqual(dates, [...dates].sort(), '未依日期排序')
  assert.equal(new Set(dates).size, dates.length, '有重複日期')
})

test('未內建的年度回傳空陣列而非拋錯', () => {
  assert.deepEqual(getHolidays(2099), [])
  assert.equal(getHolidayDateSet(2099).size, 0)
})
