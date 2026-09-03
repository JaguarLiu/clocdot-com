import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSettlement } from '../src/services/settlement.js'

const company = {
  standardDailyMinutes: 480,
  workdayWeekdays: [1, 2, 3, 4, 5],
  restDayWeekdays: [6],
  regularLeaveWeekdays: [7],
}

test('彙整單一員工：應出勤日、實出勤、遲到早退、加班分級', () => {
  // 2026-05：以 5/20(三)、5/21(四) 兩個工作日為例
  const input = {
    month: '2026-05',
    company,
    holidays: new Set(),
    exceptions: {},
    users: [{ id: 'u1', empNo: 1, name: '小明' }],
    attendance: [
      { userId: 'u1', workDate: '2026-05-20', workDuration: 600, isLate: true, isEarlyLeave: false },
      { userId: 'u1', workDate: '2026-05-21', workDuration: 480, isLate: false, isEarlyLeave: true },
    ],
    approvedOvertime: [
      // 5/20 核准加班 2h，全進 1.34
      { userId: 'u1', tiers: [{ rate: '1.34', minutes: 120 }] },
    ],
    approvedLeaveMinutesByUser: { u1: 0 },
  }
  const rows = buildSettlement(input)
  assert.equal(rows.length, 1)
  const r = rows[0]
  assert.equal(r.empNo, 1)
  assert.equal(r.expectedWorkdays, 21) // 2026-05 工作日數（週一~五，無假日）
  assert.equal(r.expectedMinutes, 21 * 480)
  assert.equal(r.actualWorkdays, 2)
  assert.equal(r.actualMinutes, 1080)
  assert.equal(r.lateCount, 1)
  assert.equal(r.earlyLeaveCount, 1)
  assert.equal(r.leaveMinutes, 0)
  assert.deepEqual(r.overtimeByRate, { '1.34': 120 })
})

test('應出勤時數扣除核准請假時數', () => {
  const input = {
    month: '2026-05',
    company,
    holidays: new Set(),
    exceptions: {},
    users: [{ id: 'u1', empNo: 1, name: '小明' }],
    attendance: [],
    approvedOvertime: [],
    approvedLeaveMinutesByUser: { u1: 480 },
  }
  const r = buildSettlement(input)[0]
  assert.equal(r.expectedMinutes, 21 * 480 - 480)
  assert.equal(r.leaveMinutes, 480)
})

test('多筆加班分級依 rate 加總', () => {
  const input = {
    month: '2026-05',
    company,
    holidays: new Set(),
    exceptions: {},
    users: [{ id: 'u1', empNo: 1, name: '小明' }],
    attendance: [],
    approvedOvertime: [
      { userId: 'u1', tiers: [{ rate: '1.34', minutes: 120 }, { rate: '1.67', minutes: 60 }] },
      { userId: 'u1', tiers: [{ rate: '1.34', minutes: 60 }] },
    ],
    approvedLeaveMinutesByUser: {},
  }
  const r = buildSettlement(input)[0]
  assert.deepEqual(r.overtimeByRate, { '1.34': 180, '1.67': 60 })
})

test('attendanceDays：每個工作日一筆，含遲退分鐘與請假', () => {
  const rows = buildSettlement({
    month: '2026-05',
    company,
    holidays: new Set(),
    exceptions: {},
    users: [{ id: 'u1', empNo: 1, name: '小明' }],
    attendance: [
      { userId: 'u1', workDate: '2026-05-20', workDuration: 450, isLate: true, isEarlyLeave: false, lateMinutes: 30, earlyLeaveMinutes: 0 },
    ],
    approvedOvertime: [],
    approvedLeaveMinutesByUser: { u1: 0 },
    leaveDaysByUser: { u1: { '2026-05-21': [{ leaveType: 'sick', minutes: 480 }] } },
  })
  const r = rows[0]
  assert.equal(r.attendanceDays.length, 21) // 2026-05 有 21 個工作日
  const d20 = r.attendanceDays.find((d) => d.workDate === '2026-05-20')
  assert.equal(d20.workDuration, 450)
  assert.equal(d20.lateMinutes, 30)
  assert.deepEqual(d20.leaves, [])
  const d21 = r.attendanceDays.find((d) => d.workDate === '2026-05-21')
  assert.equal(d21.workDuration, null)
  assert.deepEqual(d21.leaves, [{ leaveType: 'sick', minutes: 480 }])
  // 21 工作日 - 1 出勤(5/20) - 1 全日請假(5/21) = 19 天完全缺勤
  assert.equal(r.absenceDays, 19)
})

test('employmentType 原樣放進輸出列', () => {
  const rows = buildSettlement({
    month: '2026-05', company, holidays: new Set(), exceptions: {},
    users: [{ id: 'u1', empNo: 1, name: '小明', employmentType: 'parttime' }],
    attendance: [], approvedOvertime: [], approvedLeaveMinutesByUser: {},
  })
  assert.equal(rows[0].employmentType, 'parttime')
})
