"use client"

import { useCallback, useRef, useState } from "react"
import {
  streamNoticeChat,
  type AnswerConfidence,
  type ChatStreamEvent,
  type ChatTurn,
  type NoticeSource,
} from "./api"

export type ChatStage = "searching" | "reading" | "answering" | null

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: NoticeSource[]
  confidence?: AnswerConfidence
  scope?: "notice" | "general"
  /** True while tokens are still arriving for this message. */
  streaming?: boolean
  /** Set when the user pressed stop before generation finished. */
  stopped?: boolean
}

export interface UseNoticeChatOptions {
  /** The notice currently open. The server decides whether a given question is
   * actually about it — this is context, not a scope lock. */
  noticeId?: string
  category?: string
  language?: string
}

/**
 * Streaming chat state for both the floating assistant and the in-notice Q&A.
 *
 * Both surfaces previously duplicated request handling — and diverged, so the
 * same question could behave differently depending on where it was typed.
 */
export function useNoticeChat(options: UseNoticeChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stage, setStage] = useState<ChatStage>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const reset = useCallback(() => {
    stop()
    setMessages([])
    setStage(null)
    setLoading(false)
  }, [stop])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || loading) return

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: question,
      }
      const assistantId = `a-${Date.now()}`

      // History is captured before the new turn is appended, so the model sees
      // the conversation as it stood when the question was asked.
      const history: ChatTurn[] = messages
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }))

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ])
      setLoading(true)
      setStage("searching")

      const controller = new AbortController()
      abortRef.current = controller

      const patch = (changes: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...changes } : m)),
        )

      const handleEvent = (event: ChatStreamEvent) => {
        switch (event.type) {
          case "scope":
            patch({ scope: event.scope })
            // A notice-scoped answer skips retrieval entirely; showing
            // "Searching notices…" for it would be a lie.
            setStage(event.scope === "notice" ? "reading" : "searching")
            break
          case "stage":
            setStage(event.stage)
            break
          case "sources":
            patch({ sources: event.sources })
            break
          case "delta":
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m,
              ),
            )
            setStage("answering")
            break
          case "done":
            patch({
              streaming: false,
              confidence: event.confidence,
              ...(event.sources?.length ? { sources: event.sources } : {}),
            })
            break
          case "error":
            patch({ content: event.error, streaming: false, confidence: "none" })
            break
        }
      }

      try {
        await streamNoticeChat(
          {
            question,
            noticeId: options.noticeId,
            category: options.category,
            language: options.language,
            history,
          },
          handleEvent,
          controller.signal,
        )
        patch({ streaming: false })
      } catch (err) {
        if (controller.signal.aborted) {
          // Deliberate stop: keep whatever text arrived rather than discarding
          // a partial answer the user may already have read.
          patch({ streaming: false, stopped: true })
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      "Sorry, I couldn't reach the assistant just now. Please try again.",
                    streaming: false,
                    confidence: "none",
                  }
                : m,
            ),
          )
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setLoading(false)
        setStage(null)
      }
    },
    [loading, messages, options.noticeId, options.category, options.language],
  )

  return { messages, send, stop, reset, loading, stage }
}
