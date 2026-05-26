'use client'

import { useInView } from './useInView'

const COLUMNS = [
  {
    title: 'Draft',
    accent: 'bg-zinc-400',
    cards: [
      { co: 'Globex', role: 'Data Engineer', score: 72 },
      { co: 'Initech', role: 'Analytics Lead', score: 81 },
    ],
  },
  {
    title: 'Submitted',
    accent: 'bg-landing-accent',
    cards: [
      { co: 'Hooli', role: 'ML Engineer', score: 84 },
      { co: 'Soylent', role: 'Data Analyst', score: 76 },
    ],
  },
  {
    title: 'Interview',
    accent: 'bg-emerald-500',
    cards: [{ co: 'Pied Piper', role: 'Senior DS', score: 89 }],
  },
]

export function PipelineCard() {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className="group flex h-full flex-col rounded-2xl border border-landing-border bg-white p-6 transition-all duration-200 hover:scale-[1.01] hover:border-zinc-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
          Application Pipeline
        </span>
        <span className="font-mono text-[10px] text-landing-subtle">
          Supabase ↔ Sheets
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {COLUMNS.map((col, ci) => (
          <div key={col.title} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${col.accent}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-landing-secondary">
                {col.title}
              </span>
            </div>
            {col.cards.map((c, i) => (
              <div
                key={`${col.title}-${i}`}
                className={`rounded-lg border border-landing-border bg-landing-bg p-2 transition-all duration-500 ${
                  inView ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
                style={{ transitionDelay: `${ci * 120 + i * 80}ms` }}
              >
                <div className="truncate text-[11px] font-semibold text-landing-primary">
                  {c.co}
                </div>
                <div className="truncate text-[10px] text-landing-subtle">
                  {c.role}
                </div>
                <div className="mt-1 font-mono text-[10px] text-landing-accent">
                  {c.score}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-wider text-landing-subtle">
        Status sync · fire-and-forget
      </div>
    </div>
  )
}
