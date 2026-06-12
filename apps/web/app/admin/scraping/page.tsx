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
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Web scraping.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">Manage automated notice collection</p>
          </div>
          <button className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90">
            <Plus className="size-4" /> Add source
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Active sources", value: mockScrapingSources.filter(s => s.status === "active").length, icon: Globe },
            { label: "Total items", value: mockScrapingSources.reduce((s, src) => s + src.itemsScraped, 0).toLocaleString(), icon: Activity },
            { label: "Errors", value: mockScrapingSources.filter(s => s.status === "error").length, icon: AlertCircle },
            { label: "Next run", value: "12 min", icon: Clock },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="flex items-center gap-3.5 rounded-[16px] bg-white p-5">
                <div className="flex size-10 items-center justify-center rounded-full bg-vez-sky/30">
                  <Icon className="size-4 text-vez-navy" />
                </div>
                <div>
                  <p className="text-xl text-vez-ink tabular-nums">{stat.value}</p>
                  <p className="text-xs text-vez-mute">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabs — pill style */}
        <div className="mb-6 flex w-fit items-center gap-1 rounded-full bg-white p-1.5">
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

        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mockScrapingSources.map((source) => (
              <div key={source.id} className="rounded-[20px] bg-white p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-base text-vez-ink">{source.name}</h3>
                    <p className="mt-0.5 max-w-[220px] truncate text-xs text-vez-mute">{source.url}</p>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs capitalize ${
                    source.status === "active" ? "bg-vez-sky/30 text-vez-navy" :
                    source.status === "error" ? "bg-red-50 text-red-600" :
                    "border border-vez-line text-vez-mute"
                  }`}>
                    {source.status === "active" && <CheckCircle className="size-3" />}
                    {source.status === "error" && <AlertCircle className="size-3" />}
                    {source.status}
                  </span>
                </div>
                <div className="mb-4 grid grid-cols-3 gap-3 rounded-[14px] bg-vez-surface px-4 py-3 text-xs">
                  <div>
                    <span className="text-vez-mute">Frequency</span>
                    <p className="mt-0.5 text-vez-ink">{source.frequency}</p>
                  </div>
                  <div>
                    <span className="text-vez-mute">Category</span>
                    <p className="mt-0.5 capitalize text-vez-ink">{source.category}</p>
                  </div>
                  <div>
                    <span className="text-vez-mute">Items</span>
                    <p className="mt-0.5 text-vez-ink">{source.itemsScraped.toLocaleString()}</p>
                  </div>
                </div>
                {source.lastRun && (
                  <p className="mb-4 text-xs text-vez-mute">
                    Last run: {new Date(source.lastRun).toLocaleString()}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-full bg-vez-navy px-4 py-2 text-xs text-white transition-opacity hover:opacity-90">
                    <Play className="size-3" /> Run
                  </button>
                  <button className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy">
                    <Pause className="size-3" /> Pause
                  </button>
                  <button className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy">
                    <Edit className="size-3" /> Edit
                  </button>
                  <button className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Delete source">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="rounded-[20px] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg text-vez-ink">Scraping logs</h2>
                <p className="mt-0.5 text-sm text-vez-mute">Real-time activity feed from all scraping jobs</p>
              </div>
              <button className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface">
                <RefreshCw className="size-3.5" /> Refresh
              </button>
            </div>
            <div className="space-y-1">
              {scrapingLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-xs transition-colors hover:bg-vez-surface">
                  {log.status === "success" ? (
                    <CheckCircle className="size-3.5 shrink-0 text-vez-navy" />
                  ) : log.status === "error" ? (
                    <XCircle className="size-3.5 shrink-0 text-red-500" />
                  ) : log.status === "warning" ? (
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <Clock className="size-3.5 shrink-0 text-vez-mute" />
                  )}
                  <span className="w-36 shrink-0 text-vez-mute tabular-nums">{log.time}</span>
                  <span className="w-44 shrink-0 truncate text-vez-mute">{log.source}</span>
                  <span className="flex-1 truncate text-vez-ink">{log.action}</span>
                  {log.items > 0 && (
                    <span className="rounded-full bg-vez-sky/30 px-2.5 py-0.5 text-[10px] text-vez-navy">{log.items} items</span>
                  )}
                  <span className="w-12 text-right text-vez-mute">{log.duration}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-[20px] bg-white p-6">
              <h2 className="text-lg text-vez-ink">Network settings</h2>
              <p className="mt-0.5 text-sm text-vez-mute">Connection and retry behavior</p>
              <div className="mt-5">
                {[
                  { label: "Request timeout", value: `${configSettings.globalTimeout}s`, desc: "Max wait time per request" },
                  { label: "Max retries", value: configSettings.maxRetries.toString(), desc: "Attempts before marking failed" },
                  { label: "Retry delay", value: `${configSettings.retryDelay}s`, desc: "Wait between retry attempts" },
                  { label: "Concurrent jobs", value: configSettings.concurrentJobs.toString(), desc: "Parallel scraping tasks" },
                  { label: "Rate limit delay", value: `${configSettings.rateLimitDelay}s`, desc: "Delay between requests to same host" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-vez-line/50 py-3 last:border-0">
                    <div>
                      <p className="text-sm text-vez-ink">{item.label}</p>
                      <p className="text-xs text-vez-mute">{item.desc}</p>
                    </div>
                    <span className="rounded-full bg-vez-surface px-3 py-1 text-xs text-vez-ink tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] bg-white p-6">
              <h2 className="text-lg text-vez-ink">Processing settings</h2>
              <p className="mt-0.5 text-sm text-vez-mute">Content handling and automation</p>
              <div className="mt-5">
                {[
                  { label: "User agent", value: configSettings.userAgent, desc: "HTTP User-Agent header" },
                  { label: "Max items per run", value: configSettings.maxItemsPerRun.toString(), desc: "Limit items per scraping job" },
                  { label: "Respect robots.txt", value: configSettings.respectRobotsTxt ? "Yes" : "No", desc: "Honor site scraping rules" },
                  { label: "Auto-categorization", value: configSettings.autoCategorizaton ? "Enabled" : "Disabled", desc: "AI-powered category assignment" },
                  { label: "Error notifications", value: configSettings.notifyOnError ? "Enabled" : "Disabled", desc: "Alert admin on failures" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-vez-line/50 py-3 last:border-0">
                    <div>
                      <p className="text-sm text-vez-ink">{item.label}</p>
                      <p className="text-xs text-vez-mute">{item.desc}</p>
                    </div>
                    <span className="max-w-[140px] truncate rounded-full bg-vez-surface px-3 py-1 text-[10px] text-vez-ink">{item.value}</span>
                  </div>
                ))}
              </div>
              <button className="mt-5 w-full rounded-full bg-vez-navy px-5 py-3 text-sm text-white transition-opacity hover:opacity-90">
                Save configuration
              </button>
            </div>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
