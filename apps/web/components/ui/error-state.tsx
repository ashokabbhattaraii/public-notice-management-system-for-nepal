"use client"

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isNetworkError } from "@/lib/api"

interface ErrorStateProps {
  /** The caught error, if any — used to pick an offline vs. generic icon/message and to derive body text. */
  error?: unknown
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
  /** Tighter padding for use inside an already-bounded panel (e.g. a list feed) instead of a full page. */
  compact?: boolean
}

/**
 * Shared fallback for "the fetch failed" states — network drop, server 5xx,
 * or an unexpected exception. Distinguishes offline/timeout from a server
 * error at a glance, and only shows a retry button when the caller can
 * actually retry (some failures, like a 404, aren't retryable).
 */
export function ErrorState({ error, title, message, onRetry, className, compact }: ErrorStateProps) {
  const offline = isNetworkError(error)
  const Icon = offline ? WifiOff : AlertTriangle
  const heading = title ?? (offline ? "Connection problem" : "Something went wrong")
  const body = message ?? (error instanceof Error ? error.message : "Please try again in a moment.")

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 text-center",
        compact ? "py-8" : "py-16",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <Icon className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{heading}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1 gap-1.5">
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  )
}
