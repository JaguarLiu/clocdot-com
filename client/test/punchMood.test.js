import { test } from 'node:test'
import assert from 'node:assert/strict'
import { punchMood } from '../src/utils/punchMood.js'

test('上班卡：遲到才生氣', () => {
  assert.equal(punchMood('in', { isLate: false, isEarlyLeave: false }), 'happy')
  assert.equal(punchMood('in', { isLate: true, isEarlyLeave: false }), 'angry')
})

test('下班卡：早退才生氣，早上遲到不再算一次', () => {
  assert.equal(punchMood('out', { isLate: true, isEarlyLeave: false }), 'happy')
  assert.equal(punchMood('out', { isLate: false, isEarlyLeave: true }), 'angry')
})

test('沒有紀錄（例如無班別）視為正常', () => {
  assert.equal(punchMood('in', null), 'happy')
  assert.equal(punchMood('out', undefined), 'happy')
})
