"use client"

import React, { useState } from "react"
import {
  Save,
  Database,
  Server,
  HardDrive,
  Activity,
  Terminal,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "settings">("overview")

  const systemStats = [
    { icon: Server, label: "System status", value: "Operational" },
    { icon: Database, label: "Storage", value: "localStorage" },
    { icon: HardDrive, label: "Data size", value: "4.8 MB" },
    { icon: Activity, label: "Uptime", value: "99.9%" },
    { icon: Shield, label: "Security", value: "Local mode" },
    { icon: Clock, label: "Last backup", value: "Today 05:00" },
  ]

  const systemLogs = [
    { time: "2026-06-02 08:30:12", level: "info", module: "auth", message: "User 'admin' logged in successfully" },
    { time: "2026-06-02 08:12:34", level: "info", module: "scraper", message: "Nepal Gazette scraping completed (12 items)" },
    { time: "2026-06-02 08:00:02", level: "info", module: "scraper", message: "Procurement Portal scraping completed (8 items)" },
    { time: "2026-06-02 07:45:00", level: "warn", module: "scraper", message: "MoE Portal: connection timeout (retry 2)" },
    { time: "2026-06-02 06:30:00", level: "error", module: "scraper", message: "MoE Portal: ECONNREFUSED after 3 retries" },
    { time: "2026-06-02 06:00:00", level: "info", module: "scheduler", message: "Daily scraping cycle initiated" },
    { time: "2026-06-02 05:00:00", level: "info", module: "backup", message: "Database backup completed (4.8 MB)" },
    { time: "2026-06-01 23:00:00", level: "info", module: "system", message: "Daily cleanup: removed 3 expired sessions" },
    { time: "2026-06-01 22:05:12", level: "info", module: "scraper", message: "PSC scraping completed (3 items)" },
    { time: "2026-06-01 18:00:00", level: "info", module: "scraper", message: "Procurement Portal scraping completed (5 items)" },
    { time: "2026-06-01 14:22:00", level: "info", module: "auth", message: "User 'ramesh_sharma' logged in" },
    { time: "2026-06-01 12:00:00", level: "warn", module: "storage", message: "localStorage approaching 5MB limit (4.8MB used)" },
  ]

  const outlineButton =
    "flex w-full items-center gap-2.5 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8">
          <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
            System.
          </h1>
          <p className="mt-2 text-sm text-vez-mute">Monitor, configure, and manage the system</p>
        </div>

        {/* Tabs — pill style */}
        <div className="mb-6 flex w-fit items-center gap-1 rounded-full bg-white p-1.5">
          {[
            { id: "overview" as const, label: "Overview", icon: Activity },
            { id: "logs" as const, label: "System logs", icon: Terminal },
            { id: "settings" as const, label: "Settings", icon: Save },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-vez-navy text-white"
                    : "text-vez-mute hover:text-vez-navy"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {systemStats.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <div key={i} className="flex items-center gap-3.5 rounded-[16px] bg-white p-5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-vez-sky/30">
                      <Icon className="size-4 text-vez-navy" />
                    </div>
                    <div>
                      <p className="text-xs text-vez-mute">{stat.label}</p>
                      <p className="text-base text-vez-ink">{stat.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-[20px] bg-white p-6">
                <h2 className="text-lg text-vez-ink">Data management</h2>
                <p className="mt-0.5 text-sm text-vez-mute">Export, import, and manage local data</p>
                <div className="mt-5 space-y-2.5">
                  <button className={outlineButton}>
                    <Download className="size-4" /> Export all notices (JSON)
                  </button>
                  <button className={outlineButton}>
                    <Download className="size-4" /> Export users (CSV)
                  </button>
                  <button className={outlineButton}>
                    <Download className="size-4" /> Export system logs
                  </button>
                  <button className={outlineButton}>
                    <Upload className="size-4" /> Import data (JSON)
                  </button>
                  <hr className="border-vez-line" />
                  <button className="flex w-full items-center gap-2.5 rounded-full border border-red-200 px-5 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50">
                    <Trash2 className="size-4" /> Clear all local data
                  </button>
                </div>
              </div>

              <div className="rounded-[20px] bg-white p-6">
                <h2 className="text-lg text-vez-ink">System health</h2>
                <p className="mt-0.5 text-sm text-vez-mute">Current system status checks</p>
                <div className="mt-5 space-y-2.5">
                  {[
                    { name: "localStorage", status: "ok", detail: "4.8 / 5.0 MB" },
                    { name: "Auth service", status: "ok", detail: "Local mode" },
                    { name: "Scraping engine", status: "warn", detail: "1 source failing" },
                    { name: "RAG service", status: "ok", detail: "6 documents indexed" },
                    { name: "Alert engine", status: "ok", detail: "3 rules active" },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center justify-between rounded-[14px] bg-vez-surface px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {check.status === "ok" ? (
                          <CheckCircle className="size-4 text-vez-navy" />
                        ) : (
                          <AlertCircle className="size-4 text-amber-500" />
                        )}
                        <span className="text-sm text-vez-ink">{check.name}</span>
                      </div>
                      <span className="text-xs text-vez-mute">{check.detail}</span>
                    </div>
                  ))}
                  <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90">
                    <RefreshCw className="size-3.5" /> Run health check
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="rounded-[20px] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg text-vez-ink">System logs</h2>
                <p className="mt-0.5 text-sm text-vez-mute">All system events in reverse chronological order</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface">
                  <Download className="size-3.5" /> Export
                </button>
                <button className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface">
                  <RefreshCw className="size-3.5" /> Refresh
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {systemLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-xs transition-colors hover:bg-vez-surface">
                  {log.level === "info" ? (
                    <CheckCircle className="size-3.5 shrink-0 text-vez-navy" />
                  ) : log.level === "warn" ? (
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-red-500" />
                  )}
                  <span className="w-40 shrink-0 text-vez-mute tabular-nums">{log.time}</span>
                  <span className="w-20 shrink-0 rounded-full bg-vez-surface px-2.5 py-0.5 text-center text-[9px] text-vez-mute">
                    {log.module}
                  </span>
                  <span className="flex-1 truncate text-vez-ink">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-[20px] bg-white p-6">
              <h2 className="text-lg text-vez-ink">General settings</h2>
              <p className="mt-0.5 text-sm text-vez-mute">Basic system configuration</p>
              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Site title</label>
                  <input defaultValue="Suchana AI - Nepal Public Notice Management System" className={inputClass} />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Site description</label>
                  <textarea
                    className="min-h-[80px] w-full resize-none rounded-[12px] border border-vez-line bg-white px-4 py-3 text-sm text-vez-ink outline-none transition-colors focus:border-vez-sky"
                    defaultValue="Nepal's centralized repository for all government and public sector notices."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Default language</label>
                  <select className="h-11 w-full rounded-full border border-vez-line bg-white px-4 text-sm text-vez-ink outline-none transition-colors focus:border-vez-sky">
                    <option value="en">English</option>
                    <option value="ne">Nepali</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Notices per page</label>
                  <input type="number" defaultValue="10" className={inputClass} />
                </div>
                <button className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90">
                  <Save className="size-4" /> Save settings
                </button>
              </div>
            </div>

            <div className="h-fit rounded-[20px] bg-white p-6">
              <h2 className="text-lg text-vez-ink">Security & sessions</h2>
              <p className="mt-0.5 text-sm text-vez-mute">Authentication and access settings</p>
              <div className="mt-5 space-y-1">
                {[
                  { label: "Auto-logout timeout", desc: "Inactive session expiry", value: "30 min" },
                  { label: "Max login attempts", desc: "Before temporary lockout", value: "5" },
                  { label: "Password requirements", desc: "Minimum strength rules", value: "Disabled" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-vez-ink">{item.label}</p>
                      <p className="text-xs text-vez-mute">{item.desc}</p>
                    </div>
                    <span className="rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-ink">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-vez-ink">Maintenance mode</p>
                    <p className="text-xs text-vez-mute">Block non-admin access</p>
                  </div>
                  <button className="rounded-full border border-vez-line px-4 py-1.5 text-xs text-vez-ink transition-colors hover:bg-vez-surface">
                    Off
                  </button>
                </div>
                <hr className="border-vez-line" />
                <p className="pt-3 text-xs text-vez-mute">
                  This system currently runs in local-only mode. Security settings will take effect once connected to the backend API.
                </p>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
