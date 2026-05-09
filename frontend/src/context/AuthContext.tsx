import { createContext, useContext, useState, type ReactNode } from 'react'

interface AuthContextType {
  isAdmin: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'vuhan_admin_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // Khôi phục session từ localStorage (tồn tại đến khi đóng tab hoặc logout)
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  })

  const login = (username: string, password: string): boolean => {
    const validUser = import.meta.env.VITE_ADMIN_USERNAME || 'admin'
    const validPass = import.meta.env.VITE_ADMIN_PASSWORD || 'vuhan2026'

    if (username === validUser && password === validPass) {
      setIsAdmin(true)
      sessionStorage.setItem(STORAGE_KEY, 'true')
      return true
    }
    return false
  }

  const logout = () => {
    setIsAdmin(false)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
