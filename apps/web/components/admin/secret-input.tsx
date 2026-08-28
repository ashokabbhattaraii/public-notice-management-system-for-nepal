"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react"
import type { SettingField } from "@/lib/types"

/**
 * Masked editor for a `secret` setting, shared by /admin/settings and
 * /admin/ai.
 *
 * The server never sends the real value back (see SettingRow.configured /
 * preview in settings.service.ts) — `value` is "" until the admin types a
 * replacement, which is what makes the field dirty. Revealing the input is
 * local UI state only and never marks anything dirty on its own.
 */
export function SecretInput({
  field,
  value,
  onChange,
  className = "",
}: {
  field: SettingField
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [show, setShow] = useState(false)

  if (!editing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            field.configured ? "bg-emerald-50 text-emerald-700" : "bg-vez-surface text-vez-mute"
          }`}
        >
          {field.configured ? (
            <>
              <ShieldCheck className="size-3.5" />
              {field.preview ?? "Configured"}
            </>
          ) : (
            <>
              <KeyRound className="size-3.5" /> Not configured
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-vez-line px-3.5 py-1.5 text-xs text-vez-ink transition-colors hover:bg-vez-surface"
        >
          {field.configured ? "Change" : "Set key"}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative min-w-0 flex-1">
        <input
          type={show ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Paste new API key"}
          className="h-10 w-full rounded-full border border-vez-line bg-white pl-4 pr-10 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-vez-mute hover:text-vez-ink"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setEditing(false)
          setShow(false)
          onChange(field.value)
        }}
        className="shrink-0 text-xs text-vez-mute transition-colors hover:text-vez-ink"
      >
        Cancel
      </button>
    </div>
  )
}
