"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Power,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Header } from "@/components/layout/header"
import { SecretInput } from "@/components/admin/secret-input"
import { fetchSettings, updateSettings, resetSetting, fetchAiHealth } from "@/lib/api"
import type { AiHealthSnapshot, SettingField, SettingsView } from "@/lib/types"

/**
 * Maps each LLM provider to the settings keys that configure it. The `id`
 * values match both the AI service's provider ids (llm.PROVIDERS) and the
 * entries in the `ai.providerPriority` ordering, so priority, health and
 * credentials all line up on one card.
 */
const PROVIDERS = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyKey: "ai.geminiApiKey",
    modelKey: "ai.geminiModel",
    help: "aistudio.google.com",
  },
  {
    id: "groq",
    label: "Groq",
    keyKey: "ai.groqApiKey",
    modelKey: "ai.groqModel",
    help: "console.groq.com",
  },
  {
    id: "opencode",
    label: "OpenCode Zen",
    keyKey: "ai.openCodeZenApiKey",
    modelKey: "ai.openCodeZenModel",
    help: "opencode.ai",
  },
] as const

const PRIORITY_KEY = "ai.providerPriority"

export default function AdminAiPage() {
  const [view, setView] = useState<SettingsView | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  const [health, setHealth] = useState<AiHealthSnapshot | null>(null)
  const [checking, setChecking] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setView(await fetchSettings())
      setDraft({})
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load AI settings")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const byKey = useMemo(() => {
    const map = new Map<string, SettingField>()
    view?.settings.forEach((s) => map.set(s.key, s))
    return map
  }, [view])

  const serverValue = (key: string) => byKey.get(key)?.value ?? ""
  const valueOf = (key: string) => draft[key] ?? serverValue(key)
  const isDirty = (key: string) => draft[key] !== undefined && draft[key] !== serverValue(key)

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((k) => isDirty(k)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, view],
  )

  const setValue = (key: string, v: string) => setDraft((d) => ({ ...d, [key]: v }))

  // Priority defaults to every provider in declaration order when the setting
  // has never been saved, so a fresh install still renders a sensible chain.
  const priority = useMemo(() => {
    const raw = valueOf(PRIORITY_KEY)
    const parsed = raw.split(",").map((p) => p.trim()).filter(Boolean)
    return parsed.length ? parsed : PROVIDERS.map((p) => p.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, view])

  const disabled = PROVIDERS.map((p) => p.id).filter((id) => !priority.includes(id))
  const ordered = [...priority, ...disabled]

  const movePriority = (id: string, delta: number) => {
    const next = [...priority]
    const i = next.indexOf(id)
    const target = i + delta
    if (i === -1 || target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    setValue(PRIORITY_KEY, next.join(","))
  }

  const toggleProvider = (id: string) => {
    const next = priority.includes(id)
      ? priority.filter((p) => p !== id)
      : [...priority, id]
    if (!next.length) return // never leave zero providers enabled
    setValue(PRIORITY_KEY, next.join(","))
  }

  const runHealthCheck = async () => {
    setChecking(true)
    setHealthError(null)
    try {
      setHealth(await fetchAiHealth())
      setCheckedAt(new Date())
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Health check failed.")
    } finally {
      setChecking(false)
    }
  }

  const save = async () => {
    if (!dirtyKeys.length || saving) return
    setSaving(true)
    setFeedback(null)
    try {
      const values: Record<string, string> = {}
      dirtyKeys.forEach((k) => (values[k] = draft[k]))
      const result = await updateSettings(values)
      setView(result)
      setDraft({})
      setFeedback(
        result.errors.length
          ? { ok: false, text: result.errors.map((e) => e.message).join(" ") }
          : { ok: true, text: `Saved ${result.applied.length} change${result.applied.length === 1 ? "" : "s"}.` },
      )
      // Any saved change can alter which provider answers, so the previous
      // health result is no longer trustworthy.
      setHealth(null)
      setCheckedAt(null)
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : "Save failed." })
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async (key: string) => {
    try {
      await resetSetting(key)
      setDraft((d) => {
        const next = { ...d }
        delete next[key]
        return next
      })
      await load(true)
      setFeedback({ ok: true, text: "API key removed — the server falls back to its environment variable." })
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : "Could not remove the key." })
    }
  }

  const healthFor = (id: string) => health?.providers.find((p) => p.provider === id)

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />
      <AdminLayout>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,3vw,40px)] font-normal leading-tight tracking-[-0.03em] text-vez-ink">
              AI &amp; Models.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-vez-mute">
              Provider credentials, model names and fallback order. Applied to the AI service within
              a few minutes — no redeploy. Keys are encrypted at rest and never shown again once
              saved.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 flex items-center gap-2 rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" />
            {loadError}
            <button onClick={() => load()} className="ml-auto font-medium underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 rounded-[20px] border border-vez-line bg-white p-10 text-sm text-vez-mute">
            <Loader2 className="size-4 animate-spin text-vez-navy" /> Loading AI settings…
          </div>
        ) : (
          <div className="max-w-6xl space-y-4">
            {/* ── Fallback order + health trigger ─────────────────────── */}
            <section className="overflow-hidden rounded-[20px] border border-vez-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-sm font-medium text-vez-ink">
                    <Sparkles className="size-4 text-vez-navy" /> Fallback order
                  </h2>
                  <p className="mt-1 text-xs text-vez-mute">
                    Tried left to right — the first provider that answers wins.
                  </p>
                </div>
                <button
                  onClick={runHealthCheck}
                  disabled={checking}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {checking ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                  {checking ? "Checking…" : "Run health check"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-vez-line px-6 py-4">
                {priority.map((id, i) => (
                  <React.Fragment key={id}>
                    {i > 0 && <span className="text-vez-mute">→</span>}
                    <span className="flex items-center gap-1.5 rounded-full bg-vez-surface px-3 py-1.5 text-xs text-vez-ink">
                      <span className="flex size-4 items-center justify-center rounded-full bg-vez-navy text-[10px] text-white">
                        {i + 1}
                      </span>
                      {PROVIDERS.find((p) => p.id === id)?.label ?? id}
                    </span>
                  </React.Fragment>
                ))}
                {disabled.length > 0 && (
                  <span className="ml-1 text-xs text-vez-mute">
                    · {disabled.length} disabled
                  </span>
                )}
              </div>

              {checkedAt && (
                <p className="border-t border-vez-line px-6 py-2.5 text-xs text-vez-mute">
                  Checked {checkedAt.toLocaleTimeString()} ·{" "}
                  {health?.healthy ? (
                    <>
                      serving from{" "}
                      <span className="font-medium text-vez-ink">
                        {PROVIDERS.find((p) => p.id === health.activeProvider)?.label ??
                          health?.activeProvider}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-600">
                      no provider answering — AI falls back to non-LLM extractive output
                    </span>
                  )}
                </p>
              )}
              {healthError && (
                <p className="flex items-start gap-2 border-t border-vez-line bg-red-50 px-6 py-2.5 text-xs text-red-600">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {healthError}
                </p>
              )}
              {dirtyKeys.length > 0 && (
                <p className="flex items-start gap-2 border-t border-vez-line bg-amber-50/60 px-6 py-2.5 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Unsaved changes — health results reflect what is saved on the server, not what is
                  on screen.
                </p>
              )}
            </section>

            {/* ── Provider card grid ──────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ordered.map((id) => {
                const provider = PROVIDERS.find((p) => p.id === id)
                if (!provider) return null
                const keyField = byKey.get(provider.keyKey)
                const modelField = byKey.get(provider.modelKey)
                if (!keyField || !modelField) return null

                const isEnabled = priority.includes(id)
                const rank = priority.indexOf(id)
                const h = healthFor(id)
                const inUse = health?.activeProvider === id

                return (
                  <section
                    key={id}
                    className={`flex flex-col overflow-hidden rounded-[20px] border transition-colors ${
                      isEnabled ? "border-vez-line bg-white" : "border-dashed border-vez-line bg-vez-surface/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-vez-line px-5 py-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${
                            !isEnabled
                              ? "bg-vez-line"
                              : h?.ok
                                ? "bg-green-500"
                                : h
                                  ? "bg-red-500"
                                  : keyField.configured
                                    ? "bg-vez-sky"
                                    : "bg-vez-line"
                          }`}
                        />
                        {isEnabled && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-vez-navy text-[10px] font-medium text-white">
                            {rank + 1}
                          </span>
                        )}
                        <h2
                          className={`truncate text-sm font-medium ${isEnabled ? "text-vez-ink" : "text-vez-mute line-through"}`}
                        >
                          {provider.label}
                        </h2>
                      </div>
                      <button
                        onClick={() => toggleProvider(id)}
                        disabled={isEnabled && priority.length === 1}
                        title={
                          isEnabled && priority.length === 1
                            ? "At least one provider must stay enabled"
                            : isEnabled
                              ? `Disable ${provider.label}`
                              : `Enable ${provider.label}`
                        }
                        className={`flex shrink-0 items-center justify-center rounded-full border p-1.5 transition-colors disabled:opacity-30 ${
                          isEnabled
                            ? "border-vez-line text-vez-mute hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            : "border-vez-line text-vez-ink hover:bg-white"
                        }`}
                      >
                        <Power className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 border-b border-vez-line px-5 py-2">
                      {inUse && (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-medium text-green-700">
                          in use
                        </span>
                      )}
                      {!isEnabled && (
                        <span className="rounded-full bg-vez-line/50 px-2.5 py-0.5 text-[10px] font-medium text-vez-mute">
                          disabled
                        </span>
                      )}
                      {isEnabled && (
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => movePriority(id, -1)}
                            disabled={rank === 0}
                            aria-label={`Move ${provider.label} up`}
                            className="flex size-6 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy disabled:opacity-25 disabled:hover:bg-transparent"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            onClick={() => movePriority(id, 1)}
                            disabled={rank === priority.length - 1}
                            aria-label={`Move ${provider.label} down`}
                            className="flex size-6 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy disabled:opacity-25 disabled:hover:bg-transparent"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-3.5 px-5 py-4">
                      <div>
                        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-vez-mute">API key</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SecretInput
                            field={keyField}
                            value={valueOf(provider.keyKey)}
                            onChange={(v) => setValue(provider.keyKey, v)}
                          />
                          {keyField.configured && (
                            <button
                              onClick={() => clearKey(provider.keyKey)}
                              title="Remove the stored key and fall back to the server's environment variable"
                              className="flex size-7 items-center justify-center rounded-full text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {!keyField.configured && (
                          <p className="mt-1 text-[11px] text-vez-mute">
                            Uses the server env var · get one at {provider.help}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-vez-mute">Model</p>
                        <input
                          value={valueOf(provider.modelKey)}
                          onChange={(e) => setValue(provider.modelKey, e.target.value)}
                          placeholder={modelField.placeholder}
                          spellCheck={false}
                          className={`h-10 w-full rounded-full border bg-white px-4 font-mono text-xs text-vez-ink outline-none transition-colors focus:border-vez-sky ${
                            isDirty(provider.modelKey) ? "border-amber-300" : "border-vez-line"
                          }`}
                        />
                      </div>

                      <div className="mt-auto">
                        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-vez-mute">Health</p>
                        {!h ? (
                          <span className="text-xs text-vez-mute">Not checked yet.</span>
                        ) : h.ok ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-700">
                            <CheckCircle2 className="size-3.5 shrink-0" /> Responding
                            <span className="tabular-nums text-vez-mute">· {h.latencyMs} ms</span>
                          </span>
                        ) : (
                          <span className="flex items-start gap-1.5 text-xs text-red-600">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {h.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            {/* ── Save bar ────────────────────────────────────────────── */}
            <div className="sticky bottom-4 z-10">
              <div
                className={`flex flex-wrap items-center gap-3 rounded-[20px] border bg-white p-4 pr-4 shadow-lg shadow-vez-navy/5 sm:pr-24 ${
                  dirtyKeys.length ? "border-amber-200" : "border-vez-line"
                }`}
              >
                <div className="min-w-0 flex-1">
                  {feedback ? (
                    <p
                      className={`flex items-center gap-2 text-sm ${feedback.ok ? "text-green-700" : "text-red-600"}`}
                    >
                      {feedback.ok ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0" />
                      )}
                      {feedback.text}
                    </p>
                  ) : dirtyKeys.length ? (
                    <p className="text-sm text-vez-ink">
                      <span className="font-medium text-amber-700">{dirtyKeys.length}</span> unsaved
                      change{dirtyKeys.length > 1 ? "s" : ""}
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-vez-mute">
                      <CheckCircle2 className="size-4 text-green-600" /> All AI settings saved.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDraft({})
                      setFeedback(null)
                    }}
                    disabled={!dirtyKeys.length || saving}
                    className="flex items-center gap-2 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="size-4" /> Discard
                  </button>
                  <button
                    onClick={save}
                    disabled={!dirtyKeys.length || saving}
                    className="flex items-center gap-2 rounded-full bg-vez-navy px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </div>
  )
}
