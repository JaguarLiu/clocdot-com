import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessModule, normalizePermissions, GRANTABLE_MODULES, MODULE_KEYS, parseRoleId } from '../src/services/rbac.js'

test('admin 可存取所有模組（含 settings）', () => {
  for (const k of MODULE_KEYS) {
    assert.equal(canAccessModule({ isAdmin: true, permissions: [] }, k), true)
  }
})

test('非 admin：命中 permissions 才可', () => {
  const u = { isAdmin: false, permissions: ['leaves'] }
  assert.equal(canAccessModule(u, 'leaves'), true)
  assert.equal(canAccessModule(u, 'payroll'), false)
})

test('非 admin：dashboard 一律可（落地頁）', () => {
  assert.equal(canAccessModule({ isAdmin: false, permissions: [] }, 'dashboard'), true)
})

test('非 admin：settings 永遠不可', () => {
  assert.equal(canAccessModule({ isAdmin: false, permissions: ['settings'] }, 'settings'), false)
})

test('未知 module → false', () => {
  assert.equal(canAccessModule({ isAdmin: false, permissions: ['x'] }, 'x'), false)
})

test('normalizePermissions：過濾不可授權/未知、去重', () => {
  const r = normalizePermissions(['leaves', 'leaves', 'settings', 'dashboard', 'nope', 'payroll'])
  assert.deepEqual([...r].sort(), ['leaves', 'payroll'])
})

test('GRANTABLE 不含 settings / dashboard', () => {
  assert.equal(GRANTABLE_MODULES.includes('settings'), false)
  assert.equal(GRANTABLE_MODULES.includes('dashboard'), false)
})

test('parseRoleId：合法數字字串 → Int', () => {
  assert.equal(parseRoleId('42'), 42)
  assert.equal(parseRoleId(42), 42)
})

test('parseRoleId：空 / null / undefined → null', () => {
  assert.equal(parseRoleId(''), null)
  assert.equal(parseRoleId(null), null)
  assert.equal(parseRoleId(undefined), null)
})

test('parseRoleId：非法 → undefined', () => {
  assert.equal(parseRoleId('abc'), undefined)
  assert.equal(parseRoleId('1.5'), undefined)
})
