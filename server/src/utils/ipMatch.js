// IP / CIDR 比對 — WiFi 打卡驗證用
//
// - 允許清單每筆為單一 IP 或 CIDR 網段 (IPv4 / IPv6)
// - request.ip 在 dual-stack 下可能是 IPv4-mapped IPv6 (::ffff:1.2.3.4)，
//   用 ipaddr.process() 正規化成 IPv4 再比對

import ipaddr from 'ipaddr.js'

/**
 * 字串是否為合法的單一 IP 或 CIDR 網段
 * @param {unknown} str
 * @returns {boolean}
 */
export function isValidIpOrCidr(str) {
  if (typeof str !== 'string') return false
  const s = str.trim()
  if (!s) return false
  try {
    if (s.includes('/')) {
      ipaddr.parseCIDR(s)
    } else {
      ipaddr.parse(s)
    }
    return true
  } catch {
    return false
  }
}

/**
 * ip 是否命中允許清單（任一筆命中即 true；清單內壞資料跳過）
 * @param {unknown} ip
 * @param {unknown} allowedList string[] — 單一 IP 或 CIDR
 * @returns {boolean}
 */
export function isIpAllowed(ip, allowedList) {
  if (typeof ip !== 'string' || !Array.isArray(allowedList)) return false
  let addr
  try {
    addr = ipaddr.process(ip.trim()) // parse + IPv4-mapped IPv6 → IPv4
  } catch {
    return false
  }
  return allowedList.some((entry) => {
    if (typeof entry !== 'string') return false
    const s = entry.trim()
    if (!s) return false
    try {
      if (s.includes('/')) {
        const [range, bits] = ipaddr.parseCIDR(s)
        if (range.kind() !== addr.kind()) return false
        return addr.match([range, bits])
      }
      const target = ipaddr.process(s)
      if (target.kind() !== addr.kind()) return false
      return addr.toNormalizedString() === target.toNormalizedString()
    } catch {
      return false
    }
  })
}
