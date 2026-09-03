import { test } from 'node:test'
import assert from 'node:assert/strict'
import adminRoutes from '../src/routes/admin.js'

const expectedRoutes = [
  ['GET', '/api/admin/me', null],
  ['GET', '/api/admin/settlement', 'monthly-report'],
  ['GET', '/api/admin/settlement/export', 'monthly-report'],
  ['GET', '/api/admin/attendance', 'monthly-report'],
  ['GET', '/api/admin/attendance/yearly', 'monthly-report'],
  ['GET', '/api/admin/attendance/export', 'monthly-report'],
  ['PATCH', '/api/admin/attendance/:id', 'monthly-report'],
  ['PATCH', '/api/admin/correction-requests/:id', 'corrections'],
  ['GET', '/api/admin/correction-requests', 'corrections'],
  ['GET', '/api/admin/leave-requests', 'leaves'],
  ['GET', '/api/admin/leave-calendar', 'leaves'],
  ['PATCH', '/api/admin/leave-requests/:id', 'leaves'],
  ['GET', '/api/admin/overtime-requests', 'overtime-reviews'],
  ['GET', '/api/admin/compliance/overtime', 'overtime-reviews'],
  ['PATCH', '/api/admin/overtime-requests/:id', 'overtime-reviews'],
  ['GET', '/api/admin/company', null],
  ['PATCH', '/api/admin/company', 'settings'],
  ['GET', '/api/admin/my-ip', 'settings'],
  ['GET', '/api/admin/company-locations', 'settings'],
  ['POST', '/api/admin/company-locations', 'settings'],
  ['PATCH', '/api/admin/company-locations/:id', 'settings'],
  ['DELETE', '/api/admin/company-locations/:id', 'settings'],
  ['GET', '/api/admin/users', 'employees'],
  ['POST', '/api/admin/users', 'employees'],
  ['POST', '/api/admin/users/import/preview', 'employees'],
  ['POST', '/api/admin/users/import', 'employees'],
  ['PATCH', '/api/admin/users/:id', 'employees'],
  ['GET', '/api/admin/departments', null],
  ['POST', '/api/admin/departments', 'settings'],
  ['PATCH', '/api/admin/departments/:id', 'settings'],
  ['DELETE', '/api/admin/departments/:id', 'settings'],
  ['GET', '/api/admin/departments/:deptId/roles', 'settings'],
  ['POST', '/api/admin/departments/:deptId/roles', 'settings'],
  ['PATCH', '/api/admin/roles/:id', 'settings'],
  ['DELETE', '/api/admin/roles/:id', 'settings'],
  ['DELETE', '/api/admin/users/:id', 'employees'],
  ['GET', '/api/admin/salary-profiles', 'payroll'],
  ['GET', '/api/admin/users/:id/salary-profile', 'payroll'],
  ['PUT', '/api/admin/users/:id/salary-profile', 'payroll'],
  ['GET', '/api/admin/payroll-runs', 'payroll'],
  ['GET', '/api/admin/payroll-runs/:month', 'payroll'],
  ['POST', '/api/admin/payroll-runs', 'payroll'],
  ['POST', '/api/admin/payroll-runs/:month/cashout', 'payroll'],
  ['PATCH', '/api/admin/payroll-runs/:month/items/:userId', 'payroll'],
  ['POST', '/api/admin/payroll-runs/:month/lock', 'payroll'],
  ['POST', '/api/admin/payroll-runs/:month/unlock', 'payroll'],
  ['GET', '/api/admin/payroll-runs/:month/export', 'payroll'],
  ['GET', '/api/admin/leave-policies', 'settings'],
  ['PUT', '/api/admin/leave-policies', 'settings'],
  ['GET', '/api/admin/users/:id/leave-balances', 'employees'],
  ['POST', '/api/admin/users/:id/unlock', 'employees'],
  ['PUT', '/api/admin/users/:id/password', 'employees'],
  ['POST', '/api/admin/issues', null],
]

function captureAdminRoutes() {
  const routes = []
  const requirePanel = Symbol('requirePanel')
  const hooks = []
  const fake = {
    requirePanel,
    requireModule(module) {
      const guard = () => {}
      guard.module = module
      return guard
    },
    addHook(name, hook) { hooks.push([name, hook]) },
  }

  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    fake[method] = (url, options, handler) => {
      if (typeof options === 'function') {
        handler = options
        options = {}
      }
      routes.push({ method: method.toUpperCase(), url, options, handler })
    }
  }

  return { fake, routes, hooks, requirePanel }
}

test('admin route contract：每個 API 的 method、path 與 module guard 保持不變', async () => {
  const { fake, routes, hooks, requirePanel } = captureAdminRoutes()
  await adminRoutes(fake)

  assert.deepEqual(hooks, [['onRequest', requirePanel]])
  assert.equal(routes.length, expectedRoutes.length)

  const actual = routes.map(({ method, url, options }) => [
    method,
    url,
    options.preHandler?.module ?? null,
  ])
  assert.deepEqual(actual, expectedRoutes)
  assert.equal(new Set(actual.map(([method, url]) => `${method} ${url}`)).size, actual.length)
})

test('admin route contract：所有寫入 API 都有 handler，帶 body 的 API 保留 schema', async () => {
  const { fake, routes } = captureAdminRoutes()
  await adminRoutes(fake)

  const bodylessWrites = new Set([
    'DELETE /api/admin/company-locations/:id',
    'DELETE /api/admin/departments/:id',
    'DELETE /api/admin/roles/:id',
    'DELETE /api/admin/users/:id',
    'POST /api/admin/payroll-runs/:month/lock',
    'POST /api/admin/payroll-runs/:month/unlock',
    'POST /api/admin/users/:id/unlock',
  ])

  for (const route of routes) {
    assert.equal(typeof route.handler, 'function', `${route.method} ${route.url} 缺少 handler`)
    if (!['POST', 'PUT', 'PATCH'].includes(route.method)) continue
    const key = `${route.method} ${route.url}`
    if (!bodylessWrites.has(key)) {
      assert.ok(route.options.schema?.body, `${key} 缺少 body schema`)
    }
  }
})

test('admin me：拆分後仍可透過員工模組取得管理員角色', async () => {
  const { fake, routes } = captureAdminRoutes()
  fake.prisma = {
    user: { findUnique: async () => ({ id: 'u1', name: '管理員' }) },
    role: { findFirst: async () => ({ id: 7 }) },
  }
  await adminRoutes(fake)

  const route = routes.find((r) => r.method === 'GET' && r.url === '/api/admin/me')
  const result = await route.handler({
    user: { id: 'u1' },
    companyId: 'c1',
    isAdmin: true,
    permissions: ['settings'],
  })

  assert.deepEqual(result, {
    id: 'u1', name: '管理員', isAdmin: true, permissions: ['settings'], adminRoleId: 7,
  })
})
