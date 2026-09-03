import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, X, KeyRound } from 'lucide-react'
import { changePassword } from '../services/auth.js'
import PaperPiece from './PaperPiece.jsx'

export default function ChangePasswordModal({ open, onClose }) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 關閉時清空表單。這是刻意在 effect 內同步 setState（rule 針對的是 render 期串接渲染，
  // 此處只在 open 由 true→false 時觸發一次，且元件下一步就 return null）。
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
      setSuccess(false)
      setIsLoading(false)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('common.errFillAll'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('password.errTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('password.errMismatch'))
      return
    }
    if (newPassword === currentPassword) {
      setError(t('password.errSameAsCurrent'))
      return
    }

    setIsLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      setError(err.message || t('password.errFailed'))
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/40 backdrop-blur-sm">
      <PaperPiece color="white" rotate="-1.5deg" className="w-full max-w-md p-8 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center mb-7">
          <div
            className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3 shadow-sm"
            style={{ transform: 'rotate(-4deg)' }}
          >
            <KeyRound size={22} className="text-amber-600" strokeWidth={2.5} />
          </div>
          <h2 className="font-zh text-xl font-black text-slate-700">{t('password.title')}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
            {t('password.titleEn')}
          </p>
        </div>

        {success ? (
          <div className="px-4 py-6 bg-emerald-50 border-2 border-emerald-200 font-zh text-sm text-emerald-700 text-center"
               style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}>
            {t('password.success')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 bg-red-50 border-2 border-red-200 font-zh text-sm text-red-500 text-center"
                   style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}>
                {error}
              </div>
            )}

            <PasswordField
              label={t('password.current')}
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={isLoading}
              autoComplete="current-password"
            />
            <PasswordField
              label={t('password.new')}
              value={newPassword}
              onChange={setNewPassword}
              disabled={isLoading}
              autoComplete="new-password"
              hint={t('password.hintMinLength')}
            />
            <PasswordField
              label={t('password.confirm')}
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none mt-2"
            >
              <div className="absolute inset-0 bg-slate-800 translate-y-1 translate-x-1" />
              <div className="relative bg-slate-900 border-2 border-slate-800 p-4 flex items-center justify-center gap-3 group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 transition-transform">
                <span className="font-black text-[#f3f0e6] uppercase tracking-[0.25em] text-sm">
                  {isLoading ? t('password.updating') : t('password.update')}
                </span>
              </div>
            </button>
          </form>
        )}
      </PaperPiece>
    </div>
  )
}

function PasswordField({ label, value, onChange, disabled, autoComplete, hint }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2 block">
        {label}
        {hint && <span className="ml-2 text-slate-300 normal-case tracking-normal font-normal">— {hint}</span>}
      </span>
      <div className="relative">
        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2.5} />
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          className="w-full pl-10 pr-3 py-3 bg-white border-2 border-slate-800 font-zh text-slate-800 focus:outline-none focus:-translate-y-0.5 focus:-translate-x-0.5 transition-transform disabled:opacity-60"
        />
      </div>
    </label>
  )
}
