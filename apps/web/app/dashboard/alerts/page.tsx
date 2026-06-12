"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Bell, Plus, AlertCircle, Trash2, ToggleLeft, ToggleRight, Zap, Search, FolderOpen, Building2 } from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

export default function AlertsPage() {
  const { user } = useAuth()
  const { alerts, addAlert, toggleAlert, deleteAlert } = useAlerts()
  const [showCreate, setShowCreate] = useState(false)
  const [newAlert, setNewAlert] = useState({ name: "", type: "keyword" as "keyword" | "category" | "organization", conditions: "" })

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-poppins">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-full max-w-sm rounded-[24px] bg-vez-surface p-10 text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-vez-mute" />
            <h2 className="mb-1 text-lg text-vez-ink">Sign in required</h2>
            <p className="mb-6 text-sm text-vez-mute">Please sign in to manage alerts.</p>
            <Link
              href="/login"
              className="block w-full rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleCreate = () => {
    if (!newAlert.name || !newAlert.conditions) return
    addAlert({
      userId: user.id,
      type: newAlert.type,
      name: newAlert.name,
      conditions: newAlert.conditions.split(",").map(s => s.trim()),
      enabled: true,
    })
    setNewAlert({ name: "", type: "keyword", conditions: "" })
    setShowCreate(false)
  }

  const alertTypeIcon = (type: string) => {
    switch (type) {
      case "keyword": return <Search className="size-4" />
      case "category": return <FolderOpen className="size-4" />
      case "organization": return <Building2 className="size-4" />
      default: return <Bell className="size-4" />
    }
  }

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <DashboardLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              My alerts.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">
              {alerts.length} alert rule{alerts.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="size-4" /> New alert
          </button>
        </div>

        {/* Create Alert Form */}
        {showCreate && (
          <div className="mb-6 rounded-[20px] bg-vez-sky/25 p-6 md:p-8">
            <h2 className="text-lg text-vez-ink">Create new alert</h2>
            <p className="mt-1 text-sm text-vez-mute">Get notified when new notices match your criteria</p>
            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Alert name</label>
                <input
                  placeholder="e.g. Section Officer Updates"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-vez-mute">Alert type</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "keyword" as const, label: "Keyword", icon: Search },
                    { id: "category" as const, label: "Category", icon: FolderOpen },
                    { id: "organization" as const, label: "Organization", icon: Building2 },
                  ].map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setNewAlert({ ...newAlert, type: type.id })}
                        className={`rounded-[16px] p-4 text-center transition-colors ${
                          newAlert.type === type.id
                            ? "bg-vez-navy text-white"
                            : "bg-white text-vez-mute hover:text-vez-navy"
                        }`}
                      >
                        <Icon className="mx-auto mb-1.5 size-5" />
                        <p className="text-xs">{type.label}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-vez-mute">
                  {newAlert.type === "keyword" ? "Keywords (comma separated)" :
                   newAlert.type === "category" ? "Categories (comma separated)" :
                   "Organization names (comma separated)"}
                </label>
                <input
                  placeholder={
                    newAlert.type === "keyword" ? "section officer, lok sewa, PSC" :
                    newAlert.type === "category" ? "exams, vacancies" :
                    "Nepal Rastra Bank, Ministry of Education"
                  }
                  value={newAlert.conditions}
                  onChange={(e) => setNewAlert({ ...newAlert, conditions: e.target.value })}
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-vez-mute">
                  You&apos;ll be notified when new notices match any of these conditions
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCreate}
                  disabled={!newAlert.name || !newAlert.conditions}
                  className="rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Create alert
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-full px-5 py-2.5 text-sm text-vez-mute transition-colors hover:bg-white hover:text-vez-navy"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {alerts.length === 0 && !showCreate && (
          <div className="rounded-[24px] bg-vez-surface p-12 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-vez-sky/40">
              <Zap className="size-7 text-vez-navy" />
            </div>
            <h3 className="mb-2 text-lg text-vez-ink">Set up your first alert</h3>
            <p className="mx-auto mb-6 max-w-sm text-sm text-vez-mute">
              Create alert rules to get notified automatically when notices matching your interests are published.
            </p>
            <div className="mb-7 flex items-center justify-center gap-5 text-sm text-vez-mute">
              <span className="flex items-center gap-1.5"><Search className="size-3.5" /> By keyword</span>
              <span className="flex items-center gap-1.5"><FolderOpen className="size-3.5" /> By category</span>
              <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> By organization</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-vez-navy px-6 py-3 text-base text-white transition-opacity hover:opacity-90"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-4" /> Create first alert
            </button>
          </div>
        )}

        {/* Alert List */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-4 rounded-[16px] bg-white p-5 transition-colors hover:bg-vez-sky/10"
              >
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className="shrink-0"
                  aria-label={alert.enabled ? "Disable alert" : "Enable alert"}
                >
                  {alert.enabled ? (
                    <ToggleRight className="size-7 text-vez-navy" />
                  ) : (
                    <ToggleLeft className="size-7 text-vez-mute" />
                  )}
                </button>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vez-sky/30 text-vez-navy">
                  {alertTypeIcon(alert.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base text-vez-ink">{alert.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-vez-navy px-2.5 py-0.5 text-[10px] capitalize text-white">{alert.type}</span>
                    {alert.conditions.slice(0, 3).map((c, i) => (
                      <span key={i} className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">{c}</span>
                    ))}
                    {alert.conditions.length > 3 && (
                      <span className="text-[10px] text-vez-mute">+{alert.conditions.length - 3} more</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-vez-sky/30 px-3 py-1 text-xs text-vez-navy">
                  {alert.matchCount} matches
                </span>
                <button
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600"
                  onClick={() => deleteAlert(alert.id)}
                  aria-label="Delete alert"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DashboardLayout>
    </div>
  )
}
