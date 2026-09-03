import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser, loginWithPassword, logout as authLogout } from '../services/auth.js'
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

  const logout = useCallback(() => {
    authLogout()
    setUser(null)
  }, [])

  const value = { user, loading, loginEmail, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
