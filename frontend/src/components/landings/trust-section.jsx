import { Eye, KeyRound, Lock, ServerCog } from 'lucide-react'

const highlights = [
  {
    icon: Lock,
    title: 'Encrypted end to end',
    body: 'AES-256 at rest, TLS 1.3 in transit, and per-tenant key isolation across every environment.',
  },
  {
    icon: Eye,
    title: 'Read-only by design',
    body: 'AI Compliance Auditor never writes to your production systems. Least-privilege scopes are enforced on every connector.',
  },
  {
    icon: KeyRound,
    title: 'Enterprise access control',
    body: 'SAML SSO, SCIM provisioning, and granular role-based permissions for auditors and internal reviewers.',
  },
  {
    icon: ServerCog,
    title: 'No training on your data',
    body: 'Customer evidence is never used to train models, with regional data residency available on request.',
  },
]

const attestations = [
  { name: 'SOC 2 Type II', detail: 'Independently attested' },
  { name: 'ISO 27001', detail: 'Certified ISMS' },
  { name: 'GDPR', detail: 'DPA + SCCs available' },
  { name: 'HIPAA', detail: 'BAA supported' },
  { name: 'EU AI Act', detail: 'Governance-ready' },
]

export default function TrustSection({ onGetStarted }) {
  return (
    <section
      id="trust"
      className="relative border-b border-border/60 py-20 md:py-28"
    >
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-[26rem] rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
              Trust &amp; compliance
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
              Built to the standard it audits against
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">
              Security review is the first thing our customers put us through,
              so the platform is engineered for it — least privilege, full
              auditability, and no data ever leaving your control boundary
              unnecessarily.
            </p>

            <dl className="mt-9 flex flex-col divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/60">
              {attestations.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <dt className="text-sm font-medium">{item.name}</dt>
                  <dd className="text-xs text-muted-foreground">
                    {item.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {highlights.map((item) => (
              <article
                key={item.title}
                className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-card/70 p-6 transition-colors hover:border-primary/35"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 ring-1 ring-primary/25">
                  <item.icon
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                </span>
                <h3 className="text-base font-medium tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
