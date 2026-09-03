import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBalances } from '../src/services/leaveBalance.js'

// 最小 prisma stub：leaveRequest.findMany 回空（無已用），leaveCashout.findMany 回指定
function stubPrisma({ cashouts = [] } = {}) {
  return {
    leaveRequest: { findMany: async () => [] },
    leaveCashout: { findMany: async () => cashouts },
  }
}

const company = { leavePolicyYearReset: 'calendar' }
const user = { id: 'u1', hireDate: new Date('2020-01-01') }

test('annual 餘額扣掉換薪分鐘', async () => {
  const prisma = stubPrisma({ cashouts: [{ minutes: 2 * 480 }] })
  const policies = [{ leaveType: 'annual', annualQuotaMinutes: 10 * 480 }]
  const { balances } = await buildBalances(prisma, { user, company, policies })
  const annual = balances.find((b) => b.leaveType === 'annual')
  assert.equal(annual.cashedOutMinutes, 960)
  assert.equal(annual.remainingMinutes, 10 * 480 - 0 - 960)
})

test('非 annual 不受換薪影響', async () => {
  const prisma = stubPrisma({ cashouts: [{ minutes: 999 }] })
  const policies = [{ leaveType: 'sick', annualQuotaMinutes: 5 * 480 }]
  const { balances } = await buildBalances(prisma, { user, company, policies })
  const sick = balances.find((b) => b.leaveType === 'sick')
  assert.equal(sick.cashedOutMinutes, 0)
  assert.equal(sick.remainingMinutes, 5 * 480)
})
