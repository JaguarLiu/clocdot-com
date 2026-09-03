import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, LogIn } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import PaperPiece from '../components/PaperPiece.jsx'
import MarkerButton from '../components/MarkerButton.jsx'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'

function CompanyLogo({ className, alt }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <img
        src="/logo.png"
        alt={alt}
        className="max-w-full h-auto object-contain"
        style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.1))' }}
      />
    </div>
  )
}

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { loginEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState(null) // null | 'email'

  const handleEmailLogin = useCallback(async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError(t('login.errMissingFields'))
      return
    }
    setError(null)
    setIsLoading(true)
    setMode('email')
    try {
      await loginEmail(email.trim().toLowerCase(), password)
      navigate('/')
    } catch (err) {
      setError(err?.message || t('login.errRetry'))
      setIsLoading(false)
      setMode(null)
    }
  }, [email, password, loginEmail, navigate, t])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f3f0e6] relative">
      {/* 筆記本橫線背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(120,100,70,0.1) 31px, rgba(120,100,70,0.1) 32px)',
        }}
      />

      {/* 語言切換 — 登入前就要能切，否則英文使用者看不懂畫面 */}
      <LanguageSwitcher className="absolute top-5 right-5 z-20 rotate-[1.5deg]" />

      <PaperPiece color="white" rotate="-2deg" className="w-full max-w-sm p-10 flex flex-col items-center z-10">
        {/* Logo 區域 */}
        <div className="relative mb-8 w-full flex justify-center">
          <CompanyLogo className="w-40 rotate-1" alt={t('login.logoAlt')} />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-1.5 w-20 bg-orange-400/20 rounded-full" />
        </div>

        <h1 className="text-2xl font-black text-slate-700 mb-1">ClocDot</h1>
        <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-[0.2em]">{t('login.tagline')}</p>

        {/* 錯誤提示 — 紙條樣式 */}
        {error && (
          <div
            className="w-full mb-5 px-4 py-2.5 bg-red-50 border-l-4 border-red-400 text-xs font-bold text-red-600 font-zh"
            style={{ borderRadius: '4px 2px 6px 3px/3px 6px 2px 4px' }}
          >
            {error}
          </div>
        )}

        {/* Email + 密碼 表單 */}
        <form onSubmit={handleEmailLogin} className="w-full space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">
              <Mail size={11} strokeWidth={3} />
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="you@company.com"
              className="w-full bg-slate-50 border-b-2 border-slate-200 p-2 font-mono text-sm text-slate-700 rounded-none focus:outline-none focus:border-emerald-400 transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">
              <Lock size={11} strokeWidth={3} />
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-50 border-b-2 border-slate-200 p-2 font-mono text-sm text-slate-700 rounded-none focus:outline-none focus:border-emerald-400 transition-colors disabled:opacity-60"
            />
          </div>

          <MarkerButton
            type="submit"
            color="#10b981"
            rotate="-0.8deg"
            fontSize={16}
            onClick={handleEmailLogin}
            disabled={isLoading}
            className="w-full"
            style={{ width: '100%' }}
          >
            <LogIn size={16} strokeWidth={3} />
            <span>{isLoading && mode === 'email' ? t('login.signingIn') : t('login.signIn')}</span>
          </MarkerButton>
        </form>

        {import.meta.env.VITE_ADMIN_URL && (
          <a
            href={import.meta.env.VITE_ADMIN_URL}
            className="mt-8 text-xs font-bold text-slate-400 hover:text-slate-600 underline decoration-dotted underline-offset-4 transition-colors font-zh"
          >
            {t('login.adminLink')}
          </a>
        )}
      </PaperPiece>
    </div>
  )
}
