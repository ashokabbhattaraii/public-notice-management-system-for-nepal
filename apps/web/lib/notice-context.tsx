"use client"

import React, { createContext, useContext, useState } from "react"

export interface NoticeContext {
  id: string
  title: string
  contentText: string | null
  aiSummary: string | null
  keyFacts: string[] | null
  sourceLabel: string
}

interface NoticeContextValue {
  activeNotice: NoticeContext | null
  setActiveNotice: (notice: NoticeContext | null) => void
}

const Ctx = createContext<NoticeContextValue>({ activeNotice: null, setActiveNotice: () => {} })

export function NoticeContextProvider({ children }: { children: React.ReactNode }) {
  const [activeNotice, setActiveNotice] = useState<NoticeContext | null>(null)
  return <Ctx.Provider value={{ activeNotice, setActiveNotice }}>{children}</Ctx.Provider>
}

export function useNoticeContext() {
  return useContext(Ctx)
}
