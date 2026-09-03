import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import PunchButton from '../components/PunchButton.jsx'
import AttendanceCard from '../components/AttendanceCard.jsx'
import PaperToast from '../components/PaperToast.jsx'
import PaperPiece from '../components/PaperPiece.jsx'
import { useAttendance, useTodayRequired } from '../hooks/useAttendance.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { MapPin, WifiOff, CloudUpload, CalendarClock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { getCurrentCoords, getCurrentCoordsAccurate, geoErrorMessage } from '../utils/geolocation.js'
import { enqueuePunch, queueSize, replayQueue } from '../services/offlineQueue.js'
import { punchIn as apiPunchIn, punchOut as apiPunchOut, fetcher } from '../services/api.js'
import { formatShiftRange } from '../utils/shiftTime.js'
import { weekdayShortNamesMondayFirst } from '../utils/time.js'
import useSWR from 'swr'

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function Attendance() {
  const { t, i18n } = useTranslation()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isPunching, setIsPunching] = useState(false)
  const [toast, setToast] = useState(null)
  const [pendingCount, setPendingCount] = useState(() => queueSize())
  const { todayRecord, isLoading, clockIn, clockOut, refresh } = useAttendance()
  const { onsiteRequired, wifiCheckinEnabled } = useTodayRequired()
  const { user } = useAuth()
  const isOnline = useOnlineStatus()

  // 本週（一～日）班表（裝置當地日期即可 — 與打卡 workDate 同基準）；正常班員工不顯示班表（不發請求）
  const showSchedule = Boolean(user) && user.employmentType !== 'regular'
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7 // 週一為 0
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(today)
    wd.setDate(today.getDate() - mondayOffset + i)
    return `${wd.getFullYear()}-${String(wd.getMonth() + 1).padStart(2, '0')}-${String(wd.getDate()).padStart(2, '0')}`
  })
  const todayStr = weekDates[mondayOffset]
  const { data: weekSchedule } = useSWR(
    showSchedule ? `/attendance/schedule?from=${weekDates[0]}&to=${weekDates[6]}` : null,
    fetcher,
  )
  const todayShift = weekSchedule?.find((s) => s.date === todayStr)?.shift ?? null
  const weekNames = weekdayShortNamesMondayFirst(i18n.resolvedLanguage)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 上線時 / 第一次掛載時 → 嘗試把離線佇列送出
  const trySync = useCallback(async () => {
    if (queueSize() === 0) return
    const result = await replayQueue(async (entry) => {
      const fn = entry.action === 'in' ? apiPunchIn : apiPunchOut
      await fn({ lat: entry.lat, lng: entry.lng, clientTime: entry.clientTime })
    })
    setPendingCount(queueSize())
    if (result.sent > 0) {
      setToast({ variant: 'success', message: t('attendance.syncedOffline', { count: result.sent }) })
      refresh()
    } else if (result.dropped > 0) {
      setToast({ variant: 'error', message: t('attendance.droppedOffline', { count: result.dropped }) })
      refresh()
    }
  }, [refresh, t])

  useEffect(() => {
    if (!isOnline) return
    // setState 都在 trySync 內 await 之後發生 (非同步續執)，不會造成 cascading renders
    // eslint-disable-next-line react-hooks/set-state-in-effect
    trySync()
  }, [isOnline, trySync])

  const hasPunchedIn = Boolean(todayRecord?.punchIn)
  // 只要已打上班卡，隨時可以再打下班卡覆蓋下班時間（後端限制新時間不能早於舊的）
  const isClockedIn = hasPunchedIn

  const isLate = Boolean(todayRecord?.isLate)
  const isEarlyLeave = Boolean(todayRecord?.isEarlyLeave)

  const history = []
  if (todayRecord?.punchOut) {
    history.push({
      id: 'out',
      type: 'out',
      time: formatTime(todayRecord.punchOut),
      note: isEarlyLeave ? t('attendance.noteEarlyLeave') : t('attendance.notePunctualOut'),
      borderColor: '#f97316',
      isAlert: isEarlyLeave,
      rotate: '-1.5deg',
      locationType: todayRecord.punchOutLocationType,
    })
  }
  if (todayRecord?.punchIn) {
    history.push({
      id: 'in',
      type: 'in',
      time: formatTime(todayRecord.punchIn),
      note: isLate ? t('attendance.noteLate') : t('attendance.notePunctualIn'),
      borderColor: '#fbbf24',
      isAlert: isLate,
      rotate: '1.2deg',
      locationType: todayRecord.punchInLocationType,
    })
  }

  async function doPunch(action) {
    if (isPunching) return
    setIsPunching(true)

    try {
      // 離線 + onsite 必到 → 直接擋 (Q1 答案 B)
      // 因為無法在離線時驗證使用者真的在公司範圍內
      if (!isOnline && onsiteRequired) {
        setToast({ variant: 'error', message: t('attendance.errOfflineOnsite') })
        setIsPunching(false)
        return
      }

      // onsite 必到日（GPS 模式）→ 高精度 + 不吃 cache + 拿不到就提早擋下不送 API
      // WiFi 模式 → server 只看 IP，GPS 僅參考，沿用低耗電版
      // 一般日 → 沿用低耗電版，拿不到不影響打卡
      const gpsGate = onsiteRequired && !wifiCheckinEnabled
      const geoPromise = gpsGate ? getCurrentCoordsAccurate() : getCurrentCoords()
      const [geo] = await Promise.all([
        geoPromise,
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])

      const coords = gpsGate ? geo?.coords : geo
      const geoError = gpsGate ? geo?.error : null

      if (gpsGate && !coords) {
        setToast({ variant: 'error', message: geoErrorMessage(t, geoError) })
        setIsPunching(false)
        return
      }

      const lat = coords?.lat ?? null
      const lng = coords?.lng ?? null

      // 離線 (此分支必為非 onsite 日) → 進佇列
      if (!isOnline) {
        enqueuePunch({ action, lat, lng })
        setPendingCount(queueSize())
        setToast({
          variant: 'success',
          message: action === 'in'
            ? t('attendance.queuedOfflineIn', { time: formatTime(new Date()) })
            : t('attendance.queuedOfflineOut', { time: formatTime(new Date()) }),
        })
        return
      }

      try {
        if (action === 'out') {
          await clockOut({ lat, lng })
        } else {
          await clockIn({ lat, lng })
        }
      } catch (err) {
        // fetch throw NETWORK_ERROR (例如 Wi-Fi 假連線) → 退到 offline 路徑
        if (err?.isNetworkError && !onsiteRequired) {
          enqueuePunch({ action, lat, lng })
          setPendingCount(queueSize())
          setToast({
            variant: 'success',
            message: action === 'in'
              ? t('attendance.queuedFlakyIn')
              : t('attendance.queuedFlakyOut'),
          })
          return
        }
        throw err
      }
    } catch (err) {
      const msg = err?.info?.error || err?.info?.message || err?.message || t('attendance.errPunchFailed')
      setToast({ variant: 'error', message: msg })
    } finally {
      setIsPunching(false)
    }
  }

  function handleClockAction() {
    doPunch(hasPunchedIn ? 'out' : 'in')
  }

  return (
    <div className="animate-in fade-in zoom-in duration-300">
      {toast && (
        <PaperToast
          variant={toast.variant}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 -mb-2 px-4">
        {todayShift && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-2 border-dashed border-emerald-300 text-emerald-700"
            style={{ transform: 'rotate(-0.6deg)', borderRadius: '10px 4px 12px 3px/3px 12px 4px 10px' }}
          >
            <CalendarClock size={12} strokeWidth={3} />
            <span className="font-zh text-[11px]">{todayShift.name} {formatShiftRange(todayShift)}</span>
          </div>
        )}
        {onsiteRequired && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border-2 border-dashed border-orange-300 text-orange-700"
            style={{ transform: 'rotate(-1.5deg)', borderRadius: '10px 3px 12px 4px/4px 12px 3px 10px' }}
          >
            <MapPin size={12} strokeWidth={3} />
            <span className="font-zh text-[11px]">{t('attendance.onsiteRequired')}</span>
          </div>
        )}
        {!isOnline && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border-2 border-dashed border-slate-400 text-slate-600"
            style={{ transform: 'rotate(1.2deg)', borderRadius: '12px 4px 10px 3px/3px 10px 4px 12px' }}
          >
            <WifiOff size={12} strokeWidth={3} />
            <span className="font-zh text-[11px]">{t('attendance.offline')}</span>
          </div>
        )}
        {pendingCount > 0 && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border-2 border-dashed border-sky-300 text-sky-700"
            style={{ transform: 'rotate(-0.8deg)', borderRadius: '8px 12px 4px 10px/10px 4px 12px 8px' }}
          >
            <CloudUpload size={12} strokeWidth={3} />
            <span className="font-zh text-[11px]">{t('attendance.pendingSync', { count: pendingCount })}</span>
          </div>
        )}
      </div>

      <section className="relative flex flex-col items-center justify-center py-12 w-full z-10">
        <PunchButton
          isClockedIn={isClockedIn}
          isPunching={isPunching}
          currentTime={currentTime}
          empNo={user?.empNo}
          onClick={handleClockAction}
        />
      </section>

      {/* 今日動態 */}
      <div className="mt-4 px-2 pb-10">
        <div className="flex items-center gap-2 mb-6 px-4">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <h3 className="font-black text-slate-500 text-xs uppercase tracking-[0.2em]">{t('attendance.todayActivity')}</h3>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 text-xs py-8 font-zh">{t('common.loading')}</p>
        ) : history.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-8 font-zh">{t('attendance.noRecordToday')}</p>
        ) : (
          <div className="flex flex-col items-center">
            {history.map((item) => (
              <AttendanceCard
                key={item.id}
                type={item.type}
                time={item.time}
                note={item.note}
                borderColor={item.borderColor}
                isAlert={item.isAlert}
                rotate={item.rotate}
                locationType={item.locationType}
              />
            ))}
          </div>
        )}

        {/* 我的班表（正常班員工不顯示） */}
        {weekSchedule && weekSchedule.some((s) => s.shift) && (
          <PaperPiece color="white" rotate="0.7deg" className="p-5 mx-2 mt-8">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock size={16} className="text-emerald-500" />
              <h3 className="font-black text-slate-500 text-xs uppercase tracking-[0.2em]">{t('attendance.myScheduleEn')}</h3>
              {t('attendance.mySchedule') && (
                <span className="font-zh text-xs text-slate-400">{t('attendance.mySchedule')}</span>
              )}
            </div>
            <div className="space-y-1.5">
              {weekSchedule.map((s, i) => {
                const isToday = s.date === todayStr
                return (
                  <div
                    key={s.date}
                    className={`flex items-center justify-between px-3 py-1.5 ${isToday ? 'bg-emerald-50 border border-emerald-200' : ''}`}
                    style={isToday ? { borderRadius: '8px 3px 9px 4px/4px 9px 3px 8px' } : undefined}
                  >
                    <span className={`font-zh text-xs ${isToday ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {weekNames[i]} <span className="font-mono text-[10px] text-slate-400">{s.date.slice(5)}</span>
                    </span>
                    {s.shift ? (
                      <span className={`font-mono font-black text-xs tabular-nums ${isToday ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {s.shift.name}・{formatShiftRange(s.shift)}
                        {s.source === 'assignment' && <span className="font-zh font-normal text-[9px] text-amber-600 ml-1">{t('attendance.assigned')}</span>}
                      </span>
                    ) : (
                      <span className="font-zh text-xs text-slate-400">{t('attendance.noShift')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </PaperPiece>
        )}
      </div>
    </div>
  )
}
