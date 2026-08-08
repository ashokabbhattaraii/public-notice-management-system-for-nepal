/**
 * Minimal cron support for the admin settings UI (5- and 6-field style).
 * The backend stays authoritative (it validates with the `cron` package);
 * these helpers mirror its semantics closely enough for a live client-side
 * validity badge and a "next run" preview.
 */

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

const DOWS: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, "7": 0,
}

const FIELD_NAMES = ["second", "minute", "hour", "day of month", "month", "day of week"]

interface FieldSpec {
  min: number
  max: number
  names: Record<string, number>
}

const SPECS: FieldSpec[] = [
  { min: 0, max: 59, names: {} }, // second
  { min: 0, max: 59, names: {} }, // minute
  { min: 0, max: 23, names: {} }, // hour
  { min: 1, max: 31, names: {} }, // day of month
  { min: 1, max: 12, names: MONTHS }, // month
  { min: 0, max: 7, names: DOWS }, // day of week
]

function toNumber(raw: string, names: Record<string, number>): number | null {
  if (/^\d+$/.test(raw)) return Number(raw)
  const upper = raw.toUpperCase()
  if (upper in names) return names[upper]
  return null
}

/** Expand one comma-part: `*`, step (`*\/n`), `a-b`, `a-b\/n`, single value or name. */
function expandPart(raw: string, spec: FieldSpec): Set<number> {
  const out = new Set<number>()
  const { min, max, names } = spec

  const add = (v: number) => {
    if (v >= min && v <= max) out.add(v)
  }

  if (raw === "*") {
    for (let v = min; v <= max; v++) out.add(v)
    return out
  }

  const stepAll = raw.match(/^\*\/(\d+)$/)
  if (stepAll) {
    const step = Math.max(1, Number(stepAll[1]))
    for (let v = min; v <= max; v += step) out.add(v)
    return out
  }

  const range = raw.match(/^([\w]+)-([\w]+)(?:\/(\d+))?$/)
  if (range) {
    const step = range[3] ? Math.max(1, Number(range[3])) : 1
    const a = toNumber(range[1], names)
    const b = toNumber(range[2], names)
    if (a !== null && b !== null) {
      if (a <= b) {
        for (let v = a; v <= b; v += step) add(v)
      } else {
        // wraparound range (NOV-FEB, SAT-SUN)
        for (let v = a; v <= max; v += step) add(v)
        for (let v = min; v <= b; v += step) add(v)
      }
    }
    return out
  }

  const single = toNumber(raw, names)
  if (single !== null) add(single)
  return out
}

export interface ParsedCron {
  hasSeconds: boolean
  seconds: Set<number>
  minutes: Set<number>
  hours: Set<number>
  dayOfMonth: Set<number>
  month: Set<number>
  dayOfWeek: Set<number>
}

export type CronFieldError = { field: number; name: string; message: string }

export type CronParseResult =
  | { ok: true; cron: ParsedCron }
  | { ok: false; errors: CronFieldError[] }

function parseField(raw: string, spec: FieldSpec, fieldIndex: number): { set: Set<number>; error: string | null } {
  const out = new Set<number>()
  for (const part of raw.split(",")) {
    const trimmed = part.trim()
    if (!trimmed) return { set: out, error: "empty field part" }
    const expanded = expandPart(trimmed, spec)
    if (expanded.size === 0) {
      return { set: out, error: `"${trimmed}" is not a valid ${FIELD_NAMES[fieldIndex]} value` }
    }
    expanded.forEach((v) => out.add(v))
  }
  return { set: out, error: out.size ? null : `no valid ${FIELD_NAMES[fieldIndex]} values` }
}

export function parseCron(expression: string): CronParseResult {
  const fields = expression.trim().replace(/\s+/g, " ").split(" ")

  if (fields.length < 5 || fields.length > 6) {
    return {
      ok: false,
      errors: [
        {
          field: -1,
          name: "expression",
          message: "Needs 5 fields (min hour DOM month weekday) or 6 (with seconds).",
        },
      ],
    }
  }

  const hasSeconds = fields.length === 6
  const f = (i: number) => (hasSeconds ? fields[i] : fields[i - 1])
  const errors: CronFieldError[] = []
  const sets: Set<number>[] = []

  for (let i = 0; i < 6; i++) {
    if (!hasSeconds && i === 0) continue // no seconds field in 5-field form
    const { set, error } = parseField(f(i), SPECS[i], i)
    sets.push(set)
    if (error) errors.push({ field: i, name: FIELD_NAMES[i], message: error })
  }

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    cron: {
      hasSeconds,
      seconds: hasSeconds ? sets[0] : new Set([0]),
      minutes: sets[hasSeconds ? 1 : 0],
      hours: sets[hasSeconds ? 2 : 1],
      dayOfMonth: sets[hasSeconds ? 3 : 2],
      month: sets[hasSeconds ? 4 : 3],
      dayOfWeek: sets[hasSeconds ? 5 : 4],
    },
  }
}

function dayRule(c: ParsedCron, date: Date): boolean {
  const domAll = c.dayOfMonth.size === 31
  const dowAll = c.dayOfWeek.size === 7
  if (domAll && dowAll) return true
  const domMatch = c.dayOfMonth.has(date.getDate())
  const dowMatch = c.dayOfWeek.has(date.getDay())
  if (domAll) return dowMatch
  if (dowAll) return domMatch
  return domMatch || dowMatch // cron's inclusive-OR day rule
}

function matchesAt(date: Date, c: ParsedCron): boolean {
  if (c.hasSeconds && !c.seconds.has(date.getSeconds())) return false
  if (!c.minutes.has(date.getMinutes())) return false
  if (!c.hours.has(date.getHours())) return false
  if (!c.month.has(date.getMonth() + 1)) return false
  return dayRule(c, date)
}

/** Next `count` run times (local time) strictly after `from`. */
export function cronNextOccurrences(expression: string, from: Date, count = 3): Date[] {
  const res = parseCron(expression)
  if (!res.ok) return []

  const c = res.cron
  const out: Date[] = []
  const stepMs = c.hasSeconds && !(c.seconds.size === 1 && c.seconds.has(0)) ? 1000 : 60000
  let cursor = new Date(from.getTime() + 1000)

  for (let guard = 0; guard < 10_000_000 && out.length < count; guard++) {
    if (stepMs === 60000) {
      cursor = new Date(Math.floor(cursor.getTime() / 60000) * 60000)
    }
    if (matchesAt(cursor, c)) {
      out.push(cursor)
      cursor = new Date(cursor.getTime() + stepMs)
    } else {
      cursor = new Date(cursor.getTime() + stepMs)
    }
  }
  return out
}

/** "in 4m" / "in 2h" / "in 5d" — relative time from now. */
export function formatRelativeSeconds(secondsAway: number): string {
  const mins = Math.floor(secondsAway / 60)
  if (mins < 1) return "within a minute"
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours}h${mins % 60 ? ` ${mins % 60}m` : ""}`
  const days = Math.floor(hours / 24)
  return `in ${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`
}