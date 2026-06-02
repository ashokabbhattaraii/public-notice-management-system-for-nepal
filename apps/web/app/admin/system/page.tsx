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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "settings">("overview")

  const systemStats = [
    { icon: Server, label: "System Status", value: "Operational", color: "text-green-600" },
    { icon: Database, label: "Storage", value: "localStorage", color: "text-blue-600" },
    { icon: HardDrive, label: "Data Size", value: "4.8 MB", color: "text-purple-600" },
    { icon: Activity, label: "Uptime", value: "99.9%", color: "text-amber-600" },
    { icon: Shield, label: "Security", value: "Local Mode", color: "text-emerald-600" },
    { icon: Clock, label: "Last Backup", value: "Today 05:00", color: "text-sky-600" },
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">System</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor, configure, and manage the system</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {[
            { id: "overview" as const, label: "Overview", icon: Activity },
            { id: "logs" as const, label: "System Logs", icon: Terminal },
            { id: "settings" as const, label: "Settings", icon: Save },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {systemStats.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`size-10 rounded-lg bg-accent flex items-center justify-center ${stat.color}`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="font-semibold">{stat.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                  <CardDescription>Export, import, and manage local data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Download className="size-4" /> Export All Notices (JSON)
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Download className="size-4" /> Export Users (CSV)
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Download className="size-4" /> Export System Logs
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Upload className="size-4" /> Import Data (JSON)
                  </Button>
                  <hr className="border-border" />
                  <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" /> Clear All Local Data
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Current system status checks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "localStorage", status: "ok", detail: "4.8 / 5.0 MB" },
                    { name: "Auth Service", status: "ok", detail: "Local mode" },
                    { name: "Scraping Engine", status: "warn", detail: "1 source failing" },
                    { name: "RAG Service", status: "ok", detail: "6 documents indexed" },
                    { name: "Alert Engine", status: "ok", detail: "3 rules active" },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2.5">
                        {check.status === "ok" ? (
                          <CheckCircle className="size-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="size-4 text-amber-500" />
                        )}
                        <span className="text-sm font-medium">{check.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{check.detail}</span>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
                    <RefreshCw className="size-3.5" /> Run Health Check
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Logs</CardTitle>
                  <CardDescription>All system events in reverse chronological order</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="size-3.5" /> Export
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="size-3.5" /> Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {systemLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/30 font-mono text-xs">
                    {log.level === "info" ? (
                      <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                    ) : log.level === "warn" ? (
                      <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive shrink-0" />
                    )}
                    <span className="text-muted-foreground w-40 shrink-0">{log.time}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 w-16 justify-center">
                      {log.module}
                    </Badge>
                    <span className="flex-1 truncate">{log.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic system configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Site Title</label>
                  <Input defaultValue="GovNotice - Nepal Public Notice Repository" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Site Description</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                    defaultValue="Nepal's centralized repository for all government and public sector notices."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Default Language</label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="en">English</option>
                    <option value="ne">Nepali</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notices Per Page</label>
                  <Input type="number" defaultValue="10" />
                </div>
                <Button className="gap-2">
                  <Save className="size-4" /> Save Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security & Sessions</CardTitle>
                <CardDescription>Authentication and access settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Auto-logout timeout</p>
                    <p className="text-xs text-muted-foreground">Inactive session expiry</p>
                  </div>
                  <Badge variant="outline" className="font-mono">30 min</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Max login attempts</p>
                    <p className="text-xs text-muted-foreground">Before temporary lockout</p>
                  </div>
                  <Badge variant="outline" className="font-mono">5</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Password requirements</p>
                    <p className="text-xs text-muted-foreground">Minimum strength rules</p>
                  </div>
                  <Badge variant="outline" className="font-mono">Disabled</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Maintenance mode</p>
                    <p className="text-xs text-muted-foreground">Block non-admin access</p>
                  </div>
                  <Button variant="outline" size="sm">Off</Button>
                </div>
                <hr className="border-border" />
                <p className="text-xs text-muted-foreground">
                  This system currently runs in local-only mode. Security settings will take effect once connected to the backend API.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
