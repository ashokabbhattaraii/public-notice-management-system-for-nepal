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
 * into view (or is already visible on mount), and pauses while off-screen.
 */
export function DemoPlayer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerRef>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    function startPlayback() {
      if (playerRef.current) {
        playerRef.current.seekTo(0)
        playerRef.current.play()
      } else {
        // Player ref not ready yet, retry on next frame
        requestAnimationFrame(startPlayback)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startPlayback()
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
