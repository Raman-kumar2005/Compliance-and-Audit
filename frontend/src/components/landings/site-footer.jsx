import { ShieldCheck } from 'lucide-react'

export default function SiteFooter({ onGetStarted }) {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 px-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">AI Compliance Auditor</span>
        </div>
        <p className="text-xs text-muted-foreground">
          AI compliance auditing for regulated enterprises.
        </p>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Compliance Auditor, Inc.
        </p>
      </div>
    </footer>
  )
}
