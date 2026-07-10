"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  FileText, Search, Send, Upload, Bot, User,
  Cpu, MessageSquare, Database, ChevronRight,
  LayoutPanelLeft, BookOpen, Copy, Trash2,
  ThumbsUp, ThumbsDown, RefreshCw, CheckCircle,
  Clock, AlertCircle, Loader2, X, File,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Header } from "@/components/layout/header"
import { ChatMessage, RagDocument, RagSource, DocumentProgress } from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import {
  fetchDocuments, uploadDocument, deleteDocument, ragQuery,
  embedDocument, unembedDocument, fetchDocumentsProgress,
} from "@/lib/api"

// Titles often arrive as raw filenames ("_Hamro_Life_Bank_SRS.pdf");
// humanize them for display in the source chips.
function prettySourceTitle(s: RagSource): string {
  const raw = s.title || `Chunk ${s.chunk_index + 1}`
  return raw
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// One chip per document with its citation numbers combined ("[1][2]"),
// instead of a chip per chunk repeating the same name.
function groupSources(sources: RagSource[]) {
  const groups = new Map<string, { title: string; refs: number[]; score: number; preview: string }>()
  sources.forEach((s, i) => {
    const existing = groups.get(s.doc_id)
    if (existing) {
      existing.refs.push(i + 1)
      existing.score = Math.max(existing.score, s.score)
    } else {
      groups.set(s.doc_id, {
        title: prettySourceTitle(s),
        refs: [i + 1],
        score: s.score,
        preview: s.content.slice(0, 300),
      })
    }
  })
  return [...groups.values()]
}

type ViewMode = "split" | "chat" | "library"
type MobileTab = "library" | "chat"

const suggestions = [
  "What does the constitution say about fundamental rights?",
  "How is the national budget allocated?",
  "What are the e-procurement rules?",
  "What are civil service promotion requirements?",
]

const stageLabels: Record<string, string> = {
  extracting: "Extracting text",
  chunking: "Chunking",
  embedding: "Embedding",
  indexing: "Indexing",
}

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

// ─── Markdown ─────────────────────────────────────────────────────────────────

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-vez-ink">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-vez-navy underline underline-offset-2">{children}</a>
        ),
        h1: ({ children }) => <p className="mb-2 text-base font-semibold text-vez-ink">{children}</p>,
        h2: ({ children }) => <p className="mb-2 text-base font-semibold text-vez-ink">{children}</p>,
        h3: ({ children }) => <p className="mb-1.5 font-semibold text-vez-ink">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-vez-sky/20 px-1.5 py-0.5 font-mono text-[13px] text-vez-navy">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-vez-sky pl-3 text-vez-mute last:mb-0">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-vez-line/60 bg-vez-sky/10 px-3 py-1.5 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-vez-line/60 px-3 py-1.5 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ─── Embed toggle ─────────────────────────────────────────────────────────────

function EmbedToggle({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={on ? "Remove from knowledge base" : "Embed into knowledge base"}
      disabled={busy}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-vez-line"
      }`}
    >
      <span
        className={`absolute top-0.5 flex size-5 items-center justify-center rounded-full bg-white shadow transition-all duration-200 ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      >
        {busy && <Loader2 className="size-3 animate-spin text-vez-mute" />}
      </span>
    </button>
  )
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, progress, toggleBusy, canManage, onToggleEmbed, onDelete, onAsk }: {
  doc: RagDocument
  progress?: DocumentProgress
  toggleBusy: boolean
  canManage: boolean
  onToggleEmbed: () => void
  onDelete: () => void
  onAsk: () => void
}) {
  const isIndexed = doc.status === "INDEXED"
  const isProcessing = doc.status === "PENDING" || doc.status === "PROCESSING"
  const isFailed = doc.status === "FAILED"
  const isUnembedded = doc.status === "UNEMBEDDED"
  const showControls = canManage && !doc.isSystem

  const percent = isProcessing ? (progress?.percent ?? 0) : 0
  const stageLabel = progress?.stage ? stageLabels[progress.stage] ?? "Processing" : "Queued"

  return (
    <div className="rounded-2xl border border-vez-line/50 bg-white p-4 shadow-sm transition-all hover:border-vez-sky/50 hover:shadow-md sm:p-5">
      <div className="mb-3 flex items-start gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-vez-sky/20 sm:size-11">
          <FileText className="size-5 text-vez-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="line-clamp-2 text-[15px] font-medium leading-snug text-vez-ink">{doc.title}</p>
            {doc.isSystem && (
              <span className="shrink-0 rounded-md bg-vez-navy/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vez-navy">
                System
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-vez-surface px-2 py-0.5 text-xs font-medium text-vez-mute">
              {formatMimeType(doc.mimeType)}
            </span>
            <span className="rounded-md bg-vez-surface px-2 py-0.5 text-xs text-vez-mute">
              {formatFileSize(doc.fileSize)}
            </span>
            {isIndexed && (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Database className="size-3" /> {doc.chunkCount} chunks
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                <AlertCircle className="size-3" /> Failed
              </span>
            )}
            {doc.isOcr && (
              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                OCR
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Embed state row */}
      {isProcessing ? (
        <div className="mb-3 rounded-xl bg-vez-surface/70 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-vez-navy">
              <Loader2 className="size-3 animate-spin" /> {stageLabel}
            </span>
            <span className="tabular-nums text-vez-mute">
              {progress?.total_chunks
                ? `${progress.processed_chunks}/${progress.total_chunks} chunks · ${percent}%`
                : `${percent}%`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-vez-line/50">
            <div
              className="h-full rounded-full bg-vez-navy transition-all duration-500"
              style={{ width: `${Math.max(percent, 3)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-vez-surface/70 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-vez-ink">
              {isIndexed ? "Embedded" : isFailed ? "Embedding failed" : "Not embedded"}
            </p>
            <p className="truncate text-xs text-vez-mute">
              {isIndexed
                ? "Searchable in AI answers"
                : isFailed
                  ? showControls ? "Toggle to retry" : "Contact admin"
                  : showControls ? "Toggle to add to the knowledge base" : "Not yet available"}
            </p>
          </div>
          {showControls && (
            <EmbedToggle on={isIndexed} busy={toggleBusy} onChange={onToggleEmbed} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-vez-line/40 pt-3">
        <button
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-vez-navy transition-colors hover:bg-vez-sky/15 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onAsk}
          disabled={!isIndexed}
        >
          <MessageSquare className="size-4" /> Ask AI
        </button>

        {showControls && (
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="size-4" /> Delete
          </button>
        )}
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
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-vez-ink">Upload Document</h2>
            <p className="mt-1 text-sm text-vez-mute">Uploads start embedding automatically</p>
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
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 transition-all sm:py-10 ${
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
                    <p className="mt-1 text-sm text-vez-mute">PDF, DOCX, TXT, PNG, JPEG - up to 50 MB</p>
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
            {uploading ? "Uploading..." : "Upload & Embed"}
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
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat")
  const [libWidth, setLibWidth] = useState(380)
  const resizing = useRef(false)
  const splitRef = useRef<HTMLDivElement>(null)
  const [docSearch, setDocSearch] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [docs, setDocs] = useState<RagDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>()
  const [progressMap, setProgressMap] = useState<Record<string, DocumentProgress>>({})
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: "sys-1", role: "assistant",
    content: "Hello! I'm Suchana AI - your document intelligence assistant. Ask me anything about the indexed government documents.",
    timestamp: new Date().toISOString(),
  }])
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const indexedDocs = docs.filter(d => d.status === "INDEXED")
  const embeddedCount = indexedDocs.length
  const totalChunks = indexedDocs.reduce((s, d) => s + (d.chunkCount ?? 0), 0)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const loadDocs = useCallback(async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) setDocsLoading(true)
      const response = await fetchDocuments(1, 100)
      setDocs(response.data)
    } catch {
      // Silently fail - will show empty state
    } finally {
      if (!opts.silent) setDocsLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  // Live progress polling while documents are embedding.
  const processingKey = docs
    .filter(d => d.status === "PENDING" || d.status === "PROCESSING")
    .map(d => d.id)
    .join(",")

  useEffect(() => {
    if (!processingKey) return
    const ids = processingKey.split(",")
    let cancelled = false
    let ticks = 0

    const tick = async () => {
      ticks += 1
      let result: Record<string, DocumentProgress | null> = {}
      try {
        result = await fetchDocumentsProgress(ids)
      } catch {
        return
      }
      if (cancelled) return

      const next: Record<string, DocumentProgress> = {}
      let anyFinished = false
      for (const id of ids) {
        const entry = result[id]
        if (!entry) continue
        next[id] = entry
        if (entry.stage === "done" || entry.stage === "failed") anyFinished = true
      }
      setProgressMap(prev => ({ ...prev, ...next }))
      // Refresh the list when something finished - or periodically as a
      // safety net in case the AI service has no progress entry for a doc.
      if (anyFinished || ticks % 8 === 0) loadDocs({ silent: true })
    }

    tick()
    const timer = setInterval(tick, 2500)
    return () => { cancelled = true; clearInterval(timer) }
  }, [processingKey, loadDocs])

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

  const handleToggleEmbed = async (doc: RagDocument) => {
    setTogglingIds(prev => new Set(prev).add(doc.id))
    try {
      const updated = doc.status === "INDEXED"
        ? await unembedDocument(doc.id)
        : await embedDocument(doc.id)
      setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, ...updated } : d)))
    } catch (e: any) {
      alert(`Could not update embedding: ${e.message}`)
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(doc.id)
        return next
      })
    }
  }

  const sendMessage = async (text?: string, docIdOverride?: string) => {
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
      const result = await ragQuery(q, docIdOverride ?? selectedDocId)
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        timestamp: new Date().toISOString(),
        sources: result.sources.length > 0 ? result.sources : undefined,
        modelUsed: result.model_used,
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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    const startX = e.clientX
    const startWidth = libWidth

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const container = splitRef.current
      if (!container) return
      const maxW = container.offsetWidth * 0.6
      const newW = Math.min(Math.max(startWidth + ev.clientX - startX, 240), maxW)
      setLibWidth(newW)
    }

    const onUp = () => {
      resizing.current = false
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [libWidth])

  const askAboutDoc = (doc: RagDocument) => {
    setSelectedDocId(doc.id)
    sendMessage(`What are the key provisions of "${doc.title}"?`, doc.id)
    if (view === "library") setView("split")
    setMobileTab("chat")
  }

  // ─── Library panel ──────────────────────────────────────────────────────────

  const Library = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-vez-line/50 bg-vez-surface/50">
      {/* Header */}
      <div className="shrink-0 border-b border-vez-line bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-vez-ink">Document Library</h2>
          {user && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-lg border border-vez-line bg-white px-3.5 py-2 text-sm font-medium text-vez-ink shadow-sm transition-all hover:border-vez-sky hover:bg-vez-sky/10 hover:shadow"
            >
              <Upload className="size-4" /> Upload
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-vez-mute">
          <span className="flex items-center gap-1.5 font-medium text-vez-navy">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            {embeddedCount} embedded
          </span>
          <span className="text-vez-line">|</span>
          <span>{totalChunks} chunks</span>
          <span className="text-vez-line">|</span>
          <span>{docs.length} total</span>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-vez-line/60 bg-white px-4 py-3 sm:px-5 sm:py-4">
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
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
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
            {!docSearch && user && (
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
              progress={progressMap[doc.id]}
              toggleBusy={togglingIds.has(doc.id)}
              canManage={!!user}
              onToggleEmbed={() => handleToggleEmbed(doc)}
              onDelete={() => handleDelete(doc.id)}
              onAsk={() => askAboutDoc(doc)}
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
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-vez-line px-4 py-3.5 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-vez-navy sm:size-11">
            <Cpu className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-vez-ink">Document AI</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-vez-mute sm:text-sm">
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
              {embeddedCount} {embeddedCount === 1 ? "document" : "documents"} ready · Ask anything
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
            <Trash2 className="size-4" /> <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-vez-sky/30 sm:size-9">
                <Bot className="size-4 text-vez-navy sm:size-4.5" />
              </div>
            )}
            <div className="max-w-[85%] space-y-2 sm:max-w-[80%]">
              <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:px-5 ${
                msg.role === "user"
                  ? "rounded-br-md bg-vez-navy text-white"
                  : "rounded-bl-md bg-vez-surface text-vez-ink"
              }`}>
                {msg.role === "assistant" ? <Markdown content={msg.content} /> : msg.content}
              </div>
              {msg.modelUsed === "extractive" && (
                <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Fallback mode - showing extracted document text. Set <code className="font-mono">GROQ_API_KEY</code> in <code className="font-mono">apps/ai/.env</code> for full AI answers.
                  </span>
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-vez-mute/70">Sources</span>
                  {groupSources(msg.sources).map((g, i) => (
                    <span
                      key={i}
                      title={g.preview}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-vez-sky/30 bg-vez-sky/10 px-2.5 py-1 text-xs font-medium text-vez-navy"
                    >
                      <BookOpen className="size-3 shrink-0" />
                      <span className="shrink-0 font-mono text-[11px] text-vez-navy/70">
                        {g.refs.map(n => `[${n}]`).join("")}
                      </span>
                      <span className="max-w-40 truncate">{g.title}</span>
                      <span className="shrink-0 rounded bg-vez-sky/25 px-1.5 py-0.5 text-[10px] font-semibold text-vez-navy/80">
                        {Math.round(g.score * 100)}%
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "assistant" && !msg.id.startsWith("sys") && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content)
                      setCopiedId(msg.id)
                      setTimeout(() => setCopiedId(prev => prev === msg.id ? null : prev), 2000)
                    }}
                    className={`rounded-lg p-2 transition-colors ${copiedId === msg.id ? "text-emerald-600 bg-emerald-50" : "text-vez-mute/60 hover:bg-vez-surface hover:text-vez-mute"}`}
                  >
                    {copiedId === msg.id ? <CheckCircle className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => setRatings(r => ({ ...r, [msg.id]: "up" }))}
                    className={`rounded-lg p-2 transition-colors hover:bg-vez-surface hover:text-vez-mute ${ratings[msg.id] === "up" ? "text-vez-navy bg-vez-sky/20" : "text-vez-mute/60"}`}
                  >
                    <ThumbsUp className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setRatings(r => ({ ...r, [msg.id]: "down" }))}
                    className={`rounded-lg p-2 transition-colors hover:bg-vez-surface hover:text-vez-mute ${ratings[msg.id] === "down" ? "text-red-500 bg-red-50" : "text-vez-mute/60"}`}
                  >
                    <ThumbsDown className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-vez-surface sm:size-9">
                <User className="size-4 text-vez-mute sm:size-4.5" />
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
                className="group flex w-full items-center justify-between rounded-xl border border-vez-line/50 bg-vez-surface/50 px-4 py-3.5 text-left transition-all hover:border-vez-sky/50 hover:bg-vez-sky/10 hover:shadow-sm sm:px-5 sm:py-4">
                <span className="text-[15px] text-vez-mute group-hover:text-vez-ink">{q}</span>
                <ChevronRight className="size-4 shrink-0 text-vez-mute/40 transition-transform group-hover:translate-x-0.5 group-hover:text-vez-navy" />
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-vez-line px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex gap-2 sm:gap-3">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={embeddedCount === 0 ? "Embed documents first..." : "Ask about government policies..."}
            className="h-12 min-w-0 flex-1 rounded-xl border border-vez-line bg-vez-surface/50 px-4 text-[15px] text-vez-ink outline-none transition-all placeholder:text-vez-mute focus:border-vez-navy focus:bg-white focus:ring-2 focus:ring-vez-sky/30 disabled:opacity-50 sm:px-5"
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
    <div className="flex h-dvh flex-col overflow-hidden bg-white font-poppins">
      <Header />

      <div className="mx-auto flex w-full max-w-[1480px] min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-6 md:px-8 lg:px-12">

        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-vez-navy shadow-md sm:size-12">
              <Cpu className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 sm:gap-3">
                <h1 className="text-lg font-semibold tracking-tight text-vez-ink sm:text-xl">Document Intelligence</h1>
              </div>
              <p className="mt-0.5 hidden text-sm text-vez-mute sm:block">
                {embeddedCount} {embeddedCount === 1 ? "document" : "documents"} indexed · {totalChunks.toLocaleString()} searchable passages
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="hidden items-center gap-2.5 xl:flex">
            {[
              { icon: <CheckCircle className="size-4 text-emerald-500" />, label: "Pipeline active" },
              { icon: <Clock className="size-4 text-vez-mute" />, label: `${docs.length} docs` },
              { icon: <RefreshCw className="size-4 text-vez-mute" />, label: "Refresh", action: () => loadDocs() },
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

          {/* View switcher (desktop) */}
          <div className="hidden items-center gap-1 rounded-xl bg-vez-surface p-1.5 lg:flex">
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
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Panels */}
        <div className="min-h-0 flex-1">
          {/* Desktop */}
          <div className="hidden h-full lg:block">
            {view === "split" && (
              <div ref={splitRef} className="flex h-full gap-0">
                <div className="h-full shrink-0" style={{ width: libWidth }}>
                  {Library}
                </div>
                <div
                  onMouseDown={handleResizeStart}
                  className="group flex h-full w-5 shrink-0 cursor-col-resize items-center justify-center"
                >
                  <div className="h-8 w-1 rounded-full bg-vez-line transition-colors group-hover:bg-vez-navy/40 group-active:bg-vez-navy" />
                </div>
                <div className="h-full min-w-0 flex-1">
                  {Chat}
                </div>
              </div>
            )}
            {view === "library" && <div className="h-full max-w-3xl">{Library}</div>}
            {view === "chat" && <div className="mx-auto h-full max-w-3xl">{Chat}</div>}
          </div>

          {/* Mobile: one panel + bottom tabs */}
          <div className="flex h-full flex-col gap-3 lg:hidden">
            <div className="min-h-0 flex-1">
              {mobileTab === "library" ? Library : Chat}
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-vez-surface p-1.5">
              {([
                { id: "library", icon: BookOpen,      label: "Library" },
                { id: "chat",    icon: MessageSquare, label: "Chat" },
              ] as const).map(m => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    onClick={() => setMobileTab(m.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      mobileTab === m.id
                        ? "bg-vez-navy text-white shadow-sm"
                        : "text-vez-mute"
                    }`}
                  >
                    <Icon className="size-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => loadDocs()} />}
    </div>
  )
}
