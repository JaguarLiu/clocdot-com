import { useTranslation } from 'react-i18next'
import { getDayName } from '../../utils/time.js'
import './ClassicClock.css'

// 經典打卡機：插卡動畫是簽名時刻（見 DESIGN.md 5.3）。打卡反應 (reaction) 不適用，忽略。
export default function ClassicClock({ isClockedIn, isPunching, currentTime, empNo, onClick, hint, stamp }) {
  const { t, i18n } = useTranslation()

  return (
    <button
      className="punch-clock-machine"
      type="button"
      onClick={onClick}
      disabled={isPunching}
      aria-busy={isPunching}
      aria-label={isPunching ? t('common.submitting') : hint}
    >
      <span className="punch-clock-ground" aria-hidden="true" />
      <span className="punch-clock-housing">
        <span className="punch-clock-back" aria-hidden="true" />
        <span className="punch-clock-side" aria-hidden="true" />
        <span className="punch-clock-top" aria-hidden="true" />
        <span className="punch-clock-slot" aria-hidden="true" />
        <span className="punch-clock-card-window" aria-hidden="true">
          <span className="punch-clock-card">
            <span className="punch-clock-card-title">ATTENDANCE</span>
            <span className="punch-clock-card-id">ID: {empNo || '--------'}</span>
            <span className="punch-clock-card-lines" />
            {stamp && <span className="punch-clock-stamp">{stamp} ✓</span>}
          </span>
        </span>
        <span className="punch-clock-front">
          <span className="punch-clock-vents" aria-hidden="true"><i /><i /><i /></span>
          <span className="punch-clock-display">
            <span className="punch-clock-time">
              <span>{String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}</span>
              <span className="punch-clock-seconds">{String(currentTime.getSeconds()).padStart(2, '0')}</span>
            </span>
            <span className="punch-clock-action" role="status">
              {isPunching ? t('common.submitting') : t(isClockedIn ? 'attendance.clockOutEn' : 'attendance.clockInEn')}
            </span>
            <span className="punch-clock-date">
              {currentTime.getFullYear()}.{currentTime.getMonth() + 1}.{currentTime.getDate()} {getDayName(currentTime, i18n.resolvedLanguage)}
            </span>
          </span>
          <span className="punch-clock-red-button" aria-hidden="true" />
        </span>
      </span>
    </button>
  )
}
