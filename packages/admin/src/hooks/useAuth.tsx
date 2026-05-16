import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

interface Admin {
  email: string
  name: string
}

interface AuthContextType {
  isAuthenticated: boolean
  admin: Admin | null
  sessionToken: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const SESSION_KEY = 'corz_admin_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(false)
  const loginMutation = useMutation(api.admins.login)
  const logoutMutation = useMutation(api.sessions.logout)

  const storedToken = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
  const sessionCheck = useQuery(api.sessions.verify, storedToken ? { token: storedToken } : "skip")

  useEffect(() => {
    if (storedToken) {
      if (sessionCheck) {
        if (sessionCheck.valid) {
          setSessionToken(storedToken)
          setAdmin({ email: sessionCheck.email, name: sessionCheck.name })
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
        setIsRestored(true)
      }
    } else {
      setIsRestored(true)
    }
  }, [sessionCheck, storedToken])

  useEffect(() => {
    if (storedToken && !sessionCheck) {
      const timer = setTimeout(() => setIsRestored(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [storedToken, sessionCheck])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true)
    try {
      const result = await loginMutation({ email, password })

      if (result.success) {
        const adminData = { email: result.email, name: result.name }
        setSessionToken(result.sessionToken)
        setAdmin(adminData)
        localStorage.setItem(SESSION_KEY, result.sessionToken)
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

  const logout = useCallback(() => {
    const token = sessionToken
    setSessionToken(null)
    setAdmin(null)
    localStorage.removeItem(SESSION_KEY)
    if (token) logoutMutation({ token })
  }, [sessionToken, logoutMutation])

  const isAuthenticated = sessionToken !== null && admin !== null

  if (!isRestored) {
    return null
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, admin, sessionToken, login, logout, loading }}>
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
