import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import PaperPiece from '../components/PaperPiece.jsx'
import MarkerButton from '../components/MarkerButton.jsx'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError(t('login.errMissingFields'))
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const userData = await login(email, password)
      if (!userData?.isAdmin && !(userData?.permissions?.length)) {
        setError(t('login.errNoAdminAccess'))
        setIsLoading(false)
        return
      }
      navigate('/')
    } catch (err) {
      setError(err.message || t('login.errRetry'))
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f3f0e6] relative">
      {/* 背景裝飾 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
        <div className="absolute top-[-5%] left-[-10%] w-[50%] h-96 bg-emerald-100 rotate-6" style={{ borderRadius: '40%' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-96 bg-sky-100 -rotate-6" style={{ borderRadius: '30%' }} />
        <div className="absolute top-[40%] left-[45%] w-[20%] h-40 bg-orange-50 rotate-12" style={{ borderRadius: '50%' }} />
      </div>

      <PaperPiece color="white" rotate="-1.5deg" variant="scrap" className="w-full max-w-md p-12 z-10">
        {/* 標題區 */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-24 h-24 mb-[4px] flex items-center justify-center"
            style={{ transform: 'rotate(-4deg)' }}
          >
            <img src="/admin.png" alt="Admin" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">ClocDot</h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
            Admin Console
          </p>
          <div className="h-1 w-16 bg-orange-400/30 rounded-full mt-4" />
        </div>

        {/* 錯誤提示 */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border-2 border-red-200 font-zh text-sm text-red-500 text-center"
               style={{ borderRadius: '8px 2px 10px 3px/3px 10px 2px 8px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2 block">Email</span>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2.5} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                className="w-full pl-10 pr-3 py-3 bg-white border-2 border-slate-800 font-zh text-slate-800 focus:outline-none focus:-translate-y-0.5 focus:-translate-x-0.5 transition-transform disabled:opacity-60"
                placeholder="admin@example.com"
              />
            </div>
          </label>

          {/* Password */}
          <label className="block">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2 block">Password</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2.5} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full pl-10 pr-3 py-3 bg-white border-2 border-slate-800 font-zh text-slate-800 focus:outline-none focus:-translate-y-0.5 focus:-translate-x-0.5 transition-transform disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>
          </label>

          {/* 登入按鈕 */}
          <div className="mt-2 flex justify-center">
            <MarkerButton
              as="button"
              type="submit"
              color="#0f172a"
              rotate="-1.2deg"
              fontSize={16}
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? t('login.signingIn') : t('login.signIn')}
            </MarkerButton>
          </div>
        </form>

        <p className="mt-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.25em] italic">
          {t('login.adminOnly')}
        </p>

        {import.meta.env.VITE_CLIENT_URL && (
          <div className="mt-6 text-center">
            <a
              href={import.meta.env.VITE_CLIENT_URL}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 underline decoration-dotted underline-offset-4 transition-colors font-zh"
            >
              {t('login.clientLink')}
            </a>
          </div>
        )}
      </PaperPiece>
    </div>
  )
}
