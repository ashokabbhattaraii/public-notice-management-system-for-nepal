import Link from "next/link"
import { FileQuestion, Home, Search } from "lucide-react"

// Rendered with a real 404 status, so a removed notice drops out of search
// results instead of lingering as a soft 404.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This notice may have been removed, or the link may be incorrect.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Link
          href="/notices"
          className="flex items-center gap-1.5 rounded-full bg-vez-navy px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
        >
          <Search className="size-3.5" /> Browse notices
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-vez-line px-5 py-2.5 text-sm text-vez-ink transition-colors hover:bg-vez-surface"
        >
          <Home className="size-3.5" /> Go home
        </Link>
      </div>
    </div>
  )
}
