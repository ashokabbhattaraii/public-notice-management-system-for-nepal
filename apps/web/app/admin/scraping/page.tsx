"use client"

import React, { useState } from "react"
import {
  Play,
  Pause,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Terminal,
  Globe,
  Activity,
  Trash2,
  Edit,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { mockScrapingSources } from "@/lib/mock-data"

export default function AdminScrapingPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "logs" | "config">("sources")

  const scrapingLogs = [
    { id: 1, time: "2026-06-02 08:12:34", source: "Nepal Gazette Online", action: "Scraping completed", items: 12, status: "success", duration: "4.2s" },
    { id: 2, time: "2026-06-02 08:08:11", source: "Nepal Gazette Online", action: "Scraping started", items: 0, status: "info", duration: "-" },
    { id: 3, time: "2026-06-02 08:00:02", source: "Public Procurement Portal", action: "Scraping completed", items: 8, status: "success", duration: "6.8s" },
    { id: 4, time: "2026-06-02 07:45:00", source: "MoE Job Portal", action: "Connection timeout (retry 2/3)", items: 0, status: "warning", duration: "30s" },
    { id: 5, time: "2026-06-02 07:15:00", source: "MoE Job Portal", action: "Connection timeout (retry 1/3)", items: 0, status: "warning", duration: "30s" },
    { id: 6, time: "2026-06-02 06:30:00", source: "MoE Job Portal", action: "Failed: ECONNREFUSED", items: 0, status: "error", duration: "0.1s" },
    { id: 7, time: "2026-06-02 06:00:00", source: "Scheduler", action: "Daily scraping cycle initiated for 4 sources", items: 0, status: "info", duration: "-" },
    { id: 8, time: "2026-06-01 22:05:12", source: "PSC Official Website", action: "Scraping completed", items: 3, status: "success", duration: "3.1s" },
    { id: 9, time: "2026-06-01 22:00:00", source: "PSC Official Website", action: "Scraping started", items: 0, status: "info", duration: "-" },
    { id: 10, time: "2026-06-01 18:00:00", source: "Public Procurement Portal", action: "Scraping completed", items: 5, status: "success", duration: "5.4s" },
  ]

  const configSettings = {
    globalTimeout: 30,
    maxRetries: 3,
    retryDelay: 15,
    concurrentJobs: 2,
    userAgent: "SuchanaAI-Scraper/1.0",
    respectRobotsTxt: true,
    rateLimitDelay: 2,
    maxItemsPerRun: 100,
    autoCategorizaton: true,
    notifyOnError: true,
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Web Scraping</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage automated notice collection</p>
          </div>
          <Button className="gap-2">
            <Plus className="size-4" /> Add Source
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Sources", value: mockScrapingSources.filter(s => s.status === "active").length, icon: Globe, color: "text-indigo-600" },
            { label: "Total Items", value: mockScrapingSources.reduce((s, src) => s + src.itemsScraped, 0).toLocaleString(), icon: Activity, color: "text-blue-600" },
            { label: "Errors", value: mockScrapingSources.filter(s => s.status === "error").length, icon: AlertCircle, color: "text-red-600" },
            { label: "Next Run", value: "12 min", icon: Clock, color: "text-red-600" },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`size-5 ${stat.color}`} />
                  <div>
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {[
            { id: "sources" as const, label: "Sources", icon: Globe },
            { id: "logs" as const, label: "Logs", icon: Terminal },
            { id: "config" as const, label: "Configuration", icon: Settings },
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

        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockScrapingSources.map((source) => (
              <Card key={source.id} className={`hover:border-primary/20 transition-all ${source.status === "error" ? "border-destructive/30" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{source.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{source.url}</p>
                    </div>
                    <Badge variant={
                      source.status === "active" ? "secondary" :
                      source.status === "error" ? "destructive" : "outline"
                    } className={source.status === "active" ? "text-green-600 bg-green-500/10" : ""}>
                      {source.status === "active" && <CheckCircle className="size-3 mr-1" />}
                      {source.status === "error" && <AlertCircle className="size-3 mr-1" />}
                      {source.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                    <div>
                      <span className="text-muted-foreground">Frequency</span>
                      <p className="font-medium">{source.frequency}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category</span>
                      <p className="font-medium capitalize">{source.category}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items</span>
                      <p className="font-medium">{source.itemsScraped.toLocaleString()}</p>
                    </div>
                  </div>
                  {source.lastRun && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Last run: {new Date(source.lastRun).toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Play className="size-3" /> Run
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <Pause className="size-3" /> Pause
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <Edit className="size-3" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scraping Logs</CardTitle>
                  <CardDescription>Real-time activity feed from all scraping jobs</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="size-3.5" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {scrapingLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/30 font-mono text-xs">
                    {log.status === "success" ? (
                      <CheckCircle className="size-3.5 text-indigo-500 shrink-0" />
                    ) : log.status === "error" ? (
                      <XCircle className="size-3.5 text-destructive shrink-0" />
                    ) : log.status === "warning" ? (
                      <AlertCircle className="size-3.5 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-muted-foreground w-36 shrink-0">{log.time}</span>
                    <span className="text-muted-foreground w-44 shrink-0 truncate">{log.source}</span>
                    <span className="flex-1 truncate">{log.action}</span>
                    {log.items > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{log.items} items</Badge>
                    )}
                    <span className="text-muted-foreground w-12 text-right">{log.duration}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Network Settings</CardTitle>
                <CardDescription>Connection and retry behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Request Timeout", value: `${configSettings.globalTimeout}s`, desc: "Max wait time per request" },
                  { label: "Max Retries", value: configSettings.maxRetries.toString(), desc: "Attempts before marking failed" },
                  { label: "Retry Delay", value: `${configSettings.retryDelay}s`, desc: "Wait between retry attempts" },
                  { label: "Concurrent Jobs", value: configSettings.concurrentJobs.toString(), desc: "Parallel scraping tasks" },
                  { label: "Rate Limit Delay", value: `${configSettings.rateLimitDelay}s`, desc: "Delay between requests to same host" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{item.value}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Settings</CardTitle>
                <CardDescription>Content handling and automation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "User Agent", value: configSettings.userAgent, desc: "HTTP User-Agent header" },
                  { label: "Max Items Per Run", value: configSettings.maxItemsPerRun.toString(), desc: "Limit items per scraping job" },
                  { label: "Respect robots.txt", value: configSettings.respectRobotsTxt ? "Yes" : "No", desc: "Honor site scraping rules" },
                  { label: "Auto-Categorization", value: configSettings.autoCategorizaton ? "Enabled" : "Disabled", desc: "AI-powered category assignment" },
                  { label: "Error Notifications", value: configSettings.notifyOnError ? "Enabled" : "Disabled", desc: "Alert admin on failures" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] max-w-[140px] truncate">{item.value}</Badge>
                  </div>
                ))}
                <Button className="w-full mt-2">Save Configuration</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
