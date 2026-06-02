import Link from "next/link"
import { FileText } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="size-8 rounded-lg gradient-primary flex items-center justify-center">
                <FileText className="size-4 text-white" />
              </div>
              <span className="font-bold text-lg">GovNotice</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nepal&apos;s centralized repository for all government and public sector notices.
              Transparent, accessible, and verified.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Platform</h4>
            <ul className="space-y-2.5">
              <li><Link href="/notices" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Browse Notices</Link></li>
              <li><Link href="/rag" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Document Search</Link></li>
              <li><Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">API Documentation</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Developer Guide</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Open Data</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Data Retention</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; 2082 GovNotice. Government of Nepal. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted">
              v1.0.0-beta
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
