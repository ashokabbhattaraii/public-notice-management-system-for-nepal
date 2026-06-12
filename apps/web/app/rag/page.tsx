"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import {
  FileText, Search, Send, Upload, Bot, User,
  Cpu, MessageSquare, Database, ChevronRight,
  LayoutPanelLeft, BookOpen, Copy, Trash2,
  ThumbsUp, ThumbsDown, RefreshCw, CheckCircle,
  Clock, Unlink, ToggleLeft, ToggleRight,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { mockDocuments } from "@/lib/mock-data"
import { ChatMessage } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"

// ─── types ────────────────────────────────────────────────────────────────────

type ViewMode = "split" | "chat" | "library"

interface DocWithState {
  id: string; title: string; category: string; uploadedAt: string
  fileSize: string; viewCount: number; summary: string; format: string
  embedded: boolean; chunkCount: number; embeddedAt?: string
}

// ─── data ─────────────────────────────────────────────────────────────────────

const enrichedDocs: DocWithState[] = mockDocuments.map((d, i) => ({
  ...d,
  embedded: i !== 2,
  chunkCount: [124, 58, 0, 89, 42, 37][i] ?? 45,
  embeddedAt: i !== 2 ? "2026-05-20T08:00:00Z" : undefined,
}))

const demoResponses: Record<string, { answer: string; sources: string[] }> = {
  constitution: {
    answer: "The Constitution of Nepal 2072 establishes Nepal as a federal democratic republic with three tiers of government: Federal, Provincial, and Local. Article 18 guarantees equal protection. Fundamental rights include freedom of expression, right to information, and social justice. Promulgated Ashwin 3, 2072 BS.",
    sources: ["Nepal Constitution 2072 — Article 18, Part 3"],
  },
  budget: {
    answer: "Budget FY 2082/83 allocates NRs. 1.8 trillion. Breakdown: Infrastructure 32%, Education 18%, Health 12%, Social Security 15%, Agriculture 8%. GDP growth target: 6.5%. Revenue collection goal: NRs. 1.2 trillion.",
    sources: ["Budget Speech FY 2082/83 — Summary Table, Page 4"],
  },
  procurement: {
    answer: "Public Procurement Guidelines 2081 mandate e-bidding on bolpatra.gov.np for all procurements above NRs. 2 million. Processing time reduced to 15 days. Technical evaluation committees of 3 members required. All decisions published within 7 days.",
    sources: ["Public Procurement Guidelines 2081 — Section 4.2, Section 7"],
  },
  civil: {
    answer: "Civil Service Act 2049 (Amended 2079) covers appointment, promotion, transfer, and conduct. Key provisions: competitive exam entry, 3-year probation, performance-based promotion, mandatory ethics declaration every 2 years, gift limit NRs. 1,000.",
    sources: ["Civil Service Act 2049 (Amended 2079) — Chapters 3, 5, 7"],
  },
  it: {
    answer: "IT Policy 2077 targets 100% broadband by 2027, digital IDs for all citizens, cashless payment ecosystem, and cloud-first government systems. Mandates open-source preference and establishes a National Data Centre.",
    sources: ["IT Policy 2077 (Digital Nepal Framework) — Section 2.1, 3.4"],
  },
  default: {
    answer: "I can answer questions about Nepal's constitution, civil service, education, procurement guidelines, national budget, and IT policy from the indexed documents. Please ask a specific question.",
    sources: [],
  },
}

function pickResponse(q: string) {
  const ql = q.toLowerCase()
  if (ql.includes("constitution") || ql.includes("fundamental")) return demoResponses.constitution
  if (ql.includes("budget") || ql.includes("fiscal")) return demoResponses.budget
  if (ql.includes("procurement") || ql.includes("bidding")) return demoResponses.procurement
  if (ql.includes("civil") || ql.includes("servant")) return demoResponses.civil
  if (ql.includes("it policy") || ql.includes("digital")) return demoResponses.it
  return demoResponses.default
}

const suggestions = [
  "What does the constitution say about fundamental rights?",
  "How is the FY 2082/83 budget allocated?",
  "What are the e-procurement rules above NRs. 2 million?",
  "What are civil service promotion requirements?",
]

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onToggle, onAsk, isAdmin }: {
  doc: DocWithState; onToggle: () => void; onAsk: () => void; isAdmin: boolean
}) {
  return (
    <div className="rounded-[16px] bg-white p-4 transition-colors hover:bg-vez-sky/10">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vez-sky/30">
          <FileText className="size-4 text-vez-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug text-vez-ink">{doc.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-vez-surface px-2.5 py-0.5 text-[10px] text-vez-mute">
              {doc.category}
            </span>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] ${
              doc.embedded
                ? "bg-vez-sky/30 text-vez-navy"
                : "bg-vez-surface text-vez-mute"
            }`}>
              {doc.embedded ? <><Database className="size-2.5" /> {doc.chunkCount} chunks</> : <><Unlink className="size-2.5" /> Not indexed</>}
            </span>
          </div>
        </div>
      </div>

      {/* Embed toggle */}
      <div className="flex items-center justify-between gap-2 border-t border-vez-line/60 pt-3">
        <button
          onClick={onToggle}
          disabled={!isAdmin}
          title={isAdmin ? (doc.embedded ? "Click to unembed from RAG" : "Click to embed into RAG") : "Admin only"}
          className={`flex flex-1 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
            doc.embedded
              ? "bg-vez-navy text-white hover:opacity-90"
              : "bg-vez-surface text-vez-mute hover:bg-vez-sky/20 hover:text-vez-navy"
          } ${!isAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          {doc.embedded
            ? <ToggleRight className="size-3.5 shrink-0" />
            : <ToggleLeft className="size-3.5 shrink-0" />
          }
          <span>{doc.embedded ? "Embedded" : "Unembed"}</span>
          {!isAdmin && <span className="ml-auto text-[9px] opacity-60">admin only</span>}
        </button>

        <button
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onAsk}
          disabled={!doc.embedded}
        >
          <MessageSquare className="size-3" /> Ask
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RagPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [view, setView] = useState<ViewMode>("split")
  const [docSearch, setDocSearch] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [docs, setDocs] = useState<DocWithState[]>(enrichedDocs)
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "sys-1", role: "assistant",
    content: "Hello! I'm Suchana AI Document Intelligence — ask me anything about Nepal's indexed government documents.",
    timestamp: new Date().toISOString(),
  }])
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({})
  const chatEndRef = useRef<HTMLDivElement>(null)

  const embeddedCount = docs.filter(d => d.embedded).length
  const totalChunks = docs.filter(d => d.embedded).reduce((s, d) => s + d.chunkCount, 0)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const filteredDocs = useMemo(() =>
    docs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
      d.category.toLowerCase().includes(docSearch.toLowerCase())),
    [docs, docSearch]
  )

  const toggleEmbed = (id: string) =>
    setDocs(prev => prev.map(d =>
      d.id === id ? { ...d, embedded: !d.embedded, chunkCount: d.embedded ? 0 : enrichedDocs.find(e => e.id === id)?.chunkCount ?? 45 } : d
    ))

  const sendMessage = (text?: string) => {
    const q = (text ?? chatInput).trim()
    if (!q || typing) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: q, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setChatInput("")
    setTyping(true)
    setTimeout(() => {
      const { answer, sources } = pickResponse(q)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant",
        content: answer, timestamp: new Date().toISOString(),
        sources: sources.length ? sources : undefined,
      }])
      setTyping(false)
    }, 700 + Math.random() * 500)
  }

  const clearChat = () => {
    setMessages([{ id: "sys-clear", role: "assistant", content: "Conversation cleared. Ask me anything about the indexed documents.", timestamp: new Date().toISOString() }])
    setRatings({})
  }

  // ─── Library panel ──────────────────────────────────────────────────────────

  const Library = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-vez-surface">
      {/* Header */}
      <div className="shrink-0 border-b border-vez-line px-5 py-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm text-vez-ink">Document library</p>
          {isAdmin && (
            <button className="flex items-center gap-1.5 rounded-full border border-vez-line bg-white px-3 py-1.5 text-xs text-vez-ink transition-colors hover:bg-vez-sky/20">
              <Upload className="size-3" /> Upload
            </button>
          )}
        </div>
        {/* Embed stats */}
        <div className="flex items-center gap-2 text-xs text-vez-mute">
          <span className="flex items-center gap-1 text-vez-navy">
            <span className="size-1.5 animate-pulse rounded-full bg-vez-navy" />
            {embeddedCount} embedded
          </span>
          <span className="opacity-40">·</span>
          <span>{totalChunks} chunks</span>
          <span className="opacity-40">·</span>
          <span>{docs.length - embeddedCount} not indexed</span>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-vez-line/60 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-vez-mute" />
          <input
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 w-full rounded-full border border-vez-line bg-white pl-9 pr-4 text-xs text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"
          />
        </div>
        {!isAdmin && (
          <p className="mt-2 flex items-center gap-1 text-[10px] text-vez-mute">
            <Database className="size-2.5" /> Embed/unembed requires admin access
          </p>
        )}
      </div>

      {/* Doc list — scrollable */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {filteredDocs.map(doc => (
          <DocCard
            key={doc.id}
            doc={doc}
            onToggle={() => toggleEmbed(doc.id)}
            onAsk={() => { sendMessage(`What are the key provisions of "${doc.title}"?`); if (view === "library") setView("split") }}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </div>
  )

  // ─── Chat panel ─────────────────────────────────────────────────────────────

  const Chat = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-vez-line bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-vez-line px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-vez-navy">
            <Cpu className="size-4 text-white" />
          </div>
          <div>
            <p className="text-sm leading-none text-vez-ink">Document AI</p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-vez-mute">
              <span className="size-1.5 rounded-full bg-vez-sky" />
              {embeddedCount} docs · LangChain + ChromaDB
            </p>
          </div>
        </div>
        <button
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
          onClick={clearChat}
        >
          <Trash2 className="size-3" /> Clear
        </button>
      </div>

      {/* Messages — scrollable */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-vez-sky/40">
                <Bot className="size-3.5 text-vez-navy" />
              </div>
            )}
            <div className="max-w-[82%] space-y-1.5">
              <div className={`rounded-[16px] px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-[4px] bg-vez-navy text-white"
                  : "rounded-bl-[4px] bg-vez-surface text-vez-ink"
              }`}>
                {msg.content}
              </div>
              {msg.sources?.length && (
                <div className="space-y-1">
                  {msg.sources.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-vez-sky/20 px-2.5 py-1 text-[10px] text-vez-navy">
                      <BookOpen className="size-2.5" /> {s}
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && !msg.id.startsWith("sys") && (
                <div className="flex gap-1">
                  {[
                    { icon: <Copy className="size-3" />, action: () => navigator.clipboard?.writeText(msg.content), active: "" },
                    { icon: <ThumbsUp className="size-3" />, action: () => setRatings(r => ({ ...r, [msg.id]: "up" })), active: ratings[msg.id] === "up" ? "text-vez-navy" : "" },
                    { icon: <ThumbsDown className="size-3" />, action: () => setRatings(r => ({ ...r, [msg.id]: "down" })), active: ratings[msg.id] === "down" ? "text-red-500" : "" },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} className={`rounded-full p-1.5 text-vez-mute/60 transition-colors hover:bg-vez-surface hover:text-vez-mute ${btn.active}`}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-vez-surface">
                <User className="size-3.5 text-vez-mute" />
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-vez-sky/40">
              <Bot className="size-3.5 text-vez-navy" />
            </div>
            <div className="flex items-center gap-1.5 rounded-[16px] rounded-bl-[4px] bg-vez-surface px-4 py-3">
              {[0, 150, 300].map(d => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-vez-navy/50" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        {messages.length <= 1 && !typing && (
          <div className="mt-2 space-y-2">
            <p className="px-1 text-xs text-vez-mute">Try asking:</p>
            {suggestions.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="group flex w-full items-center justify-between rounded-[12px] bg-vez-surface px-4 py-3 text-left text-sm transition-colors hover:bg-vez-sky/20">
                <span className="text-vez-mute group-hover:text-vez-ink">{q}</span>
                <ChevronRight className="size-3.5 shrink-0 text-vez-mute/40 group-hover:text-vez-navy" />
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-vez-line px-4 py-3">
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={embeddedCount === 0 ? "No documents indexed…" : "Ask about government policies…"}
            className="h-11 flex-1 rounded-full border border-vez-line bg-white px-5 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky disabled:opacity-50"
            disabled={embeddedCount === 0 || typing}
          />
          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vez-navy text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            onClick={() => sendMessage()}
            disabled={!chatInput.trim() || typing}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-poppins">
      <Header />

      {/* Fixed-height workspace */}
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-4 px-6 py-5 md:px-8 lg:px-12 min-h-0">

        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-vez-navy">
              <Cpu className="size-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg tracking-[-0.02em] text-vez-ink">Document intelligence</h1>
                <span className="rounded-full bg-vez-sky/30 px-2.5 py-0.5 text-[10px] text-vez-navy">RAG</span>
              </div>
              <p className="text-xs text-vez-mute">
                {embeddedCount} docs indexed · {totalChunks} chunks · LangChain + ChromaDB + HuggingFace
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden items-center gap-2 md:flex">
            {[
              { icon: <CheckCircle className="size-3 text-vez-navy" />, label: "Pipeline active" },
              { icon: <Clock className="size-3 text-vez-mute" />, label: "~1.2s avg" },
              { icon: <RefreshCw className="size-3 text-vez-mute" />, label: "Jun 1, 2026" },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1.5 rounded-full bg-vez-surface px-3 py-1.5 text-[10px] text-vez-mute">
                {s.icon} {s.label}
              </span>
            ))}
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 rounded-full bg-vez-surface p-1.5">
            {([
              { id: "library", icon: BookOpen,        label: "Library" },
              { id: "split",   icon: LayoutPanelLeft, label: "Split" },
              { id: "chat",    icon: MessageSquare,   label: "Chat" },
            ] as const).map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setView(m.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                    view === m.id
                      ? "bg-vez-navy text-white"
                      : "text-vez-mute hover:text-vez-navy"
                  }`}>
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panels — fill remaining height, no page scroll */}
        <div className="min-h-0 flex-1 pb-5">
          {view === "split" && (
            <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
              {Library}
              {Chat}
            </div>
          )}
          {view === "library" && <div className="h-full max-w-3xl">{Library}</div>}
          {view === "chat" && <div className="mx-auto h-full max-w-2xl">{Chat}</div>}
        </div>
      </div>
    </div>
  )
}
