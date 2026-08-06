import React from 'react'
import { ShieldCheck } from 'lucide-react'

const navLinks = [
  { label: 'Problem', href: '#problem' },
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Trust', href: '#trust' },
]

export default function SiteHeader({ onSignIn }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            AI Compliance Auditor
          </span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={onSignIn}
          className="rounded-lg border border-border/80 px-3.5 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </header>
  )
}