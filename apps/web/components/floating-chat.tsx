"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X, Send, Bot, User, Sparkles, ExternalLink, FileText } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { searchNotices, askNoticeQuestion, isQuotaError, NoticeSearchResponse, type QuotaDenial } from "@/lib/api"
import { useNoticeContext } from "@/lib/notice-context"
import { UpgradePrompt } from "@/components/billing/upgrade-prompt"
import gsap from "gsap"

interface Source {
  id: string
  title: string
  category: string
  sourceUrl: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  contextUsed?: "notice" | "general"
}

/**
 * Assistant replies are Markdown (bullets, **bold**, and GFM tables for
 * schedules/fee scales). Sized down to fit the compact chat bubble.
 */
function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        ),
        h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[10px]">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-1.5 border-l-2 border-border pl-2 opacity-80 last:mb-0">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-1.5 -mx-1 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-[11px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-border/70">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-border/40 last:border-0">{children}</tr>,
        th: ({ children }) => <th className="px-1.5 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-1.5 py-1 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

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

export function FloatingChat() {
  const pathname = usePathname()
  const { activeNotice } = useNoticeContext()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<QuotaDenial | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const prevNoticeId = useRef<string | null>(null)

  // Reset messages when switching between notices
  useEffect(() => {
    if (activeNotice?.id !== prevNoticeId.current) {
      if (prevNoticeId.current !== null) {
        setMessages([])
      }
      prevNoticeId.current = activeNotice?.id ?? null
    }
  }, [activeNotice?.id])

  useEffect(() => {
    if (fabRef.current) {
      gsap.fromTo(fabRef.current,
        { scale: 0, rotation: -90 },
        { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(2)", delay: 1 }
      )
    }
  }, [])

  useEffect(() => {
    if (open && chatRef.current) {
      gsap.fromTo(chatRef.current,
        { opacity: 0, scale: 0.9, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power2.out" }
      )
    }
  }, [open])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = useCallback(async (text?: string) => {
    const query = text || input.trim()
    if (!query || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: query }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setQuota(null)

    try {
      // If we have an active notice context, try notice-specific Q&A first
      if (activeNotice?.id && activeNotice.contentText) {
        const isAboutCurrentNotice = isNoticeRelatedQuery(query, activeNotice.title)

        if (isAboutCurrentNotice) {
          const { answer } = await askNoticeQuestion(activeNotice.id, query)
          const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: answer,
            contextUsed: "notice",
          }
          setMessages(prev => [...prev, botMsg])
          return
        }
      }

      // General notice search
      const result: NoticeSearchResponse = await searchNotices(query)
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        sources: result.sources?.length ? result.sources : undefined,
        contextUsed: "general",
      }
      setMessages(prev => [...prev, botMsg])
    } catch (e) {
      // A spent AI allowance is a billing state, not a chat failure — surface
      // it as an upgrade prompt below the composer instead of a bot apology.
      if (isQuotaError(e)) {
        setQuota(e.quota)
        return
      }
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process that request right now. Please try again.",
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }, [input, loading, activeNotice])

  if (pathname?.startsWith("/documents")) return null

  const suggestions = activeNotice ? NOTICE_SUGGESTIONS : GENERAL_SUGGESTIONS
  const subtitle = activeNotice
    ? `Answering about: ${activeNotice.title.slice(0, 40)}${activeNotice.title.length > 40 ? "…" : ""}`
    : "Ask about any government notice"

  return (
    <>
      {/* Chat Panel — full-width bottom sheet on mobile, floating card from sm: up */}
      {open && (
        <div
          ref={chatRef}
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl",
            "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl",
            // Smaller footprint than before (was 400x540, ~75vh) — it was
            // covering page controls (action buttons, title) on narrower or
            // shorter desktop viewports. max-h keeps it well clear of the
            // top of the page even on short windows.
            "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[65vh] sm:max-h-[480px] sm:w-[360px] sm:rounded-2xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/60 bg-primary/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Suchana AI</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{subtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Context badge */}
          {activeNotice && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-primary/3">
              <FileText className="size-3 text-primary shrink-0" />
              <p className="text-[10px] text-primary truncate flex-1">
                Context: {activeNotice.title}
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                Locked
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">
                  {activeNotice ? "Ask about this notice" : "How can I help?"}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {activeNotice
                    ? "I have the full context of this notice — ask me anything"
                    : "Ask about notices, exams, tenders, or policies"}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
                {msg.role === "assistant" && (
                  <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="size-3 text-primary" />
                  </div>
                )}
                <div className="max-w-[80%]">
                  <div className={cn(
                    "rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-accent/60 rounded-bl-sm"
                  )}>
                    {msg.role === "assistant" ? (
                      <ChatMarkdown content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {msg.contextUsed === "notice" && (
                    <p className="mt-0.5 text-[9px] text-muted-foreground flex items-center gap-1">
                      <FileText className="size-2.5" /> From current notice
                    </p>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {msg.sources.slice(0, 3).map((src) => (
                        <a
                          key={src.id}
                          href={`/notices/${src.id}`}
                          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors group"
                        >
                          <ExternalLink className="size-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="size-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <User className="size-3" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="size-3 text-primary" />
                </div>
                <div className="bg-accent/60 rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/60" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {quota && (
              <div className="mb-2">
                <UpgradePrompt quota={quota} compact onDismiss={() => setQuota(null)} />
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeNotice ? "Ask about this notice…" : "Ask about notices..."}
                className="flex-1 h-9 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 transition-colors"
                disabled={loading}
              />
              <Button type="submit" size="icon" className="size-9 rounded-lg shrink-0" disabled={!input.trim() || loading}>
                <Send className="size-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* FAB Button — only shown when the panel is closed; the panel's own
          header X handles closing, so a second floating close button
          hovering over page content underneath (a confusing, cramped look
          especially on mobile) is unnecessary. */}
      {!open && (
        <button
          ref={fabRef}
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed right-4 sm:right-6 z-[60] size-14 sm:size-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 bg-white text-gray-900 ring-4 ring-white/30"
          style={{
            boxShadow: "0 0 20px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.4)",
            bottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          <MessageCircle className="size-6" />
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-green-400 border-2 border-white flex items-center justify-center animate-pulse">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
        </button>
      )}
    </>
  )
}

/**
 * Heuristic to determine if a user's question is about the currently viewed
 * notice or a general/unrelated query. Returns true if likely about the
 * current notice.
 */
function isNoticeRelatedQuery(query: string, noticeTitle: string): boolean {
  const q = query.toLowerCase()

  // Explicit signals that the user is asking about something else
  const generalPatterns = [
    /^(show|find|list|search|get)\s+(me\s+)?(all|latest|recent|other|new)/,
    /other notices/,
    /different (notice|topic)/,
    /what('s| is) (new|happening|latest)/,
    /how many notices/,
  ]
  if (generalPatterns.some(p => p.test(q))) return false

  // Explicit signals about "this" notice
  const thisNoticePatterns = [
    /\b(this|the|current)\s+(notice|document|pdf|circular|tender|announcement)/,
    /\b(it|its|it's)\b/,
    /^(what|who|when|where|how|why|is|are|does|do|can|should|tell me|explain|summarize|summarise)/,
    /deadline|due date|last date/,
    /eligib|qualif|require|criteria/,
    /apply|application|submit/,
    /affect|impact|concern/,
    /contact|phone|email|address/,
    /fee|cost|amount|salary|payment/,
  ]
  if (thisNoticePatterns.some(p => p.test(q))) return true

  // If the query is short and question-like, assume it's about the current notice
  if (q.length < 60 && (q.endsWith("?") || q.split(" ").length <= 8)) return true

  return true
}
