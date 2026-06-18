"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { User } from "./types"
import { fetchMe, googleLogin, tokenStore } from "./api"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  /** Real sign-in: exchange a Google ID token for a session. Returns the user on success. */
  loginWithGoogle: (credential: string) => Promise<User | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USER_KEY = "pnm_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, hydrate from localStorage, then re-validate the token against the API.
  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem(USER_KEY)
      }
    }

    fetchMe()
      .then((me) => {
        if (me) {
          setUser(me)
          localStorage.setItem(USER_KEY, JSON.stringify(me))
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const loginWithGoogle = async (credential: string): Promise<User | null> => {
    try {
      const loggedIn = await googleLogin(credential)
      setUser(loggedIn)
      localStorage.setItem(USER_KEY, JSON.stringify(loggedIn))
      return loggedIn
    } catch {
      return null
    }
  }

  const logout = () => {
    setUser(null)
    tokenStore.clear()
    localStorage.removeItem(USER_KEY)
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
