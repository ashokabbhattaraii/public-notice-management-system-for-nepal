"use client"

import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface AnimatedHeadingProps {
  text: string
  className?: string
  as?: "h1" | "h2" | "h3"
}

/**
 * Section heading whose words rise out of clipped lines on scroll —
 * same motion language as the hero headline. Initial state lives in
 * CSS (.vz-word-line / .vz-word) to avoid a pre-hydration flash.
 */
export function AnimatedHeading({ text, className, as = "h2" }: AnimatedHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const words = el.querySelectorAll(".vz-word")
    if (!words.length) return

    const tween = gsap.fromTo(
      words,
      { yPercent: 110 },
      {
        yPercent: 0,
        duration: 0.9,
        stagger: 0.06,
        ease: "power4.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
      }
    )

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [text])

  const Tag = as as React.ElementType

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="vz-word-line" aria-hidden="true">
          <span className="vz-word">{word}&nbsp;</span>
        </span>
      ))}
    </Tag>
  )
}
