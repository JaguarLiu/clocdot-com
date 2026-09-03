// Google Maps Geocoding API — 台灣地址準度高，但需要 API key + 啟用帳單
//   https://developers.google.com/maps/documentation/geocoding/overview
//
// 環境變數：
//   GOOGLE_MAPS_API_KEY — 必填，未設會在呼叫時拋錯
//
// rate-limit (每公司 30 分鐘最多一次) 由呼叫端 (routes/admin.js) 處理，
// 這支只負責呼叫 Google API。之後要換 Nominatim / Mapbox 只動這支 util

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY 未設定')
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
    language: 'zh-TW',
    region: 'tw',
  })
  const res = await fetch(`${ENDPOINT}?${params.toString()}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.log('Geocoding HTTP error:', res.status, body)
    throw new Error(`Geocoding failed (${res.status})`)
  }

  const data = await res.json()
  console.log('Geocoding result:', data.status, data.results?.[0]?.formatted_address)

  if (data.status === 'ZERO_RESULTS') {
    return null
  }
  if (data.status !== 'OK') {
    console.log('Geocoding API error:', data.status, data.error_message)
    throw new Error(`Geocoding failed (${data.status}${data.error_message ? `: ${data.error_message}` : ''})`)
  }

  const loc = data.results?.[0]?.geometry?.location
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    return null
  }
  return { lat: loc.lat, lng: loc.lng }
}
