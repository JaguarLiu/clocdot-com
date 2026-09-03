import { test } from 'node:test'
import assert from 'node:assert/strict'
import { p2002Fields, p2002HasField } from '../src/utils/prismaError.js'

test('傳統 Prisma：meta.target 陣列', () => {
  const err = { code: 'P2002', meta: { target: ['empNo'] } }
  assert.deepEqual(p2002Fields(err), ['empNo'])
  assert.equal(p2002HasField(err, 'empNo'), true)
  assert.equal(p2002HasField(err, 'email'), false)
})

test('傳統 Prisma：meta.target 字串（約束名含欄位）', () => {
  const err = { code: 'P2002', meta: { target: 'users_empNo_key' } }
  assert.equal(p2002HasField(err, 'empNo'), true)
})

test('Prisma 7 pg adapter：driverAdapterError.cause.constraint.fields（含引號）', () => {
  const err = {
    code: 'P2002',
    meta: { driverAdapterError: { cause: { constraint: { fields: ['"empNo"'] } } } },
  }
  assert.deepEqual(p2002Fields(err), ['empNo'])
  assert.equal(p2002HasField(err, 'empNo'), true)
  assert.equal(p2002HasField(err, 'email'), false)
})

test('無 meta → 空、不命中', () => {
  assert.deepEqual(p2002Fields({ code: 'P2002' }), [])
  assert.equal(p2002HasField({ code: 'P2002' }, 'empNo'), false)
})
