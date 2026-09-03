import i18n from '../i18n/index.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const config = {
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      // server 依此標頭決定錯誤訊息語言（見 server/src/plugins/i18n.js）
      'Accept-Language': i18n.resolvedLanguage || 'zh-TW',
      ...options.headers,
    },
    ...options,
  }

  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, config)
  if (!res.ok) {
    const error = new Error('API request failed')
    error.status = res.status
    const info = await res.json().catch(() => null)
    error.info = info
    error.message = info?.error || info?.message || 'API request failed'
    throw error
  }
  return res.json()
}

export function getAdminAttendanceList(month) {
  return request(`/admin/attendance?month=${month}`)
}

export function getAdminYearlyAttendance(year) {
  return request(`/admin/attendance/yearly?year=${year}`)
}

export async function downloadAttendanceCSV(month) {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${API_BASE}/admin/attendance/export?month=${month}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const info = await res.json().catch(() => null)
    throw new Error(info?.error || i18n.t('common.errExportFailed'))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attendance-${month}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function reviewCorrectionRequest(requestId, status) {
  return request(`/admin/correction-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function getCorrectionRequests(status) {
  const query = status ? `?status=${status}` : ''
  return request(`/admin/correction-requests${query}`)
}

export function getLeaveRequests(status) {
  const query = status ? `?status=${status}` : ''
  return request(`/admin/leave-requests${query}`)
}

export function reviewLeaveRequest(requestId, status, reviewNote) {
  return request(`/admin/leave-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reviewNote }),
  })
}

export function decideLeaveCancellation(requestId, action, reviewNote) {
  // action: 'confirm-cancel' | 'reject-cancel'
  return request(`/admin/leave-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, reviewNote }),
  })
}

export function getLeaveCalendar(from, to) {
  return request(`/admin/leave-calendar?from=${from}&to=${to}`)
}

export function getHolidays(from, to) {
  return request(`/holidays?from=${from}&to=${to}`)
}

export function updateCompany(payload) {
  return request('/admin/company', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getMyIp() {
  return request('/admin/my-ip')
}

export function updateLeavePolicies(policies) {
  return request('/admin/leave-policies', {
    method: 'PUT',
    body: JSON.stringify({ policies }),
  })
}

export function getUserLeaveBalances(userId) {
  return request(`/admin/users/${userId}/leave-balances`)
}

export function createCompanyLocation(payload) {
  return request('/admin/company-locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCompanyLocation(id, payload) {
  return request(`/admin/company-locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCompanyLocation(id) {
  return request(`/admin/company-locations/${id}`, { method: 'DELETE' })
}

export function createUser(payload) {
  return request('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function previewUserImport(rows) {
  return request('/admin/users/import/preview', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

export function commitUserImport(rows) {
  return request('/admin/users/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

export function updateUser(id, payload) {
  return request(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteUser(id) {
  return request(`/admin/users/${id}`, { method: 'DELETE' })
}

export function unlockUser(id) {
  return request(`/admin/users/${id}/unlock`, { method: 'POST' })
}

export function setUserPassword(id, password) {
  return request(`/admin/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  })
}

export function getSalaryProfile(userId) {
  return request(`/admin/users/${userId}/salary-profile`)
}

export function saveSalaryProfile(userId, payload) {
  return request(`/admin/users/${userId}/salary-profile`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getSalaryProfiles() {
  return request('/admin/salary-profiles')
}

export function getDepartments() {
  return request('/admin/departments')
}

export function createDepartment(payload) {
  return request('/admin/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateDepartment(id, payload) {
  return request(`/admin/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteDepartment(id) {
  return request(`/admin/departments/${id}`, { method: 'DELETE' })
}

export function getDepartmentRoles(deptId) {
  return request(`/admin/departments/${deptId}/roles`)
}

export function createDepartmentRole(deptId, payload) {
  return request(`/admin/departments/${deptId}/roles`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateRole(id, payload) {
  return request(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteRole(id) {
  return request(`/admin/roles/${id}`, { method: 'DELETE' })
}

export function createIssue(payload) {
  return request('/admin/issues', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getOvertimeRequests(status) {
  const query = status ? `?status=${status}` : ''
  return request(`/admin/overtime-requests${query}`)
}

export function reviewOvertimeRequest(requestId, status, confirm = false) {
  return request(`/admin/overtime-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, confirm }),
  })
}

export function getSettlement(month) {
  return request(`/admin/settlement?month=${month}`)
}

export async function downloadSettlementCSV(month) {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${API_BASE}/admin/settlement/export?month=${month}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const info = await res.json().catch(() => null)
    throw new Error(info?.error || i18n.t('common.errExportFailed'))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `settlement-${month}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function getPayrollRuns() {
  return request('/admin/payroll-runs')
}

export function getPayrollRun(month) {
  return request(`/admin/payroll-runs/${month}`)
}

export function generatePayrollRun(month) {
  return request('/admin/payroll-runs', { method: 'POST', body: JSON.stringify({ month }) })
}

export function savePayrollAdjustments(month, userId, adjustments) {
  return request(`/admin/payroll-runs/${month}/items/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ adjustments }),
  })
}

export function cashoutPayroll(month, userIds) {
  return request(`/admin/payroll-runs/${month}/cashout`, {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  })
}

export function lockPayrollRun(month) {
  return request(`/admin/payroll-runs/${month}/lock`, { method: 'POST' })
}

export function unlockPayrollRun(month) {
  return request(`/admin/payroll-runs/${month}/unlock`, { method: 'POST' })
}

export async function downloadPayrollCSV(month) {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${API_BASE}/admin/payroll-runs/${month}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const info = await res.json().catch(() => null)
    throw new Error(info?.error || i18n.t('common.errExportFailed'))
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payroll-${month}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function getShifts() {
  return request('/admin/shifts')
}

export function createShift(payload) {
  return request('/admin/shifts', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateShift(id, payload) {
  return request(`/admin/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteShift(id) {
  return request(`/admin/shifts/${id}`, { method: 'DELETE' })
}

export function getSchedule(month, departmentId) {
  const q = departmentId ? `&departmentId=${departmentId}` : ''
  return request(`/admin/schedule?month=${month}${q}`)
}

export function saveScheduleAssignments(changes, { confirm = false } = {}) {
  return request('/admin/schedule/assignments', {
    method: 'PUT',
    body: JSON.stringify({ changes, ...(confirm ? { confirm: true } : {}) }),
  })
}

export const fetcher = (url) => request(url)
