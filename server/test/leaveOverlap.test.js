import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findOverlaps } from '../src/services/leaveOverlap.js'

const d = (s) => new Date(`${s}T00:00:00Z`)

const existing = [
  { userId: 'u1', name: 'Alice', startDate: d('2026-06-01'), endDate: d('2026-06-03') },
  { userId: 'u2', name: 'Bob', startDate: d('2026-06-10'), endDate: d('2026-06-10') },
]

test('range fully inside an existing leave → overlap', () => {
  const r = findOverlaps(existing, { startDate: d('2026-06-02'), endDate: d('2026-06-02') })
  assert.deepEqual(r.map((x) => x.userId), ['u1'])
})

test('touching boundary (end == existing start) → overlap (inclusive)', () => {
  const r = findOverlaps(existing, { startDate: d('2026-05-30'), endDate: d('2026-06-01') })
  assert.deepEqual(r.map((x) => x.userId), ['u1'])
})

test('no overlap → empty', () => {
  const r = findOverlaps(existing, { startDate: d('2026-06-05'), endDate: d('2026-06-06') })
  assert.deepEqual(r, [])
})

test('spanning both existing ranges → both returned', () => {
  const r = findOverlaps(existing, { startDate: d('2026-06-01'), endDate: d('2026-06-30') })
  assert.deepEqual(r.map((x) => x.userId), ['u1', 'u2'])
})

test('excludeUserId filters out own requests', () => {
  const r = findOverlaps(existing, {
    startDate: d('2026-06-02'), endDate: d('2026-06-02'), excludeUserId: 'u1',
  })
  assert.deepEqual(r, [])
})
