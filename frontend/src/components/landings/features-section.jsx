import {
  Sparkles,
  Layers,
  Search,
  ShieldAlert,
  GitCompare,
  ScrollText,
} from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'Executive AI Summary Box',
    body: 'Translates thousands of raw logs into standard, plain-English executive summaries listing the biggest risk, the root cause, and required action in seconds.',
    span: true,
    points: [
      'Identifies critical exfiltration risks and credentials exposure',
      'Recommends immediate priority actions to compliance leaders',
    ],
  },
  {
    icon: Layers,
    title: 'Framework Category Breakdown',
    body: 'Automatically categorizes compliance scores across 5 core compliance pillars: Access Control, Data Protection, Employee Classification, Financial Approval, and Working Hours.',
  },
  {
    icon: Search,
    title: 'Interactive Drill-Down Console',
    body: 'Inspect raw log evidence, policy descriptions, AI explanations, and record resolution notes in a dark terminal details view.',
  },
  {
    icon: ShieldAlert,
    title: 'Policy Breach Prioritization',
    body: 'Ranks and aggregates policy rules most frequently broken, helping security and audit teams see what needs attention first.',
  },
  {
    icon: GitCompare,
    title: 'Role-Based Access Control Portals',
    body: 'Provides separate, URL-synced dashboards for Employees (personal compliance rating, tasks checklist) and HR Auditors (full management console).',
  },
  {
    icon: ScrollText,
    title: 'Audit-ready PDF Reporting',
    body: 'Generates polished corporate compliance reports, summary indices, and historical trend comparisons with a single click.',
    span: true,
    points: [
      'Compare audit logs side-by-side to review risk delta',
      'Trace 6-week compliance progress trend sparklines',
    ],
  },
]

export default function FeaturesSection({ onGetStarted }) {
  return (
    <section
      id="platform"
      className="relative border-b border-border/60 py-20 md:py-28"
    >
      <div className="pointer-events-none absolute top-1/3 -right-40 size-[30rem] rounded-full bg-primary/10 blur-[130px]" />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
            The platform
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
            Advanced Audit Reasoning & Analytics Portal
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">
            AI Compliance Auditor transforms raw server logs and security policy documents 
            into actionable insights, automated compliance charts, and developer-friendly mitigations.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`group relative flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-7 transition-all hover:border-primary/40 hover:bg-elevated/60 ${
                feature.span ? 'lg:col-span-2' : ''
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/25">
                <feature.icon
                  className="size-4.5 text-primary"
                  aria-hidden="true"
                />
              </span>
              <h3 className="text-lg font-medium tracking-tight">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
              {feature.points ? (
                <ul className="mt-1 flex flex-col gap-2 border-t border-border/60 pt-4">
                  {feature.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
