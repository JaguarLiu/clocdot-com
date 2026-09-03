import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser, loginWithPassword, logout as authLogout } from '../services/auth.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const userData = await loginWithPassword(email, password)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
  }, [])

  const can = useCallback((key) => {
    if (!user) return false
    if (user.isAdmin) return true
    if (key === 'dashboard') return true
    return Array.isArray(user.permissions) && user.permissions.includes(key)
  }, [user])

  const value = { user, loading, login, logout, can }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
