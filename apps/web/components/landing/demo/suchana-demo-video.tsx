"use client"

import React from "react"
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

export const DEMO_FPS = 30
export const DEMO_DURATION = 480
export const DEMO_WIDTH = 1280
export const DEMO_HEIGHT = 720

const SKY = "#a2c5d3"
const NAVY = "#101d23"
const INK = "#333333"
const MUTE = "#666666"
const SURFACE = "#f5f5f5"
const LINE = "#e5e7eb"
const FONT = "var(--font-poppins), Poppins, sans-serif"

const SCENE_LEN = 120

/** Fade a scene in/out at its edges. */
function useSceneOpacity(length: number) {
  const frame = useCurrentFrame()
  return interpolate(frame, [0, 14, length - 14, length], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
}

function SceneTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame, fps, config: { damping: 16 } })

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 80,
        transform: `translateY(${interpolate(rise, [0, 1], [24, 0])}px)`,
        opacity: rise,
      }}
    >
      <div style={{ fontSize: 20, color: MUTE }}>{eyebrow}</div>
      <div style={{ fontSize: 44, color: INK, letterSpacing: "-0.04em", marginTop: 8 }}>
        {title}
      </div>
    </div>
  )
}

/* ── Scene 1: scattered portals converge into one feed ── */

const portals = [
  { label: "psc.gov.np", x: -420, y: -150, rot: -8 },
  { label: "mof.gov.np", x: 430, y: -170, rot: 10 },
  { label: "moe.gov.np", x: -460, y: 130, rot: 6 },
  { label: "nrb.org.np", x: 460, y: 150, rot: -10 },
  { label: "ppmo.gov.np", x: -260, y: 230, rot: 12 },
  { label: "doim.gov.np", x: 280, y: 240, rot: -6 },
]

function SceneAggregate() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = useSceneOpacity(SCENE_LEN)

  const feedPop = spring({ frame: frame - 50, fps, config: { damping: 13 } })

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle eyebrow="Step 1 — Aggregation" title="50+ portals become one feed." />

      {/* Central feed card */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "58%",
          width: 460,
          padding: 28,
          borderRadius: 24,
          background: "#ffffff",
          border: `1px solid ${LINE}`,
          transform: `translate(-50%, -50%) scale(${interpolate(feedPop, [0, 1], [0.6, 1])})`,
          opacity: feedPop,
        }}
      >
        <div style={{ fontSize: 22, color: INK }}>Unified notice feed</div>
        {[0.9, 0.7, 0.8].map((w, i) => (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 100,
              background: i === 0 ? SKY : SURFACE,
              width: `${w * 100}%`,
              marginTop: 16,
            }}
          />
        ))}
      </div>

      {/* Portal chips flying inward */}
      {portals.map((p, i) => {
        const drive = spring({ frame: frame - i * 5, fps, config: { damping: 15 } })
        const x = interpolate(drive, [0, 1], [p.x, 0])
        const y = interpolate(drive, [0, 1], [p.y, 60])
        const rot = interpolate(drive, [0, 1], [p.rot, 0])
        const fade = interpolate(frame, [44 + i * 3, 58 + i * 3], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
        return (
          <div
            key={p.label}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              padding: "12px 24px",
              borderRadius: 100,
              background: "#ffffff",
              border: `1px solid ${LINE}`,
              fontSize: 18,
              color: MUTE,
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg)`,
              opacity: Math.min(drive, fade),
            }}
          >
            {p.label}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ── Scene 2: scanned PDF → OCR → readable summary ── */

function SceneOcr() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = useSceneOpacity(SCENE_LEN)

  const docIn = spring({ frame, fps, config: { damping: 15 } })
  const scanY = interpolate(frame, [15, 70], [0, 250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const badgePop = spring({ frame: frame - 72, fps, config: { damping: 11 } })

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle eyebrow="Step 2 — AI processing" title="Scanned PDFs become readable." />

      {/* Scanned document */}
      <div
        style={{
          position: "absolute",
          left: 200,
          top: 230,
          width: 320,
          height: 300,
          borderRadius: 20,
          background: "#ffffff",
          border: `1px solid ${LINE}`,
          overflow: "hidden",
          transform: `translateY(${interpolate(docIn, [0, 1], [40, 0])}px)`,
          opacity: docIn,
        }}
      >
        {/* Blurry "scan" bars */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 16,
              borderRadius: 4,
              background: "#d8d8d8",
              filter: "blur(3px)",
              margin: "20px 24px 0",
              width: `${[82, 70, 88, 60, 78, 66, 50][i]}%`,
            }}
          />
        ))}
        {/* Scan line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 20 + scanY,
            height: 4,
            background: SKY,
            boxShadow: `0 0 24px 6px ${SKY}`,
          }}
        />
      </div>

      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          left: 575,
          top: 365,
          fontSize: 44,
          color: MUTE,
          opacity: interpolate(frame, [30, 45], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        →
      </div>

      {/* Extracted summary */}
      <div
        style={{
          position: "absolute",
          left: 680,
          top: 230,
          width: 400,
          padding: 28,
          borderRadius: 20,
          background: "#ffffff",
          border: `1px solid ${LINE}`,
        }}
      >
        <div style={{ fontSize: 20, color: INK }}>AI summary</div>
        {[0.95, 0.85, 0.9, 0.6].map((w, i) => {
          const lineIn = interpolate(frame, [34 + i * 9, 46 + i * 9], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
          return (
            <div
              key={i}
              style={{
                height: 13,
                borderRadius: 100,
                background: SURFACE,
                marginTop: 16,
                width: `${w * 100 * lineIn}%`,
              }}
            />
          )
        })}
        <div
          style={{
            display: "inline-block",
            marginTop: 22,
            padding: "8px 20px",
            borderRadius: 100,
            background: NAVY,
            color: "#ffffff",
            fontSize: 16,
            transform: `scale(${interpolate(badgePop, [0, 1], [0.5, 1])})`,
            opacity: badgePop,
          }}
        >
          94% OCR confidence
        </div>
      </div>
    </AbsoluteFill>
  )
}

/* ── Scene 3: instant alerts ── */

function SceneAlerts() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = useSceneOpacity(SCENE_LEN)

  const bellPop = spring({ frame: frame - 8, fps, config: { damping: 10 } })

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle eyebrow="Step 3 — Smart alerts" title="You hear about it first." />

      {/* Bell with ripple rings */}
      <div style={{ position: "absolute", left: 280, top: 400 }}>
        {[0, 1, 2].map((i) => {
          const ring = interpolate(frame, [20 + i * 22, 70 + i * 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 120,
                height: 120,
                borderRadius: 1000,
                border: `2px solid ${SKY}`,
                transform: `translate(-50%, -50%) scale(${1 + ring * 1.8})`,
                opacity: 1 - ring,
              }}
            />
          )
        })}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            borderRadius: 1000,
            background: NAVY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate(-50%, -50%) scale(${bellPop})`,
            fontSize: 48,
          }}
        >
          🔔
        </div>
      </div>

      {/* Notification cards sliding in */}
      {[
        { title: "PSC — Section Officer Exam 2082", tag: "Exams", delay: 26 },
        { title: "Highway Construction Tender", tag: "Tenders", delay: 44 },
      ].map((n, i) => {
        const slide = spring({ frame: frame - n.delay, fps, config: { damping: 15 } })
        return (
          <div
            key={n.title}
            style={{
              position: "absolute",
              left: 520,
              top: 300 + i * 130,
              width: 560,
              padding: 24,
              borderRadius: 20,
              background: "#ffffff",
              border: `1px solid ${LINE}`,
              display: "flex",
              alignItems: "center",
              gap: 20,
              transform: `translateX(${interpolate(slide, [0, 1], [120, 0])}px)`,
              opacity: slide,
            }}
          >
            <div
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                background: SKY,
                color: NAVY,
                fontSize: 16,
                whiteSpace: "nowrap",
              }}
            >
              {n.tag}
            </div>
            <div style={{ fontSize: 20, color: INK }}>{n.title}</div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

/* ── Scene 4: plain-language search + tagline ── */

const QUERY = "When is the PSC Section Officer exam?"

function SceneSearch() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = useSceneOpacity(SCENE_LEN)

  const typed = QUERY.slice(
    0,
    Math.round(
      interpolate(frame, [10, 55], [0, QUERY.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    )
  )
  const answerIn = spring({ frame: frame - 60, fps, config: { damping: 14 } })
  const taglineIn = spring({ frame: frame - 86, fps, config: { damping: 16 } })

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneTitle eyebrow="Step 4 — Ask anything" title="Answers from real documents." />

      {/* Search pill */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 240,
          transform: "translateX(-50%)",
          width: 760,
          padding: "20px 32px",
          borderRadius: 100,
          background: "#ffffff",
          border: `1px solid ${LINE}`,
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 22,
          color: INK,
        }}
      >
        <span style={{ color: MUTE }}>⌕</span>
        {typed}
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: MUTE }}>|</span>
      </div>

      {/* Answer card */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 340,
          width: 760,
          padding: 28,
          borderRadius: 24,
          background: "#ffffff",
          border: `1px solid ${LINE}`,
          transform: `translateX(-50%) translateY(${interpolate(answerIn, [0, 1], [40, 0])}px)`,
          opacity: answerIn,
          fontSize: 20,
          color: INK,
          lineHeight: 1.5,
        }}
      >
        The written exam is scheduled for <b>Shrawan 15, 2082</b>. Applications close two
        weeks earlier.
        <div style={{ marginTop: 16, fontSize: 16, color: MUTE }}>
          Source: psc.gov.np — Section Officer Notice 2082
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 580,
          transform: `translateX(-50%) translateY(${interpolate(taglineIn, [0, 1], [24, 0])}px)`,
          opacity: taglineIn,
          fontSize: 34,
          color: INK,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
        }}
      >
        Every public notice. One place.
      </div>
    </AbsoluteFill>
  )
}

/* ── Root composition ── */

export function SuchanaDemoVideo() {
  return (
    <AbsoluteFill style={{ background: SURFACE, fontFamily: FONT, fontWeight: 400 }}>
      {/* Sky wash at the top, echoing the hero */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${SKY}33 0%, transparent 40%)`,
        }}
      />
      <Sequence durationInFrames={SCENE_LEN}>
        <SceneAggregate />
      </Sequence>
      <Sequence from={SCENE_LEN} durationInFrames={SCENE_LEN}>
        <SceneOcr />
      </Sequence>
      <Sequence from={SCENE_LEN * 2} durationInFrames={SCENE_LEN}>
        <SceneAlerts />
      </Sequence>
      <Sequence from={SCENE_LEN * 3} durationInFrames={SCENE_LEN}>
        <SceneSearch />
      </Sequence>
    </AbsoluteFill>
  )
}
