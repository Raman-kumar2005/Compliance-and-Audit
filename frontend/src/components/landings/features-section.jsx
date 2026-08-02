import {
  Bot,
  GitCompareArrows,
  Layers,
  Radar,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'

const features = [
  {
    icon: Radar,
    title: 'Continuous control monitoring',
    body: 'Auditra re-tests every mapped control on a schedule and flags drift the moment configuration, access, or policy changes.',
    span: true,
    points: [
      'Read-only connections to cloud, identity, and ticketing systems',
      'Deterministic checks paired with AI reasoning on unstructured evidence',
    ],
  },
  {
    icon: Bot,
    title: 'AI evidence review',
    body: 'Policies, DPAs, and reports are parsed, summarized, and matched to the requirement they actually satisfy — with citations.',
  },
  {
    icon: GitCompareArrows,
    title: 'Cross-framework mapping',
    body: 'Answer a control once and Auditra applies it across SOC 2, ISO 27001, HIPAA, and the EU AI Act automatically.',
  },
  {
    icon: ShieldAlert,
    title: 'Gap severity scoring',
    body: 'Every finding is ranked by audit impact and blast radius, so remediation follows real risk instead of ticket order.',
  },
  {
    icon: Layers,
    title: 'AI system inventory',
    body: 'Models, prompts, and data flows are catalogued and risk-classified for emerging AI governance obligations.',
  },
  {
    icon: ScrollText,
    title: 'Audit-ready reporting',
    body: 'Export a defensible evidence package with control narratives, timestamps, and a complete review trail.',
    span: true,
    points: [
      'Immutable history of every check, override, and approval',
      'Auditor-friendly exports in PDF, CSV, and structured JSON',
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
            The solution
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
            One audit engine for every framework you carry
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">
            Auditra replaces the annual scramble with an always-on audit that
            reasons over your real systems and documents — and shows its work.
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
