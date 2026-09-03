import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCalendarEvents } from '../src/services/leaveCalendarView.js'

const rows = [{
  userId: 'u1',
  user: { id: 'u1', name: 'Alice' },
  leaveType: 'annual',
  reason: 'trip',
  startDate: new Date('2026-06-01T00:00:00Z'),
  startTime: '09:00',
  endDate: new Date('2026-06-02T00:00:00Z'),
  endTime: '18:00',
}]

test('admin view keeps leaveType and times', () => {
  const [ev] = toCalendarEvents(rows, 'admin')
  assert.equal(ev.userId, 'u1')
  assert.equal(ev.name, 'Alice')
  assert.equal(ev.leaveType, 'annual')
  assert.equal(ev.startTime, '09:00')
})

test('admin view never leaks reason', () => {
  const [ev] = toCalendarEvents(rows, 'admin')
  assert.equal('reason' in ev, false)
})

test('employee view shows only who is off (no leaveType/reason/times)', () => {
  const [ev] = toCalendarEvents(rows, 'employee')
  assert.deepEqual(Object.keys(ev).sort(), ['endDate', 'name', 'startDate', 'userId'])
  assert.equal(ev.leaveType, undefined)
})
