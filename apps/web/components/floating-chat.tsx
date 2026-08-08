"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X, Send, Bot, User, Sparkles, Minimize2, ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { searchNotices, askNoticeQuestion, NoticeSearchResponse } from "@/lib/api"
import { useNoticeContext } from "@/lib/notice-context"
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
    } catch {
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
      {/* Chat Panel */}
      {open && (
        <div
          ref={chatRef}
          className="fixed bottom-24 right-6 z-[60] w-[400px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[75vh] rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/60 bg-primary/5">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Suchana AI</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{subtitle}</p>
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
                    <div className="whitespace-pre-wrap">{msg.content}</div>
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
          <div className="p-3 border-t border-border/60">
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

      {/* FAB Button */}
      <button
        ref={fabRef}
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-[60] size-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
          open
            ? "bg-white text-gray-900 ring-4 ring-white/20"
            : "bg-white text-gray-900 ring-4 ring-white/30"
        )}
        style={{ boxShadow: "0 0 20px rgba(255,255,255,0.3), 0 8px 32px rgba(0,0,0,0.4)" }}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-green-400 border-2 border-white flex items-center justify-center animate-pulse">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
        )}
      </button>
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
