import useSWR from 'swr'
import { useEffect } from 'react'
import { fetcher, punchIn, punchOut } from '../services/api.js'

export function useAttendance() {
  const { data, error, isLoading, mutate } = useSWR('/attendance/today', fetcher, {
    refreshInterval: 10 * 60 * 1000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  // 頁面從背景回到前景時強制重新取得
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        mutate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [mutate])

  async function clockIn({ lat, lng, clientTime } = {}) {
    const result = await punchIn({ lat: lat ?? null, lng: lng ?? null, clientTime: clientTime ?? null })
    mutate(result, { revalidate: true })
    return result
  }

  async function clockOut({ lat, lng, clientTime } = {}) {
    const result = await punchOut({ lat: lat ?? null, lng: lng ?? null, clientTime: clientTime ?? null })
    mutate(result, { revalidate: true })
    return result
  }

  return {
    todayRecord: data ?? null,
    isLoading,
    error,
    clockIn,
    clockOut,
    refresh: mutate,
  }
}

// 今日是否需 onsite 打卡 (排班規則) — 給 UI 預先標示用，不擋送出
export function useTodayRequired() {
  const { data, error, isLoading } = useSWR('/attendance/today-required', fetcher, {
    refreshInterval: 30 * 60 * 1000,
    revalidateOnFocus: true,
  })
  return {
    onsiteRequired: Boolean(data?.onsiteRequired),
    wifiCheckinEnabled: Boolean(data?.wifiCheckinEnabled),
    locations: data?.locations ?? [],
    isLoading,
    error,
  }
}

export function useAttendanceHistory(params = {}) {
  const query = new URLSearchParams(params).toString()
  const { data, error, isLoading } = useSWR(`/attendance?${query}`, fetcher)

  return {
    records: data ?? [],
    isLoading,
    error,
  }
}
