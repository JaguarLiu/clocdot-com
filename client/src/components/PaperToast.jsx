import { useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'

const variantStyles = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    icon: Check,
    iconColor: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-500',
    icon: AlertCircle,
    iconColor: 'text-red-400',
  },
}

export default function PaperToast({ variant = 'success', message, onDismiss, duration = 1800 }) {
  useEffect(() => {
    if (!onDismiss) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  const style = variantStyles[variant] ?? variantStyles.success
  const Icon = style.icon

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
      role="status"
      aria-live="polite"
    >
      <div
        className={`relative ${style.bg} ${style.border} border-2 shadow-lg px-5 py-3 flex items-center gap-3`}
        style={{
          transform: 'rotate(-1.5deg)',
          borderRadius: '18px 4px 20px 6px/4px 20px 6px 18px',
          boxShadow: '3px 4px 10px rgba(0,0,0,0.08)',
        }}
      >
        {/* 頂部膠帶 */}
        <div
         className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-white/50 border border-white/30 backdrop-blur-[1px]"
         style={{ transform: 'rotate(-4deg)', boxShadow: '1px 1px 2px rgba(0,0,0,0.04)' }}
        />
        <Icon size={18} className={style.iconColor} strokeWidth={3} />
        <span className={`font-zh text-sm ${style.text}`}>{message}</span>
      </div>
    </div>
  )
}
