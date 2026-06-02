"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { AlertRule } from "./types"
import { mockAlertRules } from "./mock-data"

interface AlertsContextType {
  alerts: AlertRule[]
  addAlert: (alert: Omit<AlertRule, "id" | "createdAt" | "matchCount">) => void
  updateAlert: (id: string, updates: Partial<AlertRule>) => void
  deleteAlert: (id: string) => void
  toggleAlert: (id: string) => void
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined)

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertRule[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("pnm_alerts")
    if (stored) {
      setAlerts(JSON.parse(stored))
    } else {
      setAlerts(mockAlertRules)
      localStorage.setItem("pnm_alerts", JSON.stringify(mockAlertRules))
    }
  }, [])

  const save = (newAlerts: AlertRule[]) => {
    setAlerts(newAlerts)
    localStorage.setItem("pnm_alerts", JSON.stringify(newAlerts))
  }

  const addAlert = (alert: Omit<AlertRule, "id" | "createdAt" | "matchCount">) => {
    const newAlert: AlertRule = {
      ...alert,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      matchCount: 0,
    }
    save([...alerts, newAlert])
  }

  const updateAlert = (id: string, updates: Partial<AlertRule>) => {
    save(alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }

  const deleteAlert = (id: string) => {
    save(alerts.filter((a) => a.id !== id))
  }

  const toggleAlert = (id: string) => {
    save(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)))
  }

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, updateAlert, deleteAlert, toggleAlert }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) throw new Error("useAlerts must be used within AlertsProvider")
  return context
}
