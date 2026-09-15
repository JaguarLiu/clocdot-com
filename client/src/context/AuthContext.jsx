import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser, loginWithPassword, logout as authLogout } from '../services/auth.js'
import { clearQueue } from '../services/offlineQueue.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false))
  }, [])

  const loginEmail = useCallback(async (email, password) => {
    const userData = await loginWithPassword(email, password)
    setUser(userData)
    return userData
  }, [])

  // 登出一律連離線打卡佇列一起清 —— 佇列裡的打卡屬於「上一個人」，
  // 留著會在下一位使用者登入後用他的 token 送出（見 Attendance 的 trySync）。
  // 有未送出的打卡時，呼叫端要先取得使用者確認（見 Profile 的 LogoutConfirmModal）。
  const logout = useCallback(() => {
    authLogout()
    clearQueue()
    setUser(null)
  }, [])

  const value = { user, loading, loginEmail, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
