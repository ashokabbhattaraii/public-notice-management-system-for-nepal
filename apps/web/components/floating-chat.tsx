"use client"

import React, { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Bot, User, Sparkles, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import gsap from "gsap"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const suggestions = [
  "What exams are coming up?",
  "Latest tender notices",
  "NRB policy updates",
  "Teacher recruitment info",
]

const mockResponses: Record<string, string> = {
  "exam": "Based on the latest notices, the Nepal Public Service Commission Section Officer Exam 2082 is scheduled with applications open until Shrawan 15, 2082. Tribhuvan University PhD admissions are also open with entrance exams on Bhadra 1, 2082.",
  "tender": "There are 2 active tenders: 1) Road Division Office - Highway Construction (45km, Province 5, deadline Jun 20, 2026) and 2) Department of Roads - Bridge Construction in Karnali Province (ICB, deadline Jul 14, 2026, ADB funded).",
  "policy": "Nepal Rastra Bank issued updated monetary policy guidelines for FY 2082/83 including revised interest rate corridors and digital payment regulations. Nepal Electricity Authority also announced a 50% subsidy program for rooftop solar installations.",
  "teacher": "The Ministry of Education announced 2,500 permanent teaching positions across all 7 provinces at primary, lower-secondary, and secondary levels. Deadline: Jun 30, 2026. Applications via online portal only.",
  "default": "I can help you find information about government notices including exams, vacancies, tenders, and policy updates. Try asking about specific topics or browse the notices page for full details.",
}

function getResponse(query: string): string {
  const q = query.toLowerCase()
  if (q.includes("exam") || q.includes("psc")) return mockResponses.exam
  if (q.includes("tender") || q.includes("bid") || q.includes("procurement")) return mockResponses.tender
  if (q.includes("policy") || q.includes("nrb") || q.includes("monetary")) return mockResponses.policy
  if (q.includes("teacher") || q.includes("education") || q.includes("recruit")) return mockResponses.teacher
  return mockResponses.default
}

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

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
  }, [messages, typing])

  const handleSend = (text?: string) => {
    const query = text || input.trim()
    if (!query) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: query }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setTyping(true)

    setTimeout(() => {
      const response = getResponse(query)
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: response }
      setMessages(prev => [...prev, botMsg])
      setTyping(false)
    }, 800 + Math.random() * 700)
  }

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
              <div>
                <p className="text-sm font-semibold">GovNotice AI</p>
                <p className="text-[10px] text-muted-foreground">Ask about any government notice</p>
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="size-6 text-primary" />
                </div>
                <p className="text-sm font-medium mb-1">How can I help?</p>
                <p className="text-xs text-muted-foreground mb-4">Ask about notices, exams, tenders, or policies</p>
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
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-accent/60 rounded-bl-sm"
                )}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="size-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <User className="size-3" />
                  </div>
                )}
              </div>
            ))}

            {typing && (
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
                placeholder="Ask about notices..."
                className="flex-1 h-9 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/50 transition-colors"
              />
              <Button type="submit" size="icon" className="size-9 rounded-lg shrink-0" disabled={!input.trim()}>
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
