import ClassicClock from './ClassicClock.jsx'
import PuppyClock from './PuppyClock.jsx'

/**
 * 打卡鐘樣式登錄表。新增樣式：做一個吃同一組 props 的元件
 * （isClockedIn / isPunching / currentTime / empNo / onClick / hint / stamp / reaction），
 * 再在這裡加一筆；/clock-style 頁、Profile 入口列與 PunchButton 都從這裡讀。
 * preview 為選擇器與目前樣式展示用的圖片（放 public/）。第一筆是預設樣式。
 */
export const CLOCK_STYLES = [
  { id: 'classic', labelKey: 'clockStyle.classic', Component: ClassicClock, preview: '/logo.png' },
  { id: 'puppy', labelKey: 'clockStyle.puppy', Component: PuppyClock, preview: '/puppy/puppy.png' },
]

export function getClockStyle(id) {
  return CLOCK_STYLES.find((style) => style.id === id) ?? CLOCK_STYLES[0]
}
