import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

interface Admin {
  email: string
  name: string
}

interface AuthContextType {
  isAuthenticated: boolean
  admin: Admin | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_STORAGE_KEY = 'corz_admin_auth'

interface AuthStorage {
  isAuthenticated: boolean
  admin: Admin
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(false)
  const loginMutation = useMutation(api.admins.login)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed: AuthStorage = JSON.parse(stored)
        if (parsed.isAuthenticated && parsed.admin) {
          setIsAuthenticated(true)
          setAdmin(parsed.admin)
        }
      }
    } catch {
      // Invalid storage data, ignore
    }
    setIsRestored(true)
  }, [])

  useEffect(() => {
    if (!isRestored) return

    if (isAuthenticated && admin) {
      const data: AuthStorage = { isAuthenticated, admin }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [isAuthenticated, admin, isRestored])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true)
    try {
      const result = await loginMutation({ email, password })

      if (result.success) {
        const adminData = { email: result.email, name: result.name }
        setIsAuthenticated(true)
        setAdmin(adminData)
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      return { success: false, error: 'Login failed. Please try again.' }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setAdmin(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  if (!isRestored) {
    return null
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
