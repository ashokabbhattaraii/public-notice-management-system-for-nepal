"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RotateCcw, Save, Thermometer } from "lucide-react"
import { fetchSettings, updateSettings, resetSetting } from "@/lib/api"
import type { SettingField } from "@/lib/types"
import { toast } from "sonner"

/**
 * Sampling temperature per task, backed by the `ai` settings group.
 *
 * Deliberately three knobs rather than one global: the value that keeps a
 * greeting from repeating itself is the value that makes a factual answer
 * drift. Extraction calls (classification, JSON summarisation schema, the
 * scraper) are pinned at 0.0 in the AI service and are not exposed here —
 * sampling those produces malformed output, not variety.
 */
export function AiTemperatureCard() {
  const [fields, setFields] = useState<SettingField[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const view = await fetchSettings()
      const ai = view.settings.filter((s) => s.group === "ai")
      setFields(ai)
      setDraft(Object.fromEntries(ai.map((s) => [s.key, s.value])))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load AI settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = fields.some((f) => draft[f.key] !== f.value)

  const save = async () => {
    setSaving(true)
    try {
      const changed = Object.fromEntries(
        fields.filter((f) => draft[f.key] !== f.value).map((f) => [f.key, draft[f.key]]),
      )
      const result = await updateSettings(changed)
      if (result.errors.length) {
        toast.error(result.errors.map((e) => e.message).join(" "))
      } else {
        toast.success("Temperatures saved — the AI service picks them up within ~3 minutes")
      }
      const ai = result.settings.filter((s) => s.group === "ai")
      setFields(ai)
      setDraft(Object.fromEntries(ai.map((s) => [s.key, s.value])))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const reset = async (key: string) => {
    try {
      await resetSetting(key)
      await load()
      toast.success("Reverted to default")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset")
    }
  }

  if (loading) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-[16px] border border-vez-line bg-white px-5 py-4 text-sm text-vez-mute">
        <Loader2 className="size-4 animate-spin text-vez-navy" /> Loading AI behaviour…
      </div>
    )
  }
  if (fields.length === 0) return null

  return (
    <div className="mb-5 rounded-[16px] border border-vez-line bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Thermometer className="size-4 shrink-0 text-vez-navy" />
        <span className="text-sm text-vez-ink">Temperature</span>
        <span className="text-xs text-vez-mute">
          · applies to every provider above, on the next config poll (~3 min)
        </span>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-vez-navy px-4 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {fields.map((field) => {
          const value = draft[field.key] ?? field.default
          return (
            <div key={field.key}>
              <div className="flex items-center gap-3">
                <label htmlFor={field.key} className="min-w-[190px] text-sm text-vez-ink">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type="range"
                  min={field.min ?? 0}
                  max={field.max ?? 1}
                  step={field.step ?? 0.1}
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  className="h-1.5 flex-1 cursor-pointer accent-vez-navy"
                />
                <span className="w-10 text-right font-mono text-sm text-vez-ink tabular-nums">
                  {Number(value).toFixed(1)}
                </span>
                {field.overridden && (
                  <button
                    onClick={() => reset(field.key)}
                    title={`Revert to default (${field.default})`}
                    aria-label={`Revert ${field.label} to default`}
                    className="text-vez-mute transition-colors hover:text-vez-navy"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="ml-[202px] mt-1 text-xs leading-relaxed text-vez-mute">{field.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
