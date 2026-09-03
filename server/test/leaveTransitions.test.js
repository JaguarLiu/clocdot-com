import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canRequestCancel, canDecideCancel, canReview,
} from '../src/services/leaveTransitions.js'

test('canRequestCancel: approved + not already requested → true', () => {
  assert.equal(canRequestCancel({ status: 'approved', cancelRequested: false }), true)
})

test('canRequestCancel: pending → false', () => {
  assert.equal(canRequestCancel({ status: 'pending', cancelRequested: false }), false)
})

test('canRequestCancel: already cancelRequested → false (no double request)', () => {
  assert.equal(canRequestCancel({ status: 'approved', cancelRequested: true }), false)
})

test('canRequestCancel: cancelled → false', () => {
  assert.equal(canRequestCancel({ status: 'cancelled', cancelRequested: false }), false)
})

test('canDecideCancel: cancelRequested flag set → true', () => {
  assert.equal(canDecideCancel({ status: 'approved', cancelRequested: true }), true)
})

test('canDecideCancel: no pending cancel → false', () => {
  assert.equal(canDecideCancel({ status: 'approved', cancelRequested: false }), false)
})

test('canReview: pending → true', () => {
  assert.equal(canReview({ status: 'pending' }), true)
})

test('canReview: already approved → false', () => {
  assert.equal(canReview({ status: 'approved' }), false)
})
