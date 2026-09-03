// onsite 必到日的打卡守門：
//   - 未啟用 WiFi 打卡 → 沿用 GPS geofence (locationType === office)
//   - 啟用 WiFi 打卡   → 只看來源 IP 是否命中 allowedIps，GPS 不作數
// 例外：今天已被排准的請假覆蓋 (attendance.leaveType 有值) 則豁免

import { LOCATION_TYPE } from '../utils/geofence.js'
import { isOnsiteRequired } from './onsiteSchedule.js'
import { isIpAllowed } from '../utils/ipMatch.js'

/**
 * @param {object} p
 * @param {object} p.company Prisma Company row
 * @param {object|null} p.todayRecord 今日 attendance（可能只有 { workDate }）
 * @param {'office'|'remote'|'unknown'} p.locationType geofence 判定結果
 * @param {string|null} p.clientIp request.ip
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
export function buildOnsiteCheck({ company, todayRecord, locationType, clientIp }) {
  const required = isOnsiteRequired(
    todayRecord?.workDate ?? new Date(),
    company,
  )
  if (!required) return { ok: true }
  if (todayRecord?.leaveType) return { ok: true } // 請假豁免

  if (company?.wifiCheckinEnabled) {
    if (isIpAllowed(clientIp, company.allowedIps ?? [])) return { ok: true }
    return {
      ok: false,
      code: 'NOT_ON_COMPANY_WIFI',
      message: '不在辦公區域無法打卡',
    }
  }

  if (locationType === LOCATION_TYPE.OFFICE) return { ok: true }
  return {
    ok: false,
    code: 'NOT_AT_OFFICE',
    message: locationType === LOCATION_TYPE.UNKNOWN
      ? '今日需到公司打卡，請開啟定位後再試'
      : '你還未到公司，今日需在公司範圍內才能打卡',
  }
}
