import { CalendarX, FileWarning, Users, TrendingDown } from 'lucide-react'

const problems = [
  {
    icon: FileWarning,
    title: 'Evidence lives everywhere',
    body: 'Screenshots in Drive, tickets in Jira, exports in email. Auditors ask for one artifact and three teams go hunting for a week.',
  },
  {
    icon: CalendarX,
    title: 'Point-in-time audits go stale',
    body: 'A control that passed in March drifts in April. Annual sampling tells you nothing about the other eleven months.',
  },
  {
    icon: Users,
    title: 'Manual review does not scale',
    body: 'Every new framework, region, and AI model multiplies the same spreadsheet work across an already stretched GRC team.',
  },
  {
    icon: TrendingDown,
    title: 'Findings arrive too late',
    body: 'Gaps surface in the auditor’s draft report, when remediation is most expensive and deal timelines are already at risk.',
  },
]

export default function ProblemSection({ onGetStarted }) {
  return (
    <section
      id="problem"
      className="relative border-b border-border/60 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
            The problem
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
            Compliance work grew faster than the teams doing it
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">
            Most organizations still audit the way they did a decade ago —
            manually, once a year, against a fraction of the evidence that
            actually exists.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/50 sm:grid-cols-2">
          {problems.map((problem) => (
            <article
              key={problem.title}
              className="group flex flex-col gap-4 bg-card/70 p-7 transition-colors hover:bg-elevated/70"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-background/60 ring-1 ring-border/80">
                <problem.icon
                  className="size-4.5 text-primary"
                  aria-hidden="true"
                />
              </span>
              <h3 className="text-lg font-medium tracking-tight">
                {problem.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {problem.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-6 rounded-2xl border border-border/70 bg-card/40 px-7 py-6 sm:grid-cols-3">
          {[
            { stat: '11 weeks', label: 'Average manual audit cycle' },
            { stat: '60%+', label: 'GRC time spent collecting evidence' },
            { stat: '1 in 3', label: 'Enterprise deals blocked on security review' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-2xl font-semibold tracking-tight text-primary">
                {item.stat}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
