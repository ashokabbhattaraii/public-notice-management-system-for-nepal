"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { User } from "./types"
import { fetchMe, googleLogin, apiLogout, tokenStore, AUTH_EXPIRED_EVENT } from "./api"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
  /** Real sign-in: exchange a Google ID token for a session. Returns the user on success. */
  loginWithGoogle: (credential: string) => Promise<User | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USER_KEY = "pnm_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /** Remove every auth artifact — localStorage + cookie + in-memory state. */
  const clearSession = useCallback(() => {
    setUser(null)
    tokenStore.clear()
    localStorage.removeItem(USER_KEY)
  }, [])

  // On mount: hydrate from localStorage, then re-validate the token against the
  // API. A stored user whose token is gone/expired must NOT survive — otherwise
  // the UI believes we're signed in while every API call fails.
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
        } else {
          // Token missing/invalid server-side → drop the stale cached user too.
          clearSession()
        }
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => setIsLoading(false))
  }, [clearSession])

  // Global 401 listener: any API call that got rejected mid-session (expired
  // token while browsing, revoked token, storage cleared) force-logs-out so
  // route guards bounce to /login.
  useEffect(() => {
    const onUnauthorized = () => clearSession()
    window.addEventListener(AUTH_EXPIRED_EVENT, onUnauthorized)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onUnauthorized)
  }, [clearSession])

  // Cross-tab sync: if another tab clears the auth keys (logout, "clear site
  // data"), or signs in, reflect it here so this tab doesn't keep a ghost user.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue))
          } catch {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const loginWithGoogle = async (credential: string): Promise<User | null> => {
    try {
      const loggedIn = await googleLogin(credential)
      setUser(loggedIn)
      localStorage.setItem(USER_KEY, JSON.stringify(loggedIn))
      return loggedIn
    } catch {
      tokenStore.clear()
      return null
    }
  }

  /** Sign out everywhere: revoke the server session, then drop local state. */
  const logout = useCallback(() => {
    void apiLogout()
    clearSession()
  }, [clearSession])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin: user?.role === "admin", loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}