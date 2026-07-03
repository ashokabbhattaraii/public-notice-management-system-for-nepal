"use client"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { VezignoContact } from "@/components/landing/vezigno-contact"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Header />

      {/* Hero */}
      <section className="bg-vez-sky">
        <div className="mx-auto max-w-[1480px] px-6 py-20 md:px-8 md:py-28 lg:px-12">
          <p className="text-base text-vez-ink/70">Contact Suchana AI</p>
          <h1 className="mt-4 max-w-[16ch] text-[clamp(40px,5.5vw,80px)] font-normal leading-[1.12] tracking-[-0.04em] text-vez-ink">
            We&apos;d love to hear from you.
          </h1>
          <p className="mt-6 max-w-[52ch] text-base leading-6 text-vez-ink/80 md:text-lg">
            Questions, feedback, partnership ideas, or an Organization plan enquiry —
            send us a message and we&apos;ll get back within one business day.
          </p>
        </div>
      </section>

      <VezignoContact />

      <Footer />
    </div>
  )
}
