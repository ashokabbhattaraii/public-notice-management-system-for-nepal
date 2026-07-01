"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  FileText, Search, Send, Upload, Bot, User,
  Cpu, MessageSquare, Database, ChevronRight,
  LayoutPanelLeft, BookOpen, Copy, Trash2,
  ThumbsUp, ThumbsDown, RefreshCw, CheckCircle,
  Clock, AlertCircle, Loader2, X, File,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { ChatMessage, RagDocument, RagSource } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import { fetchDocuments, uploadDocument, deleteDocument, ragQuery } from "@/lib/api"

type ViewMode = "split" | "chat" | "library"

const suggestions = [
  "What does the constitution say about fundamental rights?",
  "How is the national budget allocated?",
  "What are the e-procurement rules?",
  "What are civil service promotion requirements?",
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatMimeType(mime: string): string {
  if (mime.includes("pdf")) return "PDF"
  if (mime.includes("wordprocessingml")) return "DOCX"
  if (mime.includes("text/plain")) return "TXT"
  if (mime.includes("image/png")) return "PNG"
  if (mime.includes("image/jpeg")) return "JPEG"
  return mime.split("/").pop()?.toUpperCase() ?? "FILE"
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete, onAsk }: {
  doc: RagDocument; onDelete: () => void; onAsk: () => void
}) {
  const isIndexed = doc.status === "INDEXED"
  const isPending = doc.status === "PENDING" || doc.status === "PROCESSING"
  const isFailed = doc.status === "FAILED"

  return (
    <div className="rounded-2xl border border-vez-line/50 bg-white p-5 shadow-sm transition-all hover:border-vez-sky/50 hover:shadow-md">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-vez-sky/20">
          <FileText className="size-5 text-vez-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug text-vez-ink">{doc.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-vez-surface px-2.5 py-1 text-xs font-medium text-vez-mute">
              {formatMimeType(doc.mimeType)}
            </span>
            <span className="rounded-md bg-vez-surface px-2.5 py-1 text-xs text-vez-mute">
              {formatFileSize(doc.fileSize)}
            </span>
            {isIndexed && (
              <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <Database className="size-3" /> {doc.chunkCount} chunks
              </span>
            )}
            {isPending && (
              <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <Loader2 className="size-3 animate-spin" /> Processing...
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                <AlertCircle className="size-3" /> Failed
              </span>
            )}
            {doc.isOcr && (
              <span className="rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                OCR
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-vez-line/40 pt-4">
        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-vez-navy transition-colors hover:bg-vez-sky/15 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onAsk}
          disabled={!isIndexed}
        >
          <MessageSquare className="size-4" /> Ask AI
        </button>

        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> Delete
        </button>
      </div>
    </div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file || !title.trim()) return
    setUploading(true)
    setError("")
    try {
      await uploadDocument(file, title.trim())
      onUploaded()
      onClose()
    } catch (e: any) {
      setError(e.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ""))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    if (selected && !title) setTitle(selected.name.replace(/\.[^.]+$/, ""))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-vez-ink">Upload Document</h2>
            <p className="mt-1 text-sm text-vez-mute">Add a document to the AI knowledge base</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-ink">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* File drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-all ${
                dragOver
                  ? "border-vez-navy bg-vez-sky/10"
                  : file
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-vez-line hover:border-vez-sky hover:bg-vez-sky/5"
              }`}
            >
              {file ? (
                <>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100">
                    <File className="size-7 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-vez-ink">{file.name}</p>
                    <p className="mt-1 text-sm text-vez-mute">{formatFileSize(file.size)} · Click to change</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-vez-surface">
                    <Upload className="size-7 text-vez-mute" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-vez-ink">Drop file here or click to browse</p>
                    <p className="mt-1 text-sm text-vez-mute">PDF, DOCX, TXT, PNG, JPEG — up to 50 MB</p>
                  </div>
                </>
              )}
            </button>
          </div>

          {/* Title input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-vez-ink">Document Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Nepal Constitution 2072"
              className="h-12 w-full rounded-xl border border-vez-line px-4 text-base text-vez-ink outline-none transition-colors placeholder:text-vez-mute/60 focus:border-vez-navy focus:ring-2 focus:ring-vez-sky/30"
              maxLength={200}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-vez-navy text-base font-medium text-white transition-all hover:bg-vez-navy/90 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            {uploading ? "Uploading & Indexing..." : "Upload & Index Document"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RagPage() {
  const { user } = useAuth()

  const [view, setView] = useState<ViewMode>("split")
  const [docSearch, setDocSearch] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [docs, setDocs] = useState<RagDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "sys-1", role: "assistant",
    content: "Hello! I'm Suchana AI — your document intelligence assistant. Ask me anything about the indexed government documents.",
    timestamp: new Date().toISOString(),
  }])
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({})
  const chatEndRef = useRef<HTMLDivElement>(null)

  const indexedDocs = docs.filter(d => d.status === "INDEXED")
  const embeddedCount = indexedDocs.length
  const totalChunks = indexedDocs.reduce((s, d) => s + (d.chunkCount ?? 0), 0)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const loadDocs = useCallback(async () => {
    try {
      setDocsLoading(true)
      const response = await fetchDocuments(1, 100)
      setDocs(response.data)
    } catch {
      // Silently fail - will show empty state
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === "PENDING" || d.status === "PROCESSING")
    if (!hasProcessing) return
    const timer = setInterval(loadDocs, 5000)
    return () => clearInterval(timer)
  }, [docs, loadDocs])

  const filteredDocs = useMemo(() =>
    docs.filter(d =>
      d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
      d.filename.toLowerCase().includes(docSearch.toLowerCase())
    ),
    [docs, docSearch]
  )

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document? This will remove it from the vector store.")) return
    try {
      await deleteDocument(id)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`)
    }
  }

  const sendMessage = async (text?: string) => {
    const q = (text ?? chatInput).trim()
    if (!q || typing) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setChatInput("")
    setTyping(true)

    try {
      const result = await ragQuery(q, selectedDocId)
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date().toISOString(),
        sources: result.sources.length > 0 ? result.sources : undefined,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I couldn't process your question. ${e.message || "Please try again."}`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setTyping(false)
    }
  }

  const clearChat = () => {
    setMessages([{
      id: "sys-clear", role: "assistant",
      content: "Conversation cleared. Ask me anything about the indexed documents.",
      timestamp: new Date().toISOString(),
    }])
    setRatings({})
    setSelectedDocId(undefined)
  }

  // ─── Library panel ──────────────────────────────────────────────────────────

  const Library = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-vez-line/50 bg-vez-surface/50">
      {/* Header */}
      <div className="shrink-0 border-b border-vez-line bg-white px-6 py-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-vez-ink">Document Library</h2>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-lg border border-vez-line bg-white px-4 py-2 text-sm font-medium text-vez-ink shadow-sm transition-all hover:border-vez-sky hover:bg-vez-sky/10 hover:shadow"
          >
            <Upload className="size-4" /> Upload
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm text-vez-mute">
          <span className="flex items-center gap-1.5 font-medium text-vez-navy">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            {embeddedCount} indexed
          </span>
          <span className="text-vez-line">|</span>
          <span>{totalChunks} chunks</span>
          <span className="text-vez-line">|</span>
          <span>{docs.length} total</span>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-vez-line/60 bg-white px-5 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-vez-mute" />
          <input
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
            placeholder="Search documents..."
            className="h-11 w-full rounded-xl border border-vez-line bg-vez-surface/50 pl-11 pr-4 text-sm text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky focus:bg-white"
          />
        </div>
      </div>

      {/* Doc list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {docsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-vez-mute">
            <Loader2 className="mb-3 size-7 animate-spin" />
            <p className="text-sm">Loading documents...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-vez-mute">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-vez-surface">
              <FileText className="size-8 opacity-40" />
            </div>
            <p className="text-base font-medium text-vez-ink/60">
              {docSearch ? "No matching documents" : "No documents yet"}
            </p>
            <p className="mt-1 text-sm text-vez-mute">
              {docSearch ? "Try a different search term" : "Upload your first document to get started"}
            </p>
            {!docSearch && (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-5 flex items-center gap-2 rounded-xl bg-vez-navy px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-vez-navy/90"
              >
                <Upload className="size-4" /> Upload Document
              </button>
            )}
          </div>
        ) : (
          filteredDocs.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              onDelete={() => handleDelete(doc.id)}
              onAsk={() => {
                setSelectedDocId(doc.id)
                sendMessage(`What are the key provisions of "${doc.title}"?`)
                if (view === "library") setView("split")
              }}
            />
          ))
        )}
      </div>
    </div>
  )

  // ─── Chat panel ─────────────────────────────────────────────────────────────

  const Chat = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-vez-line/50 bg-white shadow-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-vez-line px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-vez-navy">
            <Cpu className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-vez-ink">Document AI</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-vez-mute">
              <span className="size-2 rounded-full bg-emerald-500" />
              {embeddedCount} docs · Qdrant + MiniLM + Groq
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocId && (
            <button
              className="flex items-center gap-1.5 rounded-lg bg-vez-sky/20 px-3 py-1.5 text-xs font-medium text-vez-navy transition-colors hover:bg-vez-sky/30"
              onClick={() => setSelectedDocId(undefined)}
              title="Clear document filter"
            >
              Filtered <X className="size-3" />
            </button>
          )}
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-vez-mute transition-colors hover:bg-vez-surface hover:text-vez-navy"
            onClick={clearChat}
          >
            <Trash2 className="size-4" /> Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-vez-sky/30">
                <Bot className="size-4.5 text-vez-navy" />
              </div>
            )}
            <div className="max-w-[80%] space-y-2">
              <div className={`rounded-2xl px-5 py-3 text-[15px] leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-md bg-vez-navy text-white"
                  : "rounded-bl-md bg-vez-surface text-vez-ink"
              }`}>
                {msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.sources.slice(0, 3).map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-vez-sky/15 px-3 py-1.5 text-xs font-medium text-vez-navy">
                      <BookOpen className="size-3" />
                      Source {s.chunk_index + 1} · {Math.round(s.score * 100)}%
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && !msg.id.startsWith("sys") && (
                <div className="flex gap-1">
                  {[
                    { icon: <Copy className="size-3.5" />, action: () => navigator.clipboard?.writeText(msg.content), active: "" },
                    { icon: <ThumbsUp className="size-3.5" />, action: () => setRatings(r => ({ ...r, [msg.id]: "up" })), active: ratings[msg.id] === "up" ? "text-vez-navy bg-vez-sky/20" : "" },
                    { icon: <ThumbsDown className="size-3.5" />, action: () => setRatings(r => ({ ...r, [msg.id]: "down" })), active: ratings[msg.id] === "down" ? "text-red-500 bg-red-50" : "" },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.action} className={`rounded-lg p-2 text-vez-mute/60 transition-colors hover:bg-vez-surface hover:text-vez-mute ${btn.active}`}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-vez-surface">
                <User className="size-4.5 text-vez-mute" />
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-vez-sky/30">
              <Bot className="size-4.5 text-vez-navy" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-vez-surface px-5 py-4">
              {[0, 150, 300].map(d => (
                <span key={d} className="size-2 animate-bounce rounded-full bg-vez-navy/40" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        {messages.length <= 1 && !typing && (
          <div className="mt-4 space-y-3">
            <p className="px-1 text-sm font-medium text-vez-mute">Try asking:</p>
            {suggestions.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="group flex w-full items-center justify-between rounded-xl border border-vez-line/50 bg-vez-surface/50 px-5 py-4 text-left transition-all hover:border-vez-sky/50 hover:bg-vez-sky/10 hover:shadow-sm">
                <span className="text-[15px] text-vez-mute group-hover:text-vez-ink">{q}</span>
                <ChevronRight className="size-4 shrink-0 text-vez-mute/40 transition-transform group-hover:translate-x-0.5 group-hover:text-vez-navy" />
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-vez-line px-5 py-4">
        <div className="flex gap-3">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={embeddedCount === 0 ? "Upload and index documents first..." : "Ask about government policies..."}
            className="h-12 flex-1 rounded-xl border border-vez-line bg-vez-surface/50 px-5 text-[15px] text-vez-ink outline-none transition-all placeholder:text-vez-mute focus:border-vez-navy focus:bg-white focus:ring-2 focus:ring-vez-sky/30 disabled:opacity-50"
            disabled={embeddedCount === 0 || typing}
          />
          <button
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-vez-navy text-white shadow-md transition-all hover:bg-vez-navy/90 hover:shadow-lg disabled:opacity-40 disabled:shadow-none"
            onClick={() => sendMessage()}
            disabled={!chatInput.trim() || typing}
            aria-label="Send message"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white font-poppins">
      <Header />

      <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-5 px-6 py-6 md:px-8 lg:px-12 min-h-0">

        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-vez-navy shadow-md">
              <Cpu className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-vez-ink">Document Intelligence</h1>
                <span className="rounded-lg bg-vez-sky/30 px-3 py-1 text-xs font-semibold text-vez-navy">RAG</span>
              </div>
              <p className="mt-1 text-sm text-vez-mute">
                {embeddedCount} docs indexed · {totalChunks} chunks · Qdrant + MiniLM + Groq
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden items-center gap-2.5 md:flex">
            {[
              { icon: <CheckCircle className="size-4 text-emerald-500" />, label: "Pipeline active" },
              { icon: <Clock className="size-4 text-vez-mute" />, label: `${docs.length} docs` },
              { icon: <RefreshCw className="size-4 text-vez-mute" />, label: "Refresh", action: loadDocs },
            ].map(s => (
              <button
                key={s.label}
                onClick={s.action}
                className="flex items-center gap-2 rounded-lg bg-vez-surface px-4 py-2 text-sm text-vez-mute transition-colors hover:bg-vez-sky/15 hover:text-vez-navy"
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-vez-surface p-1.5">
            {([
              { id: "library", icon: BookOpen,        label: "Library" },
              { id: "split",   icon: LayoutPanelLeft, label: "Split" },
              { id: "chat",    icon: MessageSquare,   label: "Chat" },
            ] as const).map(m => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => setView(m.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    view === m.id
                      ? "bg-vez-navy text-white shadow-sm"
                      : "text-vez-mute hover:text-vez-navy"
                  }`}>
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Panels */}
        <div className="min-h-0 flex-1">
          {view === "split" && (
            <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
              {Library}
              {Chat}
            </div>
          )}
          {view === "library" && <div className="h-full max-w-3xl">{Library}</div>}
          {view === "chat" && <div className="mx-auto h-full max-w-3xl">{Chat}</div>}
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={loadDocs} />}
    </div>
  )
}
