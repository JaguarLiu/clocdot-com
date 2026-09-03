import i18n from '../i18n/index.js'

// optional chaining：Vite 建置時會注入 import.meta.env，但在 node --test 下不存在
const API_BASE = import.meta.env?.VITE_API_BASE || '/api'

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

  let res
  try {
    res = await fetch(url, config)
  } catch (err) {
    // fetch 在「DNS 失敗 / TCP 連不到 / TLS 失敗 / 離線」時會 throw TypeError
    // 把它標成可辨識的網路錯誤，呼叫端可分辨「離線」vs「server 4xx/5xx」
    const networkError = new Error('NETWORK_ERROR')
    networkError.isNetworkError = true
    networkError.cause = err
    throw networkError
  }
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

export function punchIn({ lat, lng, clientTime } = {}) {
  return request('/punch-in', {
    method: 'POST',
    body: JSON.stringify({ lat, lng, clientTime }),
  })
}

export function punchOut({ lat, lng, clientTime } = {}) {
  return request('/punch-out', {
    method: 'POST',
    body: JSON.stringify({ lat, lng, clientTime }),
  })
}

export function getAttendanceRecords(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/attendance?${query}`)
}

export function submitCorrectionRequest({ workDate, time, type, reason }) {
  return request('/correction-requests', {
    method: 'POST',
    body: JSON.stringify({ workDate, time, type, reason }),
  })
}

export function submitLeaveRequest({ leaveType, startDate, startTime, endDate, endTime, reason }) {
  return request('/leave-requests', {
    method: 'POST',
    body: JSON.stringify({ leaveType, startDate, startTime, endDate, endTime, reason }),
  })
}

export function getLeaveRequests() {
  return request('/leave-requests')
}

export function cancelLeaveRequest(id) {
  return request(`/leave-requests/${id}`, { method: 'DELETE' })
}

export function requestLeaveCancellation(id, cancelReason) {
  return request(`/leave-requests/${id}/cancel-request`, {
    method: 'POST',
    body: JSON.stringify({ cancelReason }),
  })
}

export function getLeaveCalendar(from, to) {
  return request(`/leave-calendar?from=${from}&to=${to}`)
}

export function getHolidays(from, to) {
  return request(`/holidays?from=${from}&to=${to}`)
}

export function getOvertimePending() {
  return request('/overtime/pending')
}

export function submitOvertimeRequest({ workDate, requestedMinutes, reason }) {
  return request('/overtime-requests', {
    method: 'POST',
    body: JSON.stringify({ workDate, requestedMinutes, reason }),
  })
}

export function getOvertimeRequests() {
  return request('/overtime-requests')
}

export function getMyOvertimeCompliance() {
  return request('/overtime/compliance')
}

export function getMyPayslipMonths() {
  return request('/payroll/me')
}

export function getMyPayslip(month) {
  return request(`/payroll/me/${month}`)
}

export function getPendingApprovals() {
  return request('/approvals/pending')
}

export function decideApproval(stepId, { decision, note, confirm } = {}) {
  return request(`/approvals/${stepId}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, note, confirm }),
  })
}

export function getMySchedule(from, to) {
  return request(`/attendance/schedule?from=${from}&to=${to}`)
}

export const fetcher = (url) => request(url)
