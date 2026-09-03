import i18n from '../i18n/index.js'

// optional chaining：Vite 建置時會注入 import.meta.env，但在 node --test 下不存在
const API_BASE = import.meta.env?.VITE_API_BASE || '/api'

/** server 依此標頭決定錯誤訊息語言（見 server/src/plugins/i18n.js） */
function acceptLanguage() {
  return { 'Accept-Language': i18n.resolvedLanguage || 'zh-TW' }
}

async function parseAuthError(res) {
  const info = await res.json().catch(() => null)
  const err = new Error(info?.error || i18n.t('login.errFailed'))
  err.status = res.status
  err.info = info
  return err
}

export async function loginWithPassword(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...acceptLanguage() },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw await parseAuthError(res)

  const data = await res.json()
  localStorage.setItem('auth_token', data.token)
  return data.user
}

export async function changePassword(currentPassword, newPassword) {
  const token = getStoredToken()
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...acceptLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  if (!res.ok) throw await parseAuthError(res)
  return res.json()
}

export function logout() {
  localStorage.removeItem('auth_token')
}

export function getStoredToken() {
  return localStorage.getItem('auth_token')
}

export async function getCurrentUser() {
  const token = getStoredToken()
  if (!token) return null

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, ...acceptLanguage() },
  })

  if (!res.ok) {
    localStorage.removeItem('auth_token')
    return null
  }

  return res.json()
}
