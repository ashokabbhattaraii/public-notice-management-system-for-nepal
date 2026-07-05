"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

const headlines = [
  { text: "PSC Section Officer Exam 2082 - Application deadline: Shrawan 15, 2082", id: "n1", title: "Nepal Public Service Commission - Section Officer Exam 2082" },
  { text: "Ministry of Education: 2,500 permanent teacher positions announced across all 7 provinces", id: "n2", title: "Ministry of Education - Teacher Recruitment Drive 2082" },
  { text: "Road Division Office - Highway Construction Tender for Province 5 (45km section)", id: "n3", title: "Road Division Office - Highway Construction Tender" },
  { text: "Nepal Rastra Bank: New monetary policy circular published - effective immediately", id: "n5", title: "Nepal Rastra Bank - Monetary Policy Circular" },
  { text: "Judicial Service Commission - Section Officer written exam results published", id: "n6", title: "Judicial Service Commission - Section Officer Results" },
  { text: "Ministry of Finance: Budget allocation notice for FY 2082/83 released", id: "n7", title: "Ministry of Finance - Budget Allocation Notice" },
]

function generateSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + id
}

export function NewsTicker() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cycle headlines
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % headlines.length)
        setAnimating(false)
      }, 350)
    }, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Hide on scroll down, show on scroll up
  const handleScroll = useCallback(() => {
    const y = window.scrollY
    setHidden(y > 120 && y > lastScrollY.current)
    lastScrollY.current = y
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  return (
    <div
      className={`fixed top-20 left-0 right-0 z-40 transition-all duration-300 ${
        hidden ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="mx-auto max-w-[1480px] px-6 pt-1.5 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 rounded-full bg-white/40 backdrop-blur-xl border border-white/60 px-4 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-vez-navy/8 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-vez-navy animate-pulse" />
            <span className="text-[11px] font-medium tracking-wider uppercase text-vez-navy/70">Live</span>
          </span>
          <span className="h-3.5 w-px bg-vez-ink/10" />
          <div className="min-w-0 flex-1 overflow-hidden">
            <Link
              href={`/notices/${generateSlug(headlines[current].title, headlines[current].id)}`}
              className="block truncate text-[13px] text-vez-ink/75 transition-colors hover:text-vez-navy"
            >
              <span
                className={`inline-block transition-all duration-300 ease-out ${
                  animating
                    ? "opacity-0 -translate-y-1.5 blur-[2px]"
                    : "opacity-100 translate-y-0 blur-0"
                }`}
              >
                {headlines[current].text}
              </span>
            </Link>
          </div>
          <Link
            href="/notices"
            className="hidden shrink-0 rounded-full bg-vez-navy/8 px-3 py-1 text-[11px] font-medium text-vez-navy/70 transition-colors hover:bg-vez-navy hover:text-white md:block"
          >
            All notices
          </Link>
        </div>
      </div>
    </div>
  )
}
