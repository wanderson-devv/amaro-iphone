import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setAuthToken, getAuthToken } from '../services/api'

interface User { uuid: string; name: string; email: string }
interface AuthContextType { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => void }

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, login: async () => {}, register: async () => {}, logout: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) { setLoading(false); return }
    api.auth.me().then((u) => setUser(u)).catch(() => setAuthToken(null)).finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { token, user } = await api.auth.login(email, password)
    setAuthToken(token); setUser(user)
  }

  const register = async (name: string, email: string, password: string) => {
    const { token, user } = await api.auth.register(name, email, password)
    setAuthToken(token); setUser(user)
  }

  const logout = () => { setAuthToken(null); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
