"use client"

import React, { useEffect, useRef } from "react"

interface CountUpProps {
  /** Display value, e.g. "50+", "10K+", "99.9%", "24/7", "~70%", "2×" */
  value: string
  className?: string
  durationMs?: number
}

/** Animates the leading number of a stat (prefix/suffix preserved) when scrolled into view. */
export function CountUp({ value, className, durationMs = 1400 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const match = value.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/)
    if (!match) return

    const [, prefix, numStr, suffix] = match
    const target = parseFloat(numStr)
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          observer.disconnect()

          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            el.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      },
      { threshold: 0.4 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [value, durationMs])

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
