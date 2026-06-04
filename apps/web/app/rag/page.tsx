"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import {
  FileText, Search, Send, Upload, Bot, User, Eye,
  Cpu, MessageSquare, Database, ChevronRight,
  LayoutPanelLeft, BookOpen, Copy, Trash2,
  ThumbsUp, ThumbsDown, RefreshCw, CheckCircle,
  Clock, BarChart3, Unlink, ToggleLeft, ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

const catColors: Record<string, string> = {
  Legal:       "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Finance:     "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Education:   "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Procurement: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Technology:  "bg-primary/10 text-primary border-primary/20",
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onToggle, onAsk, isAdmin }: {
  doc: DocWithState; onToggle: () => void; onAsk: () => void; isAdmin: boolean
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-2.5 mb-2">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="size-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug line-clamp-2">{doc.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${catColors[doc.category] ?? "bg-muted border-border text-muted-foreground"}`}>
              {doc.category}
            </span>
            <span className={`text-[9px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${
              doc.embedded
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border/60"
            }`}>
              {doc.embedded ? <><Database className="size-2" /> {doc.chunkCount} chunks</> : <><Unlink className="size-2" /> Not indexed</>}
            </span>
          </div>
        </div>
      </div>

      {/* Embed toggle — always visible, prominent */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
        {/* Toggle switch */}
        <button
          onClick={onToggle}
          disabled={!isAdmin}
          title={isAdmin ? (doc.embedded ? "Click to unembed from RAG" : "Click to embed into RAG") : "Admin only"}
          className={`flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            doc.embedded
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20"
              : "bg-muted/60 border-border/60 text-muted-foreground hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-700"
          } ${!isAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {doc.embedded
            ? <ToggleRight className="size-3.5 shrink-0" />
            : <ToggleLeft className="size-3.5 shrink-0" />
          }
          <span>{doc.embedded ? "Embedded" : "Unembed"}</span>
          {!isAdmin && <span className="ml-auto text-[9px] opacity-60">admin only</span>}
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={onAsk}
          disabled={!doc.embedded}
        >
          <MessageSquare className="size-3" /> Ask
        </Button>
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
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold">Document Library</p>
          {isAdmin && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs px-2.5">
              <Upload className="size-3" /> Upload
            </Button>
          )}
        </div>
        {/* Embed stats */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {embeddedCount} embedded
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{totalChunks} chunks</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-muted-foreground">{docs.length - embeddedCount} not indexed</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/40 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search…" className="pl-8 h-7 text-xs" />
        </div>
        {!isAdmin && (
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Database className="size-2.5" /> Embed/unembed requires admin access
          </p>
        )}
      </div>

      {/* Doc list — scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Document AI</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {embeddedCount} docs · LangChain + ChromaDB
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground" onClick={clearChat}>
          <Trash2 className="size-3" /> Clear
        </Button>
      </div>

      {/* Messages — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3 text-primary" />
              </div>
            )}
            <div className="max-w-[82%] space-y-1">
              <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted/70 border border-border/60 rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
              {msg.sources?.length && (
                <div className="space-y-1">
                  {msg.sources.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary/8 border border-primary/15 text-primary">
                      <BookOpen className="size-2.5" /> {s}
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && !msg.id.startsWith("sys") && (
                <div className="flex gap-1">
                  {[
                    { icon: <Copy className="size-3" />, action: () => navigator.clipboard?.writeText(msg.content) },
                    { icon: <ThumbsUp className="size-3" />, action: () => setRatings(r => ({ ...r, [msg.id]: "up" })), active: ratings[msg.id] === "up" ? "text-emerald-500" : "" },
                    { icon: <ThumbsDown className="size-3" />, action: () => setRatings(r => ({ ...r, [msg.id]: "down" })), active: ratings[msg.id] === "down" ? "text-destructive" : "" },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} className={`p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors ${btn.active ?? ""}`}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="size-3" />
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-2">
            <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="size-3 text-primary" />
            </div>
            <div className="bg-muted/70 border border-border/60 rounded-xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
              {[0, 150, 300].map(d => (
                <span key={d} className="size-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        {messages.length <= 1 && !typing && (
          <div className="space-y-1.5 mt-2">
            <p className="text-[11px] text-muted-foreground font-medium px-1">Try asking:</p>
            {suggestions.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-between group">
                <span className="text-muted-foreground group-hover:text-foreground">{q}</span>
                <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/60 px-3 py-2.5 shrink-0">
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={embeddedCount === 0 ? "No documents indexed…" : "Ask about government policies…"}
            className="h-9 text-sm flex-1"
            disabled={embeddedCount === 0 || typing}
          />
          <Button size="sm" className="h-9 px-3 shrink-0" onClick={() => sendMessage()} disabled={!chatInput.trim() || typing}>
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Header />

      {/* Fixed-height workspace */}
      <div className="flex-1 flex flex-col min-h-0 max-w-7xl mx-auto w-full px-4 md:px-6 py-4 gap-3">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 shrink-0 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Cpu className="size-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight">Document Intelligence</h1>
                <Badge variant="outline" className="text-[9px] border-primary/20 text-primary h-4 px-1.5">RAG</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {embeddedCount} docs indexed · {totalChunks} chunks · LangChain + ChromaDB + HuggingFace
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { icon: <CheckCircle className="size-3 text-emerald-500" />, label: "Pipeline Active" },
              { icon: <Clock className="size-3 text-muted-foreground" />, label: "~1.2s avg" },
              { icon: <RefreshCw className="size-3 text-muted-foreground" />, label: "Jun 1, 2026" },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border/60 bg-muted/40">
                {s.icon} {s.label}
              </span>
            ))}
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg border border-border/60 bg-muted/40">
            {([
              { id: "library", icon: BookOpen,        label: "Library" },
              { id: "split",   icon: LayoutPanelLeft, label: "Split" },
              { id: "chat",    icon: MessageSquare,   label: "Chat" },
            ] as const).map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setView(m.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === m.id
                      ? "bg-background text-foreground shadow-sm border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panels — fill remaining height, no page scroll */}
        <div className="flex-1 min-h-0">
          {view === "split" && (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 h-full">
              {Library}
              {Chat}
            </div>
          )}
          {view === "library" && <div className="h-full max-w-3xl">{Library}</div>}
          {view === "chat" && <div className="h-full max-w-2xl mx-auto">{Chat}</div>}
        </div>
      </div>
    </div>
  )
}
