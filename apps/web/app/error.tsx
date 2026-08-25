"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Segment-level error boundary — catches any uncaught render/data error below
 * the root layout (so header/nav still render) and shows a branded fallback
 * instead of Next's default unstyled crash screen. `reset()` re-renders the
 * segment without a full page reload.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled page error:", error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an unexpected error. You can try again, or head back to safety.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={reset} size="sm" className="gap-1.5">
          <RefreshCw className="size-3.5" /> Try again
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/">
            <Home className="size-3.5" /> Go home
          </Link>
        </Button>
      </div>
    </div>
  )
}
