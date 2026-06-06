"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { User } from "./types"
import { mockUsers } from "./mock-data"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  loginWithGoogle: (role?: "admin" | "user") => Promise<boolean>
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

  const loginWithGoogle = async (role?: "admin" | "user"): Promise<boolean> => {
    // If a user is already stored (e.g., dummy login), keep their role.
    // This prevents always forcing `role: "user"` during dummy/admin login flows.
    const stored = localStorage.getItem("pnm_user")
    if (stored) {
      try {
        setUser(JSON.parse(stored))
        return true
      } catch {
        // fall through to mock default
      }
    }

    // Default dummy login: pick active user/admin based on requested role.
    const googleUser =
      (role === "admin"
        ? mockUsers.find((u) => u.role === "admin" && u.status === "active")
        : mockUsers.find((u) => u.role === "user" && u.status === "active")) ??
      mockUsers.find((u) => u.status === "active") ??
      mockUsers[0]


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
