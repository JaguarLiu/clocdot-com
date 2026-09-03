import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, X } from 'lucide-react'
import PaperPiece from './PaperPiece.jsx'
import MarkerButton from './MarkerButton.jsx'

const variants = {
  danger:  { accent: 'red',     Icon: AlertTriangle },
  warning: { accent: 'amber',   Icon: AlertTriangle },
  info:    { accent: 'sky',     Icon: AlertTriangle },
}

const accentMap = {
  red:   { icon: 'bg-red-500',     marker: '#ef4444', text: 'text-red-500' },
  amber: { icon: 'bg-amber-500',   marker: '#f59e0b', text: 'text-amber-600' },
  sky:   { icon: 'bg-sky-500',     marker: '#0ea5e9', text: 'text-sky-600' },
}

export default function ConfirmDialog({
  open,
  variant = 'danger',
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape' && !loading) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const v = variants[variant] ?? variants.danger
  const acc = accentMap[v.accent]
  const Icon = v.Icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* 桌面 backdrop — 米色霧面，不用黑色，才對得上紙張氛圍 */}
      <button
        type="button"
        aria-label={t('common.close')}
        tabIndex={-1}
        onClick={() => !loading && onCancel?.()}
        className="absolute inset-0 bg-[#1c1810]/20 backdrop-blur-[2px] cursor-default"
      />

      <PaperPiece
        color="#fdfbf4"
        rotate="-0.4deg"
        variant="card"
        className="relative w-full max-w-md p-7 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-4 mb-5">
          <div
            className={`${acc.icon} p-2.5 rounded-lg shadow-sm shrink-0`}
            style={{ transform: 'rotate(-4deg)' }}
          >
            <Icon size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="font-zh text-lg text-slate-800">{title ?? t('confirm.defaultTitle')}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
              {t('confirm.eyebrow')}
            </p>
          </div>
        </div>

        {message && (
          <div
            className="mb-6 pl-4 border-l-2 border-dashed border-slate-200"
            style={{ marginLeft: '2px' }}
          >
            <p className="font-zh text-sm text-slate-600 leading-relaxed">{message}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <MarkerButton
            color="#94a3b8"
            rotate="0.6deg"
            onClick={onCancel}
            disabled={loading}
          >
            <X size={14} strokeWidth={3} />
            {cancelLabel ?? t('common.cancel')}
          </MarkerButton>
          <MarkerButton
            color={acc.marker}
            rotate="-0.6deg"
            onClick={onConfirm}
            disabled={loading}
          >
            <Check size={14} strokeWidth={3} />
            {loading ? t('common.processing') : (confirmLabel ?? t('common.confirm'))}
          </MarkerButton>
        </div>
      </PaperPiece>
    </div>
  )
}
