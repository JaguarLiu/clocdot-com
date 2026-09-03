import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOnsiteCheck } from '../src/services/onsiteCheck.js'

// 每天都是 onsite 必到日的公司設定
const onsiteEveryDay = {
  onsiteCycleWeeks: 1,
  onsiteWeekdaysByCycle: [[1, 2, 3, 4, 5, 6, 7]],
  onsiteMonthDays: [],
}
// 完全不要求 onsite 的公司
const noOnsite = {
  onsiteCycleWeeks: 1,
  onsiteWeekdaysByCycle: [],
  onsiteMonthDays: [],
}
const wd = new Date('2026-07-15T00:00:00Z')

// ---- 既有 GPS 行為（未啟用 WiFi）不變 ----

test('非 onsite 日 → 一律通過', () => {
  const r = buildOnsiteCheck({
    company: { ...noOnsite, wifiCheckinEnabled: false },
    todayRecord: { workDate: wd },
    locationType: 'remote',
    clientIp: '1.2.3.4',
  })
  assert.equal(r.ok, true)
})

test('onsite 日 + GPS 在公司範圍 → 通過', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: false },
    todayRecord: { workDate: wd },
    locationType: 'office',
    clientIp: null,
  })
  assert.equal(r.ok, true)
})

test('onsite 日 + GPS 不在範圍 → NOT_AT_OFFICE', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: false },
    todayRecord: { workDate: wd },
    locationType: 'remote',
    clientIp: null,
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'NOT_AT_OFFICE')
})

test('onsite 日 + 沒送座標 → NOT_AT_OFFICE (unknown 文案)', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: false },
    todayRecord: { workDate: wd },
    locationType: 'unknown',
    clientIp: null,
  })
  assert.equal(r.ok, false)
  assert.match(r.message, /定位/)
})

test('onsite 日 + 請假 → 豁免通過', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: false },
    todayRecord: { workDate: wd, leaveType: 'annual' },
    locationType: 'remote',
    clientIp: null,
  })
  assert.equal(r.ok, true)
})

// ---- WiFi 模式 ----

test('WiFi 啟用 + onsite 日 + IP 命中 → 通過 (GPS 不看)', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: true, allowedIps: ['203.0.113.0/24'] },
    todayRecord: { workDate: wd },
    locationType: 'remote', // GPS 顯示不在公司也沒關係
    clientIp: '203.0.113.7',
  })
  assert.equal(r.ok, true)
})

test('WiFi 啟用 + onsite 日 + IP 未命中 → NOT_ON_COMPANY_WIFI (GPS 在範圍也擋)', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: true, allowedIps: ['203.0.113.0/24'] },
    todayRecord: { workDate: wd },
    locationType: 'office', // GPS 在公司範圍內也不作數
    clientIp: '114.32.1.9',
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'NOT_ON_COMPANY_WIFI')
  assert.equal(r.message, '不在辦公區域無法打卡')
})

test('WiFi 啟用 + 非 onsite 日 → 不檢查 IP', () => {
  const r = buildOnsiteCheck({
    company: { ...noOnsite, wifiCheckinEnabled: true, allowedIps: ['203.0.113.0/24'] },
    todayRecord: { workDate: wd },
    locationType: 'remote',
    clientIp: '114.32.1.9',
  })
  assert.equal(r.ok, true)
})

test('WiFi 啟用 + onsite 日 + 請假 → 豁免通過', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: true, allowedIps: ['203.0.113.0/24'] },
    todayRecord: { workDate: wd, leaveType: 'sick' },
    locationType: 'unknown',
    clientIp: '114.32.1.9',
  })
  assert.equal(r.ok, true)
})

test('WiFi 啟用但清單為空 → 擋下 (防呆，後端驗證理論上不會讓這發生)', () => {
  const r = buildOnsiteCheck({
    company: { ...onsiteEveryDay, wifiCheckinEnabled: true, allowedIps: [] },
    todayRecord: { workDate: wd },
    locationType: 'office',
    clientIp: '203.0.113.7',
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'NOT_ON_COMPANY_WIFI')
})
