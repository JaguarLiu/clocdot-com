import { useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'

const variants = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: Check, iconColor: 'text-emerald-500' },
  error:   { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-500', icon: AlertCircle, iconColor: 'text-red-400' },
}

export default function PaperToast({ variant = 'success', message, onDismiss, duration = 1800 }) {
  useEffect(() => {
    if (!onDismiss) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  const s = variants[variant] ?? variants.success
  const Icon = s.icon

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 right-6 z-[60] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div
        className={`relative ${s.bg} ${s.border} border-2 shadow-lg px-5 py-3 flex items-center gap-3`}
        style={{
          transform: 'rotate(-1.2deg)',
          borderRadius: '18px 4px 20px 6px/4px 20px 6px 18px',
          boxShadow: '3px 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-white/60 border border-white/30 backdrop-blur-[1px]"
          style={{ transform: 'rotate(-4deg)' }}
        />
        <Icon size={18} className={s.iconColor} strokeWidth={3} />
        <span className={`font-zh text-sm ${s.text}`}>{message}</span>
      </div>
    </div>
  )
}
