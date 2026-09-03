import { User, Hand } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDayName } from '../utils/time.js'

export default function PunchButton({ isClockedIn, isPunching, currentTime, empNo, onClick }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      {/* 打卡鐘互動容器 */}
      <div
        className="relative w-52 h-64 flex flex-col items-center justify-end cursor-pointer group"
        onClick={onClick}
      >
        {/* 1. 卡片層 */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-24 h-36 bg-white border-2 border-slate-200 shadow-sm transition-all duration-700 ease-in-out
            ${isPunching ? 'translate-y-40 opacity-0' : 'translate-y-0 opacity-100'}`}
          style={{
            borderRadius: '4px',
            top: '-24px',
            zIndex: '5',
          }}
        >
          <div className="p-3">
            <div className="h-1 w-1/2 bg-slate-100 mb-2" />
            <div className="h-0.5 w-full bg-slate-50 mb-1" />
            <div className="h-0.5 w-full bg-slate-50 mb-1" />
            <div className="mt-6 text-center">
              <User size={20} className="mx-auto text-slate-200" />
              <p className="text-[7px] font-black text-slate-400 uppercase mt-2 tracking-widest">
                ID: {empNo || '--------'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. 打卡鐘機器本體 */}
        <div
          className={`relative w-full h-44 border-4 transition-colors duration-500 shadow-xl flex flex-col items-center justify-center z-10 overflow-hidden
            ${isClockedIn ? 'bg-orange-500 border-orange-700' : 'bg-emerald-500 border-emerald-700'}`}
          style={{
            borderRadius: '32px 32px 10px 10px/16px 16px 5px 5px',
            boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.2), 0 10px 20px rgba(0,0,0,0.1)',
          }}
        >
          {/* 插卡口 */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-slate-900 shadow-inner z-20"
            style={{ borderRadius: '0 0 6px 6px' }}
          />

          <div className="relative flex flex-col items-center z-10">
            {/* 即時時間 */}
            <div className="text-4xl font-black text-white tracking-tighter tabular-nums drop-shadow-md mb-1">
              {currentTime.getHours().toString().padStart(2, '0')}:
              {currentTime.getMinutes().toString().padStart(2, '0')}
              <span className="text-lg text-white/50 ml-1 font-bold">
                {currentTime.getSeconds().toString().padStart(2, '0')}
              </span>
            </div>

            {/* 狀態文字 */}
            <span className="text-base font-black text-white/90 tracking-[0.15em] uppercase mb-1">
              {isClockedIn ? t('attendance.clockOutEn') : t('attendance.clockInEn')}
            </span>

            {/* 即時日期 */}
            <div className="text-[10px] font-black text-white/70 uppercase tracking-widest">
              {currentTime.getFullYear()}.{currentTime.getMonth() + 1}.{currentTime.getDate()} {getDayName(currentTime, i18n.resolvedLanguage)}
            </div>
          </div>
        </div>
      </div>

      {/* 點擊操作提示 */}
      {!isPunching && (
        <div className="mt-5 flex flex-col items-center gap-1 animate-soft-bounce">
          <Hand size={16} className="text-slate-400" strokeWidth={2.5} />
          <p className="font-zh text-[13px] text-slate-500">
            {isClockedIn ? t('attendance.tapHintOut') : t('attendance.tapHintIn')}
          </p>
        </div>
      )}
    </>
  )
}
