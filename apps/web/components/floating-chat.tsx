"use client"

import React, { Suspense, useState, useRef, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Minimize2,
  ExternalLink,
  FileText,
  Square,
  Check,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNoticeContext } from "@/lib/notice-context"
import { useNoticeChat, type ChatStage } from "@/lib/use-notice-chat"
import { AnswerMarkdown, ConfidenceNote } from "@/components/chat/answer-markdown"
import type { NoticeSource } from "@/lib/api"
import gsap from "gsap"

const GENERAL_SUGGESTIONS = [
  "What exams are coming up?",
  "Latest tender notices",
  "NRB policy updates",
  "Recent vacancy announcements",
]

const NOTICE_SUGGESTIONS = [
  "What is this notice about?",
  "What are the key deadlines?",
  "Who does this affect?",
  "What action should I take?",
]

/** Wording for each retrieval stage, so the wait is legible rather than a
 * featureless spinner. */
const STAGE_LABELS: Record<NonNullable<ChatStage>, string> = {
  searching: "Searching notices…",
  reading: "Reading the notice…",
  answering: "Writing the answer…",
}

/**
 * The assistant is mounted globally in `providers.tsx`, so its use of
 * `useSearchParams` (to scope answers to the active category filter) would
 * otherwise force every statically prerendered page to bail out — it failed
 * the production build on /admin/users. The Suspense boundary lives here so
 * the fix travels with the component rather than with each mount site.
 */
export function FloatingChat() {
  return (
    <Suspense fallback={null}>
      <FloatingChatPanel />
    </Suspense>
  )
}

function FloatingChatPanel() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeNotice } = useNoticeContext()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const chatRef = useRef<HTMLDivElement>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const prevNoticeId = useRef<string | null>(null)

  // Scope the corpus search to whatever the user is filtered to
  // (e.g. /notices?category=TENDER), so answers match what's on screen.
  const activeCategory =
    pathname === "/notices" ? searchParams.get("category") ?? undefined : undefined

  const { messages, send, stop, reset, loading, stage } = useNoticeChat({
    noticeId: activeNotice?.id,
    category: activeCategory,
  })

  // Reset the conversation when moving between notices — history from a
  // different notice would misdirect follow-up questions.
  useEffect(() => {
    if (activeNotice?.id !== prevNoticeId.current) {
      if (prevNoticeId.current !== null) reset()
      prevNoticeId.current = activeNotice?.id ?? null
    }
  }, [activeNotice?.id, reset])

  useEffect(() => {
    if (fabRef.current) {
      gsap.fromTo(
        fabRef.current,
        { scale: 0, rotation: -90 },
        { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)", delay: 1 },
      )
    }
  }, [])

  useEffect(() => {
    if (open && chatRef.current) {
      gsap.fromTo(
        chatRef.current,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power2.out" },
      )
    }
  }, [open])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  function handleSubmit(text?: string) {
    const query = text ?? input
    if (!query.trim() || loading) return
    setInput("")
    void send(query)
  }

  if (pathname?.startsWith("/documents")) return null

  const suggestions = activeNotice ? NOTICE_SUGGESTIONS : GENERAL_SUGGESTIONS
  const subtitle = activeNotice
    ? `Answering about: ${activeNotice.title.slice(0, 40)}${activeNotice.title.length > 40 ? "…" : ""}`
    : "Ask about any government notice"

  return (
    <>
      {open && (
        <div
          ref={chatRef}
          className="fixed bottom-24 right-6 z-[60] flex h-[540px] max-h-[75vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-primary/5 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Suchana AI</p>
                <p className="max-w-[200px] truncate text-[10px] text-muted-foreground">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}>
                <Minimize2 className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Context badge */}
          {activeNotice && (
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
              <FileText className="size-3 shrink-0 text-primary" />
              <p className="flex-1 truncate text-[10px] text-primary">
                Context: {activeNotice.title}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <p className="mb-1 text-sm font-medium">
                  {activeNotice ? "Ask about this notice" : "How can I help?"}
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  {activeNotice
                    ? "I have the full text of this notice — ask me anything"
                    : "Ask about notices, exams, tenders, or policies"}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSubmit(s)}
                      className="rounded-full border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" && "justify-end")}>
                {msg.role === "assistant" && (
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="size-3 text-primary" />
                  </div>
                )}
                <div className="max-w-[85%]">
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-accent/60",
                    )}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <>
                        <AnswerMarkdown content={msg.content} sources={msg.sources} />
                        {msg.streaming && msg.content && (
                          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
                        )}
                      </>
                    )}
                  </div>

                  {msg.role === "assistant" && !msg.streaming && msg.content && (
                    <div className="mt-1 flex items-center gap-2">
                      <ConfidenceNote confidence={msg.confidence} className="mt-0" />
                      {msg.stopped && (
                        <span className="text-[10px] text-muted-foreground">Stopped</span>
                      )}
                      <CopyButton text={msg.content} />
                    </div>
                  )}

                  {msg.scope === "notice" && (
                    <p className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                      <FileText className="size-2.5" /> From the notice you&apos;re reading
                    </p>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <SourceList sources={msg.sources} />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent">
                    <User className="size-3" />
                  </div>
                )}
              </div>
            ))}

            {/* Stage indicator: only before the first token arrives. Once text
                is streaming, the text itself is the progress indicator. */}
            {loading && stage && stage !== "answering" && (
              <div className="flex gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-3 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-xl rounded-bl-sm bg-accent/60 px-3 py-2">
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{STAGE_LABELS[stage]}</span>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="border-t border-border/60 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeNotice ? "Ask about this notice…" : "Ask about notices…"}
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
              />
              {loading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-9 shrink-0 rounded-lg"
                  onClick={stop}
                  aria-label="Stop generating"
                >
                  <Square className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg"
                  disabled={!input.trim()}
                  aria-label="Send"
                >
                  <Send className="size-3.5" />
                </Button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        ref={fabRef}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-[60] flex size-16 items-center justify-center rounded-full bg-white text-gray-900 shadow-2xl ring-4 ring-white/30 transition-all hover:scale-110 active:scale-95"
        style={{ boxShadow: "0 0 20px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.4)" }}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && (
          <span className="absolute -right-1 -top-1 flex size-5 animate-pulse items-center justify-center rounded-full border-2 border-white bg-green-400">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
        )}
      </button>
    </>
  )
}

/** Numbered source cards, anchored so inline [n] citations can jump to them. */
function SourceList({ sources }: { sources: NoticeSource[] }) {
  return (
    <div className="mt-1.5 space-y-1">
      {sources.slice(0, 4).map((src, i) => (
        <a
          key={src.id || i}
          id={`source-${src.citation ?? i + 1}`}
          href={`/notices/${src.id}`}
          className="group flex items-start gap-1.5 text-[10px] text-muted-foreground transition-colors hover:text-primary"
        >
          <span className="mt-px flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded bg-muted px-1 text-[9px] font-semibold">
            {src.citation ?? i + 1}
          </span>
          <span className="line-clamp-2 flex-1">{src.title}</span>
          <ExternalLink className="mt-0.5 size-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
        </a>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied — nothing useful to fall back to.
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy answer"
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
    </button>
  )
}
