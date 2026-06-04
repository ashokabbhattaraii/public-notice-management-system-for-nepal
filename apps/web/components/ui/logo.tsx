// cSpell:ignore Suchana
"use client"

import React from "react"
import Link from "next/link"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showSubtitle?: boolean
  href?: string
  className?: string
}

export function Logo({ size = "md", showSubtitle = false, href = "/", className = "" }: LogoProps) {
  const cfg = {
    sm: { h: 28, name: "text-base", sub: "text-[9px]",  gap: "gap-1.5" },
    md: { h: 36, name: "text-xl",   sub: "text-[10px]", gap: "gap-2.5" },
    lg: { h: 44, name: "text-2xl",  sub: "text-xs",     gap: "gap-3"   },
  }[size]

  const inner = (
    <div className={`flex items-center ${cfg.gap} ${className}`}>
      {/* Original PNG icon — square-cropped, all-blue so it works in dark & light mode */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ width: cfg.h, height: cfg.h }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo1.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ height: cfg.h, width: "auto", display: "block" }}
        />
      </div>

      {/* Text — "Suchana" follows theme, "AI" always brand blue */}
      <div className="leading-none">
        <p className={`${cfg.name} font-bold tracking-tight leading-none`}>
          <span className="text-foreground">Suchana</span>
          <span className="text-[#2563EB]"> AI</span>
        </p>
        {showSubtitle && (
          <p className={`${cfg.sub} text-muted-foreground mt-0.5 font-medium`}>
            Public Notice Management
          </p>
        )}
      </div>
    </div>
  )

  if (!href) return inner

  return (
    <Link href={href} className="inline-flex items-center hover:opacity-80 transition-opacity shrink-0">
      {inner}
    </Link>
  )
}
