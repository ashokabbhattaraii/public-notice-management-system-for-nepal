"use client"

import React, { useEffect, useRef } from "react"
import { Player, PlayerRef } from "@remotion/player"
import {
  SuchanaDemoVideo,
  DEMO_DURATION,
  DEMO_FPS,
  DEMO_WIDTH,
  DEMO_HEIGHT,
} from "./suchana-demo-video"

/**
 * Remotion player that restarts from frame 0 every time it scrolls
 * back into view, and pauses while off-screen.
 */
export function DemoPlayer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playerRef.current?.seekTo(0)
          playerRef.current?.play()
        } else {
          playerRef.current?.pause()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef}>
      <Player
        ref={playerRef}
        component={SuchanaDemoVideo}
        durationInFrames={DEMO_DURATION}
        fps={DEMO_FPS}
        compositionWidth={DEMO_WIDTH}
        compositionHeight={DEMO_HEIGHT}
        style={{ width: "100%" }}
        loop
        acknowledgeRemotionLicense
      />
    </div>
  )
}
