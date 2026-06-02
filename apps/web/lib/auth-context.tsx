"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { User } from "./types"
import { mockUsers } from "./mock-data"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  loginWithGoogle: () => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem("pnm_user")
    if (stored) {
      setUser(JSON.parse(stored))
    }
    setIsLoading(false)
  }, [])

  const loginWithGoogle = async (): Promise<boolean> => {
    const googleUser = mockUsers.find((u) => u.role === "user") ?? mockUsers[0]
    setUser(googleUser)
    localStorage.setItem("pnm_user", JSON.stringify(googleUser))
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("pnm_user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
