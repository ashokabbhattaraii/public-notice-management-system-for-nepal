"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import {
  Play,
  Plus,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Globe,
  Activity,
  Trash2,
  Edit,
  Loader2,
  X,
  Ban,
  PlayCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import {
  fetchScrapeSources,
  createScrapeSource,
  updateScrapeSource,
  deleteScrapeSource,
  runScrapeSource,
  fetchScrapeRuns,
  fetchScrapeRunProgress,
} from "@/lib/api"
import type { ScrapeSource, ScrapeRun, ScrapePaginationType, ScrapeRunProgress } from "@/lib/types"

interface SourceFormState {
  id?: string
  name: string
  baseUrl: string
  noticeListUrl: string
  newsListUrl: string
  paginationType: ScrapePaginationType
  paginationParam: string
  startPage: number
  maxPages: number
}

const emptyForm: SourceFormState = {
  name: "",
  baseUrl: "",
  noticeListUrl: "",
  newsListUrl: "",
  paginationType: "QUERY_PARAM",
  paginationParam: "page",
  startPage: 1,
  maxPages: 3,
}

const PROGRESS_POLL_MS = 1200

export default function AdminScrapingPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "logs">("sources")
  const [sources, setSources] = useState<ScrapeSource[]>([])
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [progressBySource, setProgressBySource] = useState<Record<string, ScrapeRunProgress>>({})
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<SourceFormState>(emptyForm)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [sourcesData, runsData] = await Promise.all([
        fetchScrapeSources(),
        fetchScrapeRuns(undefined, 30),
      ])
      setSources(sourcesData)
      setRuns(runsData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scraping data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    // Stop all pollers on unmount.
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval)
    }
  }, [])

  function openCreateDialog() {
    setForm(emptyForm)
    setShowAdvanced(false)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(source: ScrapeSource) {
    setForm({
      id: source.id,
      name: source.name,
      baseUrl: source.baseUrl,
      noticeListUrl: source.noticeListUrl ?? "",
      newsListUrl: source.newsListUrl ?? "",
      paginationType: source.paginationType,
      paginationParam: source.paginationParam,
      startPage: source.startPage,
      maxPages: source.maxPages,
    })
    setShowAdvanced(source.paginationType !== "QUERY_PARAM" || source.startPage !== 1 || source.maxPages !== 3)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.noticeListUrl && !form.newsListUrl) {
      setFormError("Provide at least one of Notice URL or News URL")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name,
        baseUrl: form.baseUrl,
        noticeListUrl: form.noticeListUrl || undefined,
        newsListUrl: form.newsListUrl || undefined,
        paginationType: form.paginationType,
        paginationParam: form.paginationParam || "page",
        startPage: form.startPage,
        maxPages: form.maxPages,
      }
      if (form.id) {
        await updateScrapeSource(form.id, payload)
      } else {
        await createScrapeSource(payload)
      }
      setDialogOpen(false)
      await loadAll()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save source")
    } finally {
      setSaving(false)
    }
  }

  function stopPolling(sourceId: string) {
    const timer = pollTimers.current[sourceId]
    if (timer) {
      clearInterval(timer)
      delete pollTimers.current[sourceId]
    }
  }

  function pollProgress(sourceId: string, runId: string) {
    stopPolling(sourceId)
    pollTimers.current[sourceId] = setInterval(async () => {
      try {
        const progress = await fetchScrapeRunProgress(runId)
        setProgressBySource((prev) => ({ ...prev, [sourceId]: progress }))
        if (progress.stage === "done" || progress.stage === "failed") {
          stopPolling(sourceId)
          setRunningIds((prev) => {
            const next = new Set(prev)
            next.delete(sourceId)
            return next
          })
          await loadAll()
        }
      } catch {
        // Transient poll failure — keep trying until the interval is cleared.
      }
    }, PROGRESS_POLL_MS)
  }

  async function handleRun(id: string) {
    setRunningIds((prev) => new Set(prev).add(id))
    setProgressBySource((prev) => ({ ...prev, [id]: { run_id: "", stage: "running", messages: [], error: null } }))
    setError(null)
    try {
      const { runId } = await runScrapeSource(id)
      pollProgress(id, runId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape run failed")
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleToggleEnabled(source: ScrapeSource) {
    try {
      await updateScrapeSource(source.id, { enabled: !source.enabled })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update source")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this source? Its scraped items and run history will also be removed.")) return
    try {
      await deleteScrapeSource(id)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete source")
    }
  }

  const activeSources = sources.filter((s) => s.enabled).length
  const totalItems = sources.reduce((sum, s) => sum + s.itemCount, 0)
  const erroredSources = sources.filter((s) => s.lastStatus === "FAILED").length

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Web scraping.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">
              Add any government or public website — notice/news listings are detected and scraped automatically
            </p>
          </div>
          <button
            onClick={openCreateDialog}
            className="flex items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Add source
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Active sources", value: activeSources, icon: Globe },
            { label: "Total sources", value: sources.length, icon: Terminal },
            { label: "Scraped items", value: totalItems.toLocaleString(), icon: Activity },
            { label: "Errors", value: erroredSources, icon: AlertCircle },
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

        {/* Tabs - pill style */}
        <div className="mb-6 flex w-fit items-center gap-1 rounded-full bg-white p-1.5">
          {[
            { id: "sources" as const, label: "Sources", icon: Globe },
            { id: "logs" as const, label: "Logs", icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                  activeTab === tab.id ? "bg-vez-navy text-white" : "text-vez-mute hover:text-vez-navy"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-vez-mute">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {/* Sources Tab */}
            {activeTab === "sources" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sources.length === 0 && (
                  <div className="col-span-full rounded-[20px] bg-white p-10 text-center text-sm text-vez-mute">
                    No sources yet. Click "Add source" to start scraping a government or public website.
                  </div>
                )}
                {sources.map((source) => {
                  const isRunning = runningIds.has(source.id)
                  const categories = [
                    source.noticeListUrl && "Notice",
                    source.newsListUrl && "News",
                  ].filter(Boolean).join(" + ")
                  const progress = progressBySource[source.id]
                  const paginationLabel =
                    source.paginationType === "NONE"
                      ? "Single page"
                      : source.paginationType === "PATH_TEMPLATE"
                        ? `Path template · up to ${source.maxPages} pages`
                        : `?${source.paginationParam}=N · up to ${source.maxPages} pages`

                  return (
                    <div key={source.id} className="rounded-[20px] bg-white p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-base text-vez-ink">{source.name}</h3>
                          <p className="mt-0.5 max-w-[260px] truncate text-xs text-vez-mute">{source.baseUrl}</p>
                        </div>
                        <span
                          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs capitalize ${
                            !source.enabled
                              ? "border border-vez-line text-vez-mute"
                              : source.lastStatus === "FAILED"
                                ? "bg-red-50 text-red-600"
                                : "bg-vez-sky/30 text-vez-navy"
                          }`}
                        >
                          {!source.enabled ? (
                            <Ban className="size-3" />
                          ) : source.lastStatus === "FAILED" ? (
                            <AlertCircle className="size-3" />
                          ) : (
                            <CheckCircle className="size-3" />
                          )}
                          {!source.enabled ? "disabled" : source.lastStatus?.toLowerCase() ?? "not run yet"}
                        </span>
                      </div>
                      <div className="mb-4 grid grid-cols-2 gap-3 rounded-[14px] bg-vez-surface px-4 py-3 text-xs">
                        <div>
                          <span className="text-vez-mute">Category</span>
                          <p className="mt-0.5 text-vez-ink">{categories || "—"}</p>
                        </div>
                        <div>
                          <span className="text-vez-mute">Items scraped</span>
                          <p className="mt-0.5 text-vez-ink">{source.itemCount.toLocaleString()}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-vez-mute">Pagination</span>
                          <p className="mt-0.5 text-vez-ink">{paginationLabel}</p>
                        </div>
                      </div>
                      {source.lastRunAt && !isRunning && (
                        <p className="mb-4 text-xs text-vez-mute">
                          Last run: {new Date(source.lastRunAt).toLocaleString()}
                        </p>
                      )}

                      {/* Live progress messages while a run is in flight */}
                      {isRunning && progress && (
                        <div className="mb-4 max-h-32 space-y-1 overflow-y-auto rounded-[12px] bg-vez-navy/[0.04] px-3 py-2.5 text-xs">
                          {progress.messages.length === 0 ? (
                            <p className="flex items-center gap-1.5 text-vez-mute">
                              <Loader2 className="size-3 animate-spin" /> Starting…
                            </p>
                          ) : (
                            progress.messages.slice(-6).map((m, i) => (
                              <p key={i} className="truncate text-vez-mute">
                                {m.text}
                              </p>
                            ))
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRun(source.id)}
                          disabled={isRunning || !source.enabled}
                          className="flex items-center gap-1.5 rounded-full bg-vez-navy px-4 py-2 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {isRunning ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                          {isRunning ? "Scraping…" : "Run now"}
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(source)}
                          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                        >
                          {source.enabled ? <Ban className="size-3" /> : <PlayCircle className="size-3" />}
                          {source.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => openEditDialog(source)}
                          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                        >
                          <Edit className="size-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="flex size-8 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete source"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === "logs" && (
              <div className="rounded-[20px] bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg text-vez-ink">Scraping logs</h2>
                    <p className="mt-0.5 text-sm text-vez-mute">Run history across all sources</p>
                  </div>
                  <button
                    onClick={loadAll}
                    className="flex items-center gap-1.5 rounded-full border border-vez-line px-4 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
                  >
                    Refresh
                  </button>
                </div>
                {runs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-vez-mute">No scrape runs yet.</p>
                ) : (
                  <div className="space-y-1">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-xs transition-colors hover:bg-vez-surface"
                      >
                        {run.status === "SUCCESS" ? (
                          <CheckCircle className="size-3.5 shrink-0 text-vez-navy" />
                        ) : run.status === "FAILED" ? (
                          <XCircle className="size-3.5 shrink-0 text-red-500" />
                        ) : (
                          <Clock className="size-3.5 shrink-0 text-vez-mute" />
                        )}
                        <span className="w-36 shrink-0 text-vez-mute tabular-nums">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                        <span className="w-44 shrink-0 truncate text-vez-mute">{run.sourceLabel}</span>
                        <span className="flex-1 truncate text-vez-ink">
                          {run.status === "FAILED"
                            ? run.error ?? "Scrape failed"
                            : run.status === "RUNNING"
                              ? "Scraping…"
                              : "Scrape completed"}
                        </span>
                        {run.itemsFound > 0 && (
                          <span className="rounded-full bg-vez-sky/30 px-2.5 py-0.5 text-[10px] text-vez-navy">
                            {run.itemsNew} new · {run.itemsFound} found
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Add/Edit source dialog */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[20px] bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg text-vez-ink">{form.id ? "Edit source" : "Add source"}</h2>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full text-vez-mute hover:bg-vez-surface"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-vez-mute">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Ministry of Home Affairs"
                    className="w-full rounded-[10px] border border-vez-line px-3 py-2 text-sm outline-none focus:border-vez-navy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vez-mute">Website base URL</label>
                  <input
                    required
                    type="url"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://example.gov.np"
                    className="w-full rounded-[10px] border border-vez-line px-3 py-2 text-sm outline-none focus:border-vez-navy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vez-mute">Notice listing page URL (optional)</label>
                  <input
                    type="url"
                    value={form.noticeListUrl}
                    onChange={(e) => setForm({ ...form, noticeListUrl: e.target.value })}
                    placeholder="https://example.gov.np/notices"
                    className="w-full rounded-[10px] border border-vez-line px-3 py-2 text-sm outline-none focus:border-vez-navy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-vez-mute">News listing page URL (optional)</label>
                  <input
                    type="url"
                    value={form.newsListUrl}
                    onChange={(e) => setForm({ ...form, newsListUrl: e.target.value })}
                    placeholder="https://example.gov.np/news"
                    className="w-full rounded-[10px] border border-vez-line px-3 py-2 text-sm outline-none focus:border-vez-navy"
                  />
                </div>
                <p className="text-xs text-vez-mute">
                  Provide at least one listing URL. The extraction pattern (title, link, date) is detected
                  automatically on the first run and cached for future runs.
                </p>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center gap-1.5 rounded-[10px] border border-vez-line px-3 py-2 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
                >
                  {showAdvanced ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  Advanced: pagination
                </button>

                {showAdvanced && (
                  <div className="space-y-3 rounded-[12px] bg-vez-surface px-4 py-3.5">
                    <div>
                      <label className="mb-1 block text-xs text-vez-mute">Pagination style</label>
                      <select
                        value={form.paginationType}
                        onChange={(e) =>
                          setForm({ ...form, paginationType: e.target.value as ScrapePaginationType })
                        }
                        className="h-10 w-full rounded-[10px] border border-vez-line bg-white px-3 text-sm outline-none focus:border-vez-navy"
                      >
                        <option value="QUERY_PARAM">Query parameter (?page=2, ?start=20, …)</option>
                        <option value="PATH_TEMPLATE">Path template ({"{page}"} placeholder in the URL)</option>
                        <option value="NONE">No pagination — single page only</option>
                      </select>
                    </div>
                    {form.paginationType === "QUERY_PARAM" && (
                      <div>
                        <label className="mb-1 block text-xs text-vez-mute">Query parameter name</label>
                        <input
                          value={form.paginationParam}
                          onChange={(e) => setForm({ ...form, paginationParam: e.target.value })}
                          placeholder="page"
                          className="h-10 w-full rounded-[10px] border border-vez-line bg-white px-3 text-sm outline-none focus:border-vez-navy"
                        />
                      </div>
                    )}
                    {form.paginationType === "PATH_TEMPLATE" && (
                      <p className="text-xs text-vez-mute">
                        Put a literal <code className="rounded bg-white px-1">{"{page}"}</code> token in the listing
                        URL above, e.g. <code className="rounded bg-white px-1">.../notices/page/{"{page}"}/</code>
                      </p>
                    )}
                    {form.paginationType !== "NONE" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-vez-mute">Start page number</label>
                          <input
                            type="number"
                            min={0}
                            value={form.startPage}
                            onChange={(e) => setForm({ ...form, startPage: Number(e.target.value) || 1 })}
                            className="h-10 w-full rounded-[10px] border border-vez-line bg-white px-3 text-sm outline-none focus:border-vez-navy"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-vez-mute">Max pages per run</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={form.maxPages}
                            onChange={(e) => setForm({ ...form, maxPages: Number(e.target.value) || 1 })}
                            className="h-10 w-full rounded-[10px] border border-vez-line bg-white px-3 text-sm outline-none focus:border-vez-navy"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {formError && <p className="text-xs text-red-600">{formError}</p>}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="size-3.5 animate-spin" />}
                    {form.id ? "Save changes" : "Add source"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    className="rounded-full px-5 py-2.5 text-sm text-vez-mute transition-colors hover:bg-vez-surface"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
