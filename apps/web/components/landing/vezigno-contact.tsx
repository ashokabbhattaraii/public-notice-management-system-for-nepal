"use client"

import React, { useState } from "react"
import { Mail, Phone, MapPin, CheckCircle2 } from "lucide-react"
import { Reveal } from "./reveal"
import { AnimatedHeading } from "./animated-heading"

const contactInfo = [
  { icon: Mail, label: "Email", value: "support@suchana.ai", href: "mailto:support@suchana.ai" },
  { icon: Phone, label: "Phone", value: "+977 9800000000", href: "tel:+9779800000000" },
  { icon: MapPin, label: "Location", value: "Kathmandu, Nepal", href: "#" },
]

const inputClass =
  "w-full rounded-[12px] border border-vez-line bg-white px-4 py-3 text-base text-vez-ink outline-none transition-colors placeholder:text-vez-mute focus:border-vez-sky"

export function VezignoContact() {
  const [formState, setFormState] = useState({ name: "", email: "", subject: "", message: "" })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setFormState({ name: "", email: "", subject: "", message: "" })
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState({ ...formState, [e.target.name]: e.target.value })
  }

  return (
    <section id="contact" className="bg-white">
      <div className="mx-auto max-w-[1480px] px-6 py-16 md:px-8 md:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <p className="text-base text-vez-mute">Contact</p>
        </Reveal>
        <AnimatedHeading
          text="Questions, feedback, or partnerships — write to us."
          className="mt-4 max-w-[18ch] text-[clamp(36px,4.5vw,64px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink"
        />

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Form card */}
          <Reveal>
            <form onSubmit={handleSubmit} className="rounded-[24px] bg-vez-surface p-8 md:p-10">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-vez-mute">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm text-vez-mute">Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={formState.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  required
                  className={inputClass}
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm text-vez-mute">Message</label>
                <textarea
                  name="message"
                  value={formState.message}
                  onChange={handleChange}
                  placeholder="Tell us more about your inquiry…"
                  required
                  rows={6}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {sent && (
                <div className="mt-5 flex items-center gap-2 rounded-[12px] bg-vez-sky/30 px-4 py-3 text-base text-vez-ink">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Message sent successfully! We&apos;ll get back to you soon.
                </div>
              )}

              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-vez-navy px-6 py-3.5 text-base text-white transition-opacity hover:opacity-90 sm:w-auto"
              >
                Send message
              </button>
            </form>
          </Reveal>

          {/* Info cards */}
          <div className="flex flex-col gap-6">
            {contactInfo.map((item, i) => {
              const Icon = item.icon
              return (
                <Reveal key={item.label} delay={i * 80}>
                  <a
                    href={item.href}
                    className="flex items-center gap-5 rounded-[20px] bg-vez-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-vez-sky/20"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white">
                      <Icon className="size-5 text-vez-navy" />
                    </div>
                    <div>
                      <p className="text-sm text-vez-mute">{item.label}</p>
                      <p className="text-base text-vez-ink">{item.value}</p>
                    </div>
                  </a>
                </Reveal>
              )
            })}

            <Reveal delay={240}>
              <div className="rounded-[20px] bg-vez-surface p-6">
                <p className="text-sm text-vez-mute">Business hours</p>
                <div className="mt-3 flex justify-between text-base">
                  <span className="text-vez-mute">Sunday – Friday</span>
                  <span className="text-vez-ink">10:00 AM – 6:00 PM</span>
                </div>
                <div className="mt-2 flex justify-between text-base">
                  <span className="text-vez-mute">Saturday</span>
                  <span className="text-vez-ink">Closed</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
