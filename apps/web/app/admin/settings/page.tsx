"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Database,
  Minus,
  Plus,
  ChevronDown,
  X,
  Timer,
  CalendarClock,
  Info,
} from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import {
  fetchSettings,
  updateSettings,
  resetSetting,
} from "@/lib/api"
import { SettingField, SettingGroup, SettingsView } from "@/lib/types"
import {
  parseCron,
  cronNextOccurrences,
  formatRelativeSeconds,
} from "@/lib/cron-utils"

const inputClass =
  "h-11 w-full rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

interface ServerError {
  key: string
  message: string
}

export default function AdminSettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<{
    ok: boolean
    text: string
  } | null>(null)
  const [serverErrors, setServerErrors] = useState<ServerError[]>([])
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchSettings()
      setView(data)
      setDraft({})
      setErrors({})
      setActiveGroup((prev) => prev ?? data.groups[0]?.id ?? null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load settings")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byKey = useMemo(() => {
    const map = new Map<string, SettingField>()
    view?.settings.forEach((s) => map.set(s.key, s))
    return map
  }, [view])

  const groupOf = useCallback(
    (key: string) => byKey.get(key)?.group ?? null,
    [byKey],
  )

  /** Persisted (server) value for a key. */
  const serverValue = useCallback(
    (key: string) => byKey.get(key)?.value ?? "",
    [byKey],
  )

  const dirtyKeys = useMemo(() => {
    if (!view) return []
    return view.settings
      .filter((s) => draft[s.key] !== undefined && draft[s.key] !== s.value)
      .map((s) => s.key)
  }, [view, draft])

  const isDirty = (key: string) => draft[key] !== undefined && draft[key] !== serverValue(key)

  const filteredGroups = useMemo(() => {
    if (!view) return []
    const q = search.trim().toLowerCase()
    return view.groups
      .map((g) => ({
        ...g,
        fields: view.settings.filter(
          (s) =>
            s.group === g.id &&
            (!q ||
              s.label.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              s.key.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.fields.length > 0)
  }, [view, search])

  const dirtyCount = dirtyKeys.length

  /** Client-side validation mirroring the backend rules. */
  const validateField = useCallback(
    (field: SettingField, value: string): string | null => {
      switch (field.type) {
        case "boolean":
          return value === "true" || value === "false" ? null : "Expected true or false."
        case "number": {
          const n = Number(value)
          if (!Number.isFinite(n)) return "Expected a number."
          if (field.min !== undefined && n < field.min) return `Minimum is ${field.min}.`
          if (field.max !== undefined && n > field.max) return `Maximum is ${field.max}.`
          if (field.step !== undefined && field.step > 1) {
            const base = (n - (field.min ?? 0)) / field.step
            if (Math.abs(base - Math.round(base)) > 1e-6) return `Multiple of ${field.step} required.`
          }
          return null
        }
        case "cron": {
          const res = parseCron(value)
          return res.ok ? null : (res.errors[0]?.message ?? "Invalid cron expression.")
        }
        case "select":
          return field.options?.some((o) => o.value === value)
            ? null
            : "Pick one of the available options."
        case "text":
        case "textarea":
          return value.trim().length ? null : "Cannot be empty."
        default:
          return null
      }
    },
    [],
  )

  const setValue = (key: string, value: string) => {
    const field = byKey.get(key)
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => {
      if (!field) return e
      const next = { ...e }
      const err = validateField(field, value)
      if (err) next[key] = err
      else delete next[key]
      return next
    })
  }

  const visibleErrorCount = useMemo(
    () => dirtyKeys.filter((k) => errors[k]).length,
    [dirtyKeys, errors],
  )

  const submit = async () => {
    if (!dirtyCount || saving) return

    // Validate every dirty key before sending.
    const invalid = dirtyKeys.filter((k) => {
      const f = byKey.get(k)
      return f ? !!validateField(f, draft[k]) : true
    })
    if (invalid.length) {
      const nextErrors: Record<string, string> = {}
      invalid.forEach((k) => {
        const f = byKey.get(k)
        nextErrors[k] = f ? (validateField(f, draft[k]) ?? "Invalid value.") : "Invalid value."
      })
      setErrors((e) => ({ ...e, ...nextErrors }))
      setSaveFeedback({
        ok: false,
        text: `${invalid.length} field${invalid.length > 1 ? "s" : ""} need attention before saving.`,
      })
      const first = byKey.get(invalid[0])
      const target = first ? first.group : null
      if (target) scrollToGroup(target)
      return
    }

    setSaving(true)
    setServerErrors([])
    setSaveFeedback(null)
    try {
      const values: Record<string, string> = {}
      dirtyKeys.forEach((k) => (values[k] = draft[k]))
      const result = await updateSettings(values)
      const appliedText =
        result.applied.length === 1
          ? `Saved "${byKey.get(result.applied[0].key)?.label ?? result.applied[0].key}"`
          : `Saved ${result.applied.length} settings.`
      const sched = result.runtime?.scheduler
      const schedulerNote = sched
        ? ` Scheduler re-applied: cron "${sched.cron}", concurrency ${sched.concurrency}.`
        : ""
      setSaveFeedback({ ok: true, text: appliedText + schedulerNote })
      if (result.errors.length) setServerErrors(result.errors)
      setView(result)
      setDraft({})
      setErrors({})
    } catch (err) {
      setSaveFeedback({ ok: false, text: err instanceof Error ? err.message : "Save failed." })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setDraft({})
    setErrors({})
    setSaveFeedback(null)
    setServerErrors([])
  }

  const doReset = async (key: string) => {
    try {
      await resetSetting(key)
      setSaveFeedback({ ok: true, text: `"${byKey.get(key)?.label ?? key}" reset to its default.` })
      setDraft((d) => {
        const next = { ...d }
        delete next[key]
        return next
      })
      setErrors((e) => {
        const next = { ...e }
        delete next[key]
        return next
      })
      await load(true)
    } catch (err) {
      setSaveFeedback({ ok: false, text: err instanceof Error ? err.message : "Reset failed." })
    }
  }

  const scrollToGroup = (groupId: string) => {
    setActiveGroup(groupId)
    groupRefs.current[groupId]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              Settings.
            </h1>
            <p className="mt-2 text-sm text-vez-mute">
              Runtime configuration — persisted in the database, applied without a restart
            </p>
          </div>
          {view && (
            <div className="flex items-center gap-2 rounded-full border border-vez-line bg-white px-4 py-2 text-xs text-vez-mute">
              <Database className="size-3.5 text-vez-navy" />
              app_settings · {view.settings.filter((s) => s.overridden).length} overrides active
            </div>
          )}
        </div>

        {loadError && (
          <div className="mb-6 flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" />
            Could not load settings — {loadError}
            <button onClick={() => load()} className="ml-auto font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* ── Left rail ─────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-0 lg:h-fit">
            <div className="rounded-[20px] bg-white p-4">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search settings…"
                  className="h-10 w-full rounded-full border border-vez-line bg-white pl-10 pr-4 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-vez-mute hover:text-vez-ink"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {view?.groups.map((g) => {
                  const shown = filteredGroups.some((fg) => fg.id === g.id)
                  const dirtyInGroup = view.settings.filter(
                    (s) => s.group === g.id && isDirty(s.key),
                  ).length
                  return (
                    <button
                      key={g.id}
                      onClick={() => scrollToGroup(g.id)}
                      className={`flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-sm transition-colors ${
                        activeGroup === g.id
                          ? "bg-vez-navy text-white"
                          : "text-vez-mute hover:bg-vez-surface hover:text-vez-navy"
                      } ${search && !shown ? "opacity-40" : ""}`}
                    >
                      <span className="flex-1 text-left">{g.label}</span>
                      {dirtyInGroup > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-medium text-white">
                          {dirtyInGroup}
                        </span>
                      )}
                      {g.changed > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            activeGroup === g.id ? "bg-white/20 text-white" : "bg-vez-navy/10 text-vez-navy"
                          }`}
                        >
                          {g.changed}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 rounded-[14px] bg-vez-surface px-4 py-3 text-xs text-vez-mute">
                <p className="flex items-center gap-1.5 text-vez-ink">
                  <Info className="size-3.5" /> How this works
                </p>
                <p className="mt-1 leading-relaxed">
                  Values marked with a number chip are overrides. Reset restores the built-in
                  default. Scraping changes are applied to the live scheduler immediately.
                </p>
              </div>
            </div>
          </aside>

          {/* ── Main column ───────────────────────────────────────── */}
          <div className="min-w-0">
            {loading && (
              <div className="flex items-center gap-3 rounded-[20px] bg-white p-10 text-sm text-vez-mute">
                <Loader2 className="size-4 animate-spin text-vez-navy" /> Loading settings…
              </div>
            )}

            {!loading && !view && (
              <div className="rounded-[20px] bg-white p-10 text-center text-sm text-vez-mute">
                No settings available.
              </div>
            )}

            {!loading && view && filteredGroups.length === 0 && (
              <div className="rounded-[20px] bg-white p-10 text-center text-sm text-vez-mute">
                No settings match “{search}”.
              </div>
            )}

            {!loading &&
              view &&
              filteredGroups.map((g) => (
                <div
                  key={g.id}
                  ref={(el) => {
                    groupRefs.current[g.id] = el
                  }}
                  className="mb-6 scroll-mt-4"
                >
                  <div className="mb-3 flex items-baseline justify-between px-1">
                    <h2 className="text-lg text-vez-ink">{g.label}</h2>
                    {g.fields.some((s) => isDirty(s.key)) && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-medium text-amber-700">
                        unsaved changes
                      </span>
                    )}
                  </div>
                  <p className="mb-4 px-1 text-sm text-vez-mute">{g.description}</p>

                  <div className="overflow-hidden rounded-[20px] bg-white">
                    {g.fields.map((field, i) => (
                      <div
                        key={field.key}
                        className={`relative flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between ${
                          i > 0 ? "border-t border-vez-line" : ""
                        } ${isDirty(field.key) ? "bg-amber-50/50" : ""}`}
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-vez-ink">{field.label}</p>
                            {field.overridden ? (
                              <span className="rounded-full bg-vez-navy/10 px-2 py-0.5 text-[10px] text-vez-navy">
                                Changed
                              </span>
                            ) : (
                              <span className="rounded-full bg-vez-surface px-2 py-0.5 text-[10px] text-vez-mute">
                                Default
                              </span>
                            )}
                            {isDirty(field.key) && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                unsaved
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-vez-mute">
                            {field.description}
                          </p>
                          {field.type === "cron" && <CronPreview value={draft[field.key] ?? field.value} />}
                          {errors[field.key] && (
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle className="size-3.5" /> {errors[field.key]}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-3 md:justify-end">
                          <FieldInput field={field} value={draft[field.key] ?? field.value} onChange={(v) => setValue(field.key, v)} />
                          {field.overridden && (
                            <button
                              onClick={() => doReset(field.key)}
                              title="Reset to default"
                              className="flex size-9 items-center justify-center rounded-full border border-vez-line text-vez-mute transition-colors hover:border-vez-navy/30 hover:text-vez-navy"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {/* Save bar */}
            {view && (
              <div className="sticky bottom-4 z-10 mt-8">
                <div
                  className={`flex flex-wrap items-center gap-3 rounded-[20px] border p-4 shadow-lg shadow-vez-navy/5 ${
                    dirtyCount > 0 ? "border-amber-200 bg-white" : "border-vez-line bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {saveFeedback ? (
                      <p
                        className={`flex items-center gap-2 text-sm ${
                          saveFeedback.ok ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {saveFeedback.ok ? (
                          <CheckCircle2 className="size-4 shrink-0" />
                        ) : (
                          <AlertCircle className="size-4 shrink-0" />
                        )}
                        {saveFeedback.text}
                      </p>
                    ) : dirtyCount > 0 ? (
                      <p className="text-sm text-vez-ink">
                        <span className="font-medium text-amber-700">{dirtyCount}</span> unsaved
                        change{dirtyCount > 1 ? "s" : ""}
                        {visibleErrorCount > 0 && (
                          <span className="ml-2 text-red-600">
                            · {visibleErrorCount} invalid
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-vez-mute">
                        <CheckCircle2 className="size-4 text-green-600" /> All settings saved —
                        persisted to the database.
                      </p>
                    )}
                    {serverErrors.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                        {serverErrors.map((e) => (
                          <li key={e.key}>
                            {byKey.get(e.key)?.label ?? e.key}: {e.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={discard}
                      disabled={!dirtyCount || saving}
                      className="flex items-center gap-2 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X className="size-4" /> Discard
                    </button>
                    <button
                      onClick={submit}
                      disabled={!dirtyCount || saving || visibleErrorCount > 0}
                      className="flex items-center gap-2 rounded-full bg-vez-navy px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </div>
  )
}

/* ── Field input by type ─────────────────────────────────────────────── */

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SettingField
  value: string
  onChange: (v: string) => void
}) {
  if (field.type === "boolean") {
    const on = value === "true"
    return (
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(on ? "false" : "true")}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-vez-navy" : "bg-vez-line"
        }`}
      >
        <span
          className={`inline-block size-6 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    )
  }

  if (field.type === "number") {
    const num = Number(value)
    const canMinus = field.min === undefined || Number.isNaN(num) || num > field.min
    const canPlus = field.max === undefined || Number.isNaN(num) || num < field.max
    const step = field.step ?? 1
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(String(Math.max(field.min ?? 0, (Number.isFinite(num) ? num : 0) - step)))}
          disabled={!canMinus}
          className="flex size-9 items-center justify-center rounded-full border border-vez-line text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-40"
          aria-label="Decrease"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={field.min}
          max={field.max}
          step={field.step}
          className="h-11 w-24 rounded-full border border-vez-line bg-white px-4 text-center text-sm tabular-nums text-vez-ink outline-none transition-colors focus:border-vez-sky"
        />
        <button
          onClick={() => onChange(String((Number.isFinite(num) ? num : 0) + step))}
          disabled={!canPlus}
          className="flex size-9 items-center justify-center rounded-full border border-vez-line text-vez-ink transition-colors hover:bg-vez-surface disabled:opacity-40"
          aria-label="Increase"
        >
          <Plus className="size-4" />
        </button>
        {field.unit && <span className="text-xs text-vez-mute">{field.unit}</span>}
      </div>
    )
  }

  if (field.type === "cron") {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        spellCheck={false}
        className={`h-11 w-56 rounded-full border bg-white px-4 text-sm font-mono tabular-nums outline-none transition-colors sm:w-64 ${
          parseCron(value).ok
            ? "border-vez-line text-vez-ink focus:border-vez-sky"
            : "border-red-300 text-red-600 focus:border-red-400"
        }`}
      />
    )
  }

  if (field.type === "select") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {field.options?.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active ? "bg-vez-navy text-white" : "border border-vez-line text-vez-ink hover:bg-vez-surface"
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={2}
        className="h-20 w-64 resize-none rounded-[14px] border border-vez-line bg-white px-4 py-2.5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky sm:w-80"
      />
    )
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={inputClass + " w-64 sm:w-80"}
    />
  )
}

/* ── Live cron preview (validity + next runs) ───────────────────────── */

function CronPreview({ value }: { value: string }) {
  const parsed = parseCron(value)
  const now = useMemo(() => new Date(), [])
  const next = useMemo(
    () => (parsed.ok ? cronNextOccurrences(value, now, 3) : []),
    [parsed.ok, value, now],
  )

  if (!parsed.ok) return null

  if (next.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
        <Timer className="size-3.5" /> Valid cron — no future run found in the preview window.
      </p>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-vez-mute">
      <span className="flex items-center gap-1.5 font-medium text-green-700">
        <CheckCircle2 className="size-3.5" /> Valid
      </span>
      <span className="flex items-center gap-1.5">
        <CalendarClock className="size-3.5" /> next runs:
      </span>
      {next.map((d, i) => (
        <span key={i} className="tabular-nums">
          {formatRelativeSeconds(Math.max(0, Math.round((d.getTime() - Date.now()) / 1000)))}
          <span className="text-vez-mute/70"> · </span>
          {d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      ))}
    </div>
  )
}