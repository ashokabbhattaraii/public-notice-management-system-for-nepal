"use client"

import React, { useState } from "react"
import {
  FileText,
  Search,
  Send,
  Upload,
  Bot,
  User,
  Eye,
  Download,
  Filter,
  Sparkles,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { mockDocuments } from "@/lib/mock-data"
import { ChatMessage } from "@/lib/types"

const demoResponses: Record<string, string> = {
  default: "Based on the documents in our system, I can help answer questions about Nepal's constitution, civil service regulations, education policies, procurement guidelines, and budget details. Please ask a specific question about any of these topics.",
  constitution: "According to the Constitution of Nepal 2072, Nepal is a federal democratic republic with three tiers of government: federal, provincial, and local. The constitution guarantees fundamental rights including the right to equality, freedom, and social justice. It was promulgated on September 20, 2015 (Ashwin 3, 2072 BS).",
  budget: "The Budget Speech FY 2082/83 allocates NRs. 1.8 trillion for the fiscal year. Key priorities include infrastructure development (32%), education (18%), health (12%), and social security (15%). The budget targets 6.5% economic growth.",
  procurement: "The Public Procurement Guidelines 2081 mandate that all government entities must use the e-bidding system for procurements above NRs. 2 million. Key changes include: reduced bid processing time to 15 days, mandatory technical evaluation committees, and enhanced transparency requirements.",
}

export default function RagPage() {
  const [docSearch, setDocSearch] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm the GovNotice Document AI. I can answer questions about government policies, laws, and regulations based on our document library. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ])

  const filteredDocs = mockDocuments.filter((d) =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.category.toLowerCase().includes(docSearch.toLowerCase())
  )

  const handleSend = () => {
    if (!chatInput.trim()) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    }

    const query = chatInput.toLowerCase()
    let response = demoResponses.default
    if (query.includes("constitution") || query.includes("fundamental")) {
      response = demoResponses.constitution
    } else if (query.includes("budget") || query.includes("fiscal")) {
      response = demoResponses.budget
    } else if (query.includes("procurement") || query.includes("bidding") || query.includes("tender")) {
      response = demoResponses.procurement
    }

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
      sources: ["Nepal Constitution 2072", "Budget Speech FY 2082/83"],
    }

    setMessages([...messages, userMsg, botMsg])
    setChatInput("")
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="size-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Document Intelligence</h1>
          </div>
          <p className="text-muted-foreground">Browse government documents and ask AI-powered questions</p>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="size-4" /> AI Chat
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <FileText className="size-4" /> Document Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="size-5 text-primary" /> Document Q&A
                </CardTitle>
                <CardDescription>Ask questions about government policies and documents</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" && (
                        <div className="size-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                          <Bot className="size-4 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[75%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent"} rounded-xl px-4 py-3`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        {msg.sources && (
                          <div className="mt-2 pt-2 border-t border-border/30">
                            <p className="text-xs opacity-70 mb-1">Sources:</p>
                            <div className="flex gap-1 flex-wrap">
                              {msg.sources.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="size-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="border-t border-border p-4">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Ask about government policies, laws, or regulations..."
                      className="flex-1"
                    />
                    <Button variant="default" onClick={handleSend} disabled={!chatInput.trim()}>
                      <Send className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Try: &quot;What does the constitution say about fundamental rights?&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="library">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search documents..." value={docSearch} onChange={(e) => setDocSearch(e.target.value)} className="pl-9" />
              </div>
              <Button variant="default" className="gap-2">
                <Upload className="size-4" /> Upload Document
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <Card key={doc.id} className="hover:border-primary/20 transition-all group">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {doc.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] mt-1">{doc.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{doc.summary}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{doc.fileSize}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> {doc.viewCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">
                        <MessageSquare className="size-3" /> Ask AI
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs gap-1">
                        <Download className="size-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  )
}
