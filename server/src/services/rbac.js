// 後台模組權限純邏輯（不碰 DB）。

// 可授權給角色的模組
export const GRANTABLE_MODULES = [
  'monthly-report', 'corrections', 'leaves', 'overtime-reviews', 'employees', 'payroll', 'schedule',
]

// 全部模組 key（含特例）
export const MODULE_KEYS = [...GRANTABLE_MODULES, 'dashboard', 'settings']

/**
 * @param {{isAdmin:boolean, permissions:string[]}} user
 * @param {string} key
 */
export function canAccessModule(user, key) {
  if (user?.isAdmin) return true
  if (key === 'dashboard') return true // 任何後台使用者皆可
  if (!GRANTABLE_MODULES.includes(key)) return false // settings/未知 → 非 admin 不可
  return Array.isArray(user?.permissions) && user.permissions.includes(key)
}

/** 過濾出合法、可授權、去重後的模組 key 集合 */
export function normalizePermissions(input) {
  const arr = Array.isArray(input) ? input : []
  return Array.from(new Set(arr.filter((k) => GRANTABLE_MODULES.includes(k))))
}

/**
 * 把外部傳入的 roleId（select value 多為字串）轉成 Int。
 * 空字串/null/undefined → null（不指派/清空）；非整數 → undefined（呼叫端視為 400）。
 */
export function parseRoleId(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isInteger(n) ? n : undefined
}
