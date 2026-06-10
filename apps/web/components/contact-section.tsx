"use client"

import React, { useEffect, useRef, useState } from "react"
import { Mail, Phone, MapPin, Send, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function ContactSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    if (!sectionRef.current) return

    const heading = headingRef.current
    const form = formRef.current
    const cards = cardsRef.current?.querySelectorAll(".contact-card")

    const reset = () => {
      gsap.killTweensOf([heading, form, cards])
      gsap.set(heading, { opacity: 0, y: 40 })
      gsap.set(form, { opacity: 0, x: -40 })
      gsap.set(cards ?? [], { opacity: 0, y: 30, scale: 0.9 })
    }

    const play = () => {
      // Heading entrance
      gsap.to(heading, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power3.out",
      })

      // Form entrance
      gsap.to(form, {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: "power3.out",
        delay: 0.2,
      })

      // Contact cards stagger
      gsap.to(Array.from(cards ?? []), {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.3,
        stagger: 0.15,
        ease: "back.out(1.5)",
        delay: 0.3,
      })
    }

    reset()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            play()
          } else {
            reset()
          }
        })
      },
      { threshold: 0.15 }
    )

    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock submission
    setStatus("success")
    setTimeout(() => {
      setStatus("idle")
      setFormState({ name: "", email: "", subject: "", message: "" })
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value })
  }

  const contactInfo = [
    {
      icon: Mail,
      label: "Email",
      value: "support@suchana.ai",
      href: "mailto:support@suchana.ai",
    },
    {
      icon: Phone,
      label: "Phone",
      value: "+977 9800000000",
      href: "tel:+9779800000000",
    },
    {
      icon: MapPin,
      label: "Location",
      value: "Kathmandu, Nepal",
      href: "#",
    },
  ]

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="relative py-12 md:py-20 lg:py-24 px-6 md:px-8 lg:px-12 overflow-hidden bg-background"
    >
      {/* Technical grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="contact-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contact-grid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto">
        {/* Tactical header */}
        <div ref={headingRef} className="mb-12 border-l-2 border-indigo-500 pl-5 relative max-w-3xl">
          <div className="absolute -left-[2px] top-0 w-4 h-px bg-indigo-500" />
          <div className="absolute -left-[2px] bottom-0 w-4 h-px bg-indigo-500" />

          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-sm bg-indigo-400 opacity-75 animate-ping" />
              <span className="relative inline-flex size-2 rounded-sm bg-indigo-500" />
            </span>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-indigo-400">
              [CONTACT_INTERFACE // GET_IN_TOUCH]
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight uppercase tracking-tight">
            Let&apos;s Build <span className="text-indigo-400">Together</span>
          </h2>

          <div className="flex gap-4 items-center mt-6">
            <div className="h-0.5 w-16 bg-indigo-500/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-indigo-500 w-full h-full animate-[scanline_2s_linear_infinite]" />
            </div>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl font-normal">
              Have questions, feedback, or partnership inquiries? We&apos;d love to hear from you.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_0.9fr] gap-8">
          {/* Contact Form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="relative bg-card backdrop-blur-xl p-6 md:p-8 border border-border"
          >
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-indigo-500" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-indigo-500" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-indigo-500" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-indigo-500" />

            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Name
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    className="h-11 bg-background/60 border-border focus-visible:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    className="h-11 bg-background/60 border-border focus-visible:ring-indigo-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Subject
                </label>
                <Input
                  type="text"
                  name="subject"
                  value={formState.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  required
                  className="h-11 bg-background/60 border-border focus-visible:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  value={formState.message}
                  onChange={handleChange}
                  placeholder="Tell us more about your inquiry..."
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-background/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/40 transition-all resize-none"
                />
              </div>

              {status === "success" && (
                <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-sm font-medium">
                  <CheckCircle2 className="size-4" />
                  <span>Message sent successfully! We&apos;ll get back to you soon.</span>
                </div>
              )}

              {status === "error" && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
                  <AlertCircle className="size-4" />
                  <span>Something went wrong. Please try again.</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 gap-2 text-sm font-semibold uppercase tracking-wide bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 shadow-lg shadow-indigo-500/20"
              >
                <Send className="size-4" />
                Send Message
              </Button>
            </div>
          </form>

          {/* Contact Info Cards */}
          <div ref={cardsRef} className="space-y-4">
            {contactInfo.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="contact-card block relative bg-card backdrop-blur-xl p-6 border border-border group hover:bg-card transition-all duration-300"
                >
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-500" />
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-500" />
                  <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-500" />
                  <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-500" />

                  {/* Hover scan */}
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative flex items-center gap-4">
                    <div className="size-12 bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="size-5 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {item.label}
                      </p>
                      <p className="text-base font-medium text-foreground group-hover:text-indigo-400 transition-colors">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </a>
              )
            })}

            {/* Business Hours */}
            <div className="contact-card relative bg-card backdrop-blur-xl p-6 border border-border">
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-indigo-500" />
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-indigo-500" />
              <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-indigo-500" />
              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-indigo-500" />

              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Business Hours
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sunday - Friday</span>
                  <span className="text-foreground font-medium">10:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saturday</span>
                  <span className="text-destructive">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
