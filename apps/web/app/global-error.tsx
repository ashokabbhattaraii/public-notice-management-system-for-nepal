"use client"

import { useEffect } from "react"
import "./globals.css"

/**
 * Last-resort boundary — only fires when the root layout itself throws
 * (fonts/providers/theme setup), so it can't rely on that layout rendering
 * and must supply its own <html>/<body>. Kept dependency-free (no shadcn
 * Button/ThemeProvider) since those live in the tree that just crashed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled root error:", error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#101d23", color: "#f5f5f5" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "9999px",
              background: "rgba(239,68,68,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            ⚠️
          </div>
          <div style={{ maxWidth: 380 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>The app failed to load</h1>
            <p style={{ fontSize: 14, color: "#9bb0ba", margin: 0 }}>
              Something went wrong starting the page. Try again, or reload from scratch.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={reset}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#f5f5f5",
                color: "#101d23",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #243a45",
                background: "transparent",
                color: "#f5f5f5",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
