"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { AlertRule } from "./types"
import { useAuth } from "./auth-context"
import { fetchAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, NewAlertRuleInput } from "./api"

// userId/id/matchCount/createdAt/updatedAt are server-owned — the API
// rejects unexpected fields (ValidationPipe forbidNonWhitelisted), so only
// NewAlertRuleInput's fields may be sent on create.
type NewAlert = NewAlertRuleInput

interface AlertsContextType {
  alerts: AlertRule[]
  isLoading: boolean
  error: string | null
  /** Resolves true on success, false on failure (error is set on the context either way). */
  addAlert: (alert: NewAlert) => Promise<boolean>
  updateAlert: (id: string, updates: Partial<NewAlertRuleInput>) => void
  deleteAlert: (id: string) => void
  toggleAlert: (id: string) => void
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined)

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setAlerts([])
      return
    }
    setIsLoading(true)
    fetchAlertRules()
      .then(setAlerts)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [user])

  const addAlert = useCallback(async (alert: NewAlert): Promise<boolean> => {
    setError(null)
    try {
      const created = await createAlertRule(alert)
      setAlerts((prev) => [created, ...prev])
      return true
    } catch (e: any) {
      setError(e.message)
      return false
    }
  }, [])

  const updateAlert = useCallback((id: string, updates: Partial<NewAlertRuleInput>) => {
    setError(null)
    // Optimistic update — reverted if the request fails.
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
    updateAlertRule(id, updates)
      .then((updated) => setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a))))
      .catch((e) => {
        setError(e.message)
        fetchAlertRules().then(setAlerts).catch(() => undefined)
      })
  }, [])

  const deleteAlert = useCallback((id: string) => {
    setError(null)
    const previous = alerts
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    deleteAlertRule(id).catch((e) => {
      setError(e.message)
      setAlerts(previous)
    })
  }, [alerts])

  const toggleAlert = useCallback(
    (id: string) => {
      const target = alerts.find((a) => a.id === id)
      if (!target) return
      updateAlert(id, { enabled: !target.enabled })
    },
    [alerts, updateAlert],
  )

  return (
    <AlertsContext.Provider value={{ alerts, isLoading, error, addAlert, updateAlert, deleteAlert, toggleAlert }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) throw new Error("useAlerts must be used within AlertsProvider")
  return context
}
