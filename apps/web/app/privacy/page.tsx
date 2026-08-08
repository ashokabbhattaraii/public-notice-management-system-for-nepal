import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white font-poppins antialiased">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-12">
        <Link
          href="/"
          className="mb-10 flex w-fit items-center gap-2 text-base text-vez-mute transition-colors hover:text-vez-ink"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className="text-[clamp(32px,4vw,44px)] font-normal leading-[1.15] tracking-[-0.04em] text-vez-ink">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-vez-mute">Last updated: June 15, 2026</p>

        <div className="mt-10 flex flex-col gap-8 text-base leading-7 text-vez-ink/80">
          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">1. Introduction</h2>
            <p>
              Suchana AI (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to
              protecting your privacy. This policy explains how we collect, use, and
              safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">2. Information We Collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account information:</strong> When you sign in with Google, we
                receive your name, email address, and profile picture.
              </li>
              <li>
                <strong>Usage data:</strong> We collect anonymized usage analytics such as
                pages visited and features used.
              </li>
              <li>
                <strong>Saved preferences:</strong> Alert settings, saved notices, and
                search history tied to your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide and improve our services.</li>
              <li>Send notice alerts you have subscribed to.</li>
              <li>Maintain platform security and prevent abuse.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">4. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share information only with
              service providers who help operate the platform (e.g., hosting, analytics),
              and only as necessary to provide our services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You may
              request deletion of your account and associated data at any time by
              contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">6. Security</h2>
            <p>
              We implement industry-standard security measures to protect your data,
              including encrypted connections (HTTPS) and secure authentication via OAuth
              2.0.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">7. Your Rights</h2>
            <p>
              You may access, correct, or delete your personal information at any time.
              Contact us at{" "}
              <a
                href="mailto:ashok.ab.bhattaraii@gmail.com"
                className="text-vez-navy underline underline-offset-2"
              >
                ashok.ab.bhattaraii@gmail.com
              </a>{" "}
              for any privacy-related requests.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-vez-ink">8. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Changes will be posted on this
              page with an updated revision date.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
