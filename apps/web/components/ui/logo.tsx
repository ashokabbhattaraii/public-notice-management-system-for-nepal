"use client"

import React from "react"
import Link from "next/link"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  href?: string
  className?: string
  /** @deprecated kept for backwards compat — has no effect */
  showSubtitle?: boolean
}

const sizes = {
  sm: { img: 52,  text: "text-sm"  },
  md: { img: 68,  text: "text-lg"  },
  lg: { img: 88,  text: "text-2xl" },
}

export function Logo({ size = "md", href = "/", className = "" }: LogoProps) {
  const { img, text } = sizes[size]

  const inner = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="Suchana AI logo"
        draggable={false}
        className="shrink-0 rounded-xl"
        style={{ height: img, width: "auto", display: "block", filter: "drop-shadow(0 2px 8px rgba(99,102,241,0.35))" }}
      />
      <span className={`${text} font-bold tracking-tight leading-none`}>
        <span className="text-foreground">Suchana</span>
        <span className="text-indigo-400"> AI</span>
      </span>
    </div>
  )

  if (!href) return inner
  return (
    <Link href={href} className="inline-flex items-center hover:opacity-80 transition-opacity shrink-0">
      {inner}
    </Link>
  )
}
