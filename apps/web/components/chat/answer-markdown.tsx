"use client"

import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { NoticeSource } from "@/lib/api"

interface AnswerMarkdownProps {
  content: string
  sources?: NoticeSource[]
  className?: string
}

/**
 * Renders a grounded answer.
 *
 * Answers come back as Markdown by contract — bold figures, bullet lists,
 * inline [n] citations. Rendering them as preformatted text (the previous
 * behaviour) showed users literal `**Rs. 1,000**` and made citations
 * meaningless, which is most of why the assistant read as unpolished.
 *
 * Elements are styled explicitly rather than via `prose`: this project has no
 * @tailwindcss/typography plugin, and the defaults would be far too airy
 * inside a chat bubble regardless.
 */
export function AnswerMarkdown({ content, sources, className }: AnswerMarkdownProps) {
  // Turn inline [n] markers into links to the matching source card. Done
  // before Markdown parsing so the marker survives as a link node.
  const linked = useMemo(() => {
    if (!sources?.length) return content
    return content.replace(/\[(\d{1,2})\]/g, (match, digits: string) => {
      const index = Number(digits)
      const source = sources.find((s) => (s.citation ?? 0) === index)
      return source ? `[${index}](#source-${index})` : match
    })
  }, [content, sources])

  return (
    <div className={cn("text-xs leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-1.5 list-disc space-y-0.5 pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h4 className="mt-2 mb-1 font-semibold">{children}</h4>,
          h2: ({ children }) => <h4 className="mt-2 mb-1 font-semibold">{children}</h4>,
          h3: ({ children }) => <h4 className="mt-2 mb-1 font-semibold">{children}</h4>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-border pl-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[0.95em]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-1.5 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-1.5 py-1">{children}</td>
          ),
          a: ({ href, children, ...props }) => {
            const isCitation = href?.startsWith("#source-")
            if (isCitation) {
              return (
                <a
                  href={href}
                  className="mx-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded bg-primary/15 px-1 align-super text-[0.7em] font-semibold text-primary no-underline hover:bg-primary/25"
                  {...props}
                >
                  {href!.replace("#source-", "")}
                </a>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {linked}
      </ReactMarkdown>
    </div>
  )
}

const CONFIDENCE_STYLES = {
  high: { label: "Verified against sources", className: "text-emerald-600" },
  medium: { label: "", className: "" },
  low: { label: "Low confidence — check the source notice", className: "text-amber-600" },
  none: { label: "", className: "" },
} as const

/**
 * Compact confidence line under an answer.
 *
 * The grading is heuristic (figures absent from context, invalid citations),
 * so the wording tells the user what to *do* — check the source — rather than
 * implying a calibrated probability. "medium" renders nothing: it is the
 * ordinary case, and a badge on every answer would train users to ignore it.
 */
export function ConfidenceNote({
  confidence,
  className,
}: {
  confidence?: "high" | "medium" | "low" | "none"
  className?: string
}) {
  if (!confidence) return null
  const style = CONFIDENCE_STYLES[confidence]
  if (!style?.label) return null

  return <p className={cn("mt-1 text-[10px]", style.className, className)}>{style.label}</p>
}
