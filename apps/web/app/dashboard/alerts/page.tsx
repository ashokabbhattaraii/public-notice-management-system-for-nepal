"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Bell, Plus, AlertCircle, Trash2, ToggleLeft, ToggleRight, Zap, Search, FolderOpen, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Header } from "@/components/layout/header"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/alerts-context"

export default function AlertsPage() {
  const { user } = useAuth()
  const { alerts, addAlert, toggleAlert, deleteAlert } = useAlerts()
  const [showCreate, setShowCreate] = useState(false)
  const [newAlert, setNewAlert] = useState({ name: "", type: "keyword" as "keyword" | "category" | "organization", conditions: "" })

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
              <p className="text-muted-foreground mb-4">Please sign in to manage alerts</p>
              <Link href="/login"><Button>Sign In</Button></Link>
            </CardContent>
          </Card>
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
    <div className="min-h-screen bg-background">
      <Header />
      <DashboardLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="size-5 text-primary" /> My Alerts
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {alerts.length} alert rule{alerts.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="size-4" /> New Alert
          </Button>
        </div>

        {/* Create Alert Form */}
        {showCreate && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Create New Alert</CardTitle>
              <CardDescription>Get notified when new notices match your criteria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Alert Name</label>
                <Input
                  placeholder="e.g. Section Officer Updates"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Alert Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "keyword" as const, label: "Keyword", icon: Search, desc: "Match by keywords" },
                    { id: "category" as const, label: "Category", icon: FolderOpen, desc: "Match by category" },
                    { id: "organization" as const, label: "Organization", icon: Building2, desc: "Match by org" },
                  ].map((type) => {
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setNewAlert({ ...newAlert, type: type.id })}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          newAlert.type === type.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Icon className="size-5 mx-auto mb-1" />
                        <p className="text-xs font-medium">{type.label}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {newAlert.type === "keyword" ? "Keywords (comma separated)" :
                   newAlert.type === "category" ? "Categories (comma separated)" :
                   "Organization names (comma separated)"}
                </label>
                <Input
                  placeholder={
                    newAlert.type === "keyword" ? "section officer, lok sewa, PSC" :
                    newAlert.type === "category" ? "exams, vacancies" :
                    "Nepal Rastra Bank, Ministry of Education"
                  }
                  value={newAlert.conditions}
                  onChange={(e) => setNewAlert({ ...newAlert, conditions: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You&apos;ll be notified when new notices match any of these conditions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleCreate} disabled={!newAlert.name || !newAlert.conditions}>
                  Create Alert
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {alerts.length === 0 && !showCreate && (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="size-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Set up your first alert</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Create alert rules to get notified automatically when notices matching your interests are published.
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1"><Search className="size-3.5" /> By keyword</span>
                <span className="flex items-center gap-1"><FolderOpen className="size-3.5" /> By category</span>
                <span className="flex items-center gap-1"><Building2 className="size-3.5" /> By organization</span>
              </div>
              <Button className="gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" /> Create First Alert
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Alert List */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="shrink-0"
                  >
                    {alert.enabled ? (
                      <ToggleRight className="size-7 text-primary" />
                    ) : (
                      <ToggleLeft className="size-7 text-muted-foreground" />
                    )}
                  </button>
                  <div className="size-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    {alertTypeIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{alert.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">{alert.type}</Badge>
                      {alert.conditions.slice(0, 3).map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                      {alert.conditions.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{alert.conditions.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary">{alert.matchCount} matches</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => deleteAlert(alert.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DashboardLayout>
      
    </div>
  )
}
