import { useCallback, useSyncExternalStore } from 'react'
import { getClockStyle } from '../components/clocks/index.js'

// 打卡鐘樣式是裝置偏好（同語言設定），存 localStorage。
export const CLOCK_STYLE_KEY = 'clocdot_clock_style'

const listeners = new Set()

function read() {
  try {
    return localStorage.getItem(CLOCK_STYLE_KEY)
  } catch {
    // 隱私模式等環境拿不到 storage → 用預設樣式
    return null
  }
}

function subscribe(callback) {
  listeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

export function useClockStyle() {
  const stored = useSyncExternalStore(subscribe, read, () => null)
  const setClockStyle = useCallback((id) => {
    try {
      localStorage.setItem(CLOCK_STYLE_KEY, id)
    } catch {
      // 寫不進去就只在這次不生效，不影響打卡
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [getClockStyle(stored), setClockStyle]
}
