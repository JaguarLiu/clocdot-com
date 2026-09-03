import test from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapAdmin, validateBootstrapInput } from '../src/services/bootstrapAdmin.js'

function fakePrisma({ existingUser = null, company = null, role = null, companyUserCount = 0 } = {}) {
  const calls = []
  const tx = {
    user: {
      findUnique: async () => existingUser,
      count: async () => companyUserCount,
      create: async ({ data }) => {
        calls.push(['user.create', data])
        return { id: 'user-1', email: data.email }
      },
    },
    company: {
      findFirst: async () => company,
      create: async ({ data }) => {
        calls.push(['company.create', data])
        return { id: 'company-1', ...data }
      },
    },
    role: {
      findFirst: async () => role,
      create: async ({ data }) => {
        calls.push(['role.create', data])
        return { id: 7, members: [], ...data }
      },
    },
  }
  return {
    calls,
    $transaction: async (callback, options) => {
      calls.push(['transaction', options])
      return callback(tx)
    },
  }
}

const validInput = {
  companyName: 'Example Company',
  email: 'Admin@Example.com',
  name: 'System Administrator',
  password: 'a-unique-password-123',
}

test('validates and normalizes bootstrap input', () => {
  const result = validateBootstrapInput(validInput)
  assert.equal(result.email, 'admin@example.com')
  assert.throws(() => validateBootstrapInput({ ...validInput, password: 'short' }), /at least 12/)
})

test('creates company, admin role, and administrator atomically', async () => {
  const prisma = fakePrisma()
  const result = await bootstrapAdmin(prisma, validInput, async () => 'hashed-password')

  assert.equal(result.created, true)
  assert.deepEqual(prisma.calls[0], ['transaction', { isolationLevel: 'Serializable' }])
  assert.equal(prisma.calls.find(([name]) => name === 'role.create')[1].isAdmin, true)
  const userData = prisma.calls.find(([name]) => name === 'user.create')[1]
  assert.equal(userData.email, 'admin@example.com')
  assert.equal(userData.password, 'hashed-password')
  assert.equal(userData.roleId, 7)
})

test('is idempotent for the same company administrator', async () => {
  const prisma = fakePrisma({
    existingUser: {
      id: 'user-1', email: 'admin@example.com', companyId: 'company-1',
      company: { name: 'Example Company' }, rbacRole: { isAdmin: true },
    },
  })
  const result = await bootstrapAdmin(prisma, validInput, async () => 'unused-hash')
  assert.equal(result.created, false)
  assert.equal(prisma.calls.some(([name]) => name.endsWith('.create')), false)
})

test('refuses to add a second administrator through bootstrap', async () => {
  const prisma = fakePrisma({
    company: { id: 'company-1', name: 'Example Company' },
    role: { id: 7, isAdmin: true, members: [{ email: 'owner@example.com' }] },
  })
  await assert.rejects(
    bootstrapAdmin(prisma, validInput, async () => 'hashed-password'),
    /already has an administrator/,
  )
})

test('refuses to join a same-named company that already has users', async () => {
  const prisma = fakePrisma({
    company: { id: 'other-tenant', name: 'Example Company' },
    companyUserCount: 3,
  })
  await assert.rejects(
    bootstrapAdmin(prisma, validInput, async () => 'hashed-password'),
    /already exists with 3 user\(s\)/,
  )
  assert.equal(prisma.calls.some(([name]) => name.endsWith('.create')), false)
})

test('still bootstraps into a pre-existing company with no users', async () => {
  const prisma = fakePrisma({
    company: { id: 'empty-company', name: 'Example Company' },
    companyUserCount: 0,
  })
  const result = await bootstrapAdmin(prisma, validInput, async () => 'hashed-password')

  assert.equal(result.created, true)
  assert.equal(result.companyId, 'empty-company')
  assert.equal(prisma.calls.some(([name]) => name === 'company.create'), false)
})
