"use client"

import React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Section eyebrow — sky dot + tracked uppercase label, consistent across sections. */
export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 text-sm uppercase tracking-[0.16em]",
        dark ? "text-white/50" : "text-vez-mute"
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-vez-sky" />
      {children}
    </p>
  )
}

/** Arrow that swaps out top-right while a twin slides in from bottom-left on group hover. */
export function SwapArrow({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block size-4 overflow-hidden", className)}>
      <ArrowUpRight className="absolute inset-0 size-4 transition-transform duration-300 ease-out group-hover:-translate-y-4 group-hover:translate-x-4" />
      <ArrowUpRight className="absolute inset-0 size-4 -translate-x-4 translate-y-4 transition-transform duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0" />
    </span>
  )
}

/** Navy pill CTA with the arrow-swap micro-interaction. */
export function ArrowCta({
  href,
  children,
  variant = "navy",
  className,
}: {
  href: string
  children: React.ReactNode
  variant?: "navy" | "frost" | "white"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-fit items-center gap-2 rounded-full px-6 py-3 text-base transition-all duration-300",
        variant === "navy" && "bg-vez-navy text-white hover:opacity-90",
        variant === "frost" && "bg-white/40 text-vez-ink backdrop-blur-[6px] hover:bg-white/70",
        variant === "white" && "bg-white text-vez-ink hover:bg-vez-surface",
        className
      )}
    >
      {children}
      <SwapArrow />
    </Link>
  )
}
