import { useTranslation } from 'react-i18next'
import { useClockStyle } from '../hooks/useClockStyle.js'

// 依使用者在 Profile 選的樣式渲染打卡鐘（見 components/clocks/index.js）。
export default function PunchButton({ isClockedIn, isPunching, currentTime, empNo, onClick, punchIn, punchOut, reaction }) {
  const { t } = useTranslation()
  const [clockStyle] = useClockStyle()
  const Clock = clockStyle.Component
  // 畫面上不顯示，只當打卡鐘按鈕的 aria-label
  const hint = isClockedIn ? t('attendance.tapHintOut') : t('attendance.tapHintIn')
  // Only server-backed attendance data supplies the stamp, never animation timing.
  const lastPunch = punchOut || punchIn
  const lastTime = lastPunch ? new Date(lastPunch) : null
  const stamp = lastTime
    ? `${t(punchOut ? 'attendance.punchOut' : 'attendance.punchIn')} ${String(lastTime.getHours()).padStart(2, '0')}:${String(lastTime.getMinutes()).padStart(2, '0')}`
    : null

  return (
    <Clock
      isClockedIn={isClockedIn}
      isPunching={isPunching}
      currentTime={currentTime}
      empNo={empNo}
      onClick={onClick}
      hint={hint}
      stamp={stamp}
      reaction={reaction}
    />
  )
}
