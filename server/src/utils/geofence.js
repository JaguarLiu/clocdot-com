// 地理圍欄判定：打卡座標 → (office + locationId) / remote / unknown
//
// - 打卡時 client 可選附上 lat/lng
// - 與公司所有 CompanyLocation 比距離，第一個 ≤ radius 的視為 office
// - 都不符 → remote；沒送座標 → unknown
// - 不擋打卡，只標記；合規/HR 事後看月報彙總

const EARTH_RADIUS_METERS = 6371000

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * Haversine 距離 (公尺)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}

export const LOCATION_TYPE = {
  OFFICE: 'office',
  REMOTE: 'remote',
  UNKNOWN: 'unknown',
}

/**
 * @param {Array<{id,lat,lng,radius}>} locations
 * @param {number|null|undefined} lat
 * @param {number|null|undefined} lng
 * @returns {{locationId: string|null, locationType: 'office'|'remote'|'unknown'}}
 */
export function resolveLocation(locations, lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { locationId: null, locationType: LOCATION_TYPE.UNKNOWN }
  }
  for (const loc of locations || []) {
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') continue
    const distance = haversineDistance(lat, lng, loc.lat, loc.lng)
    if (distance <= (loc.radius ?? 100)) {
      return { locationId: loc.id, locationType: LOCATION_TYPE.OFFICE }
    }
  }
  return { locationId: null, locationType: LOCATION_TYPE.REMOTE }
}
