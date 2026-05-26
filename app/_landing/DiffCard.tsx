'use client'

import { useInView } from './useInView'

export function DiffCard() {
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className="group flex h-full flex-col rounded-2xl border border-landing-border bg-white p-6 transition-all duration-200 hover:scale-[1.01] hover:border-zinc-300"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
          Resume Tailoring
        </span>
        <span className="font-mono text-[10px] text-landing-subtle">
          batchUpdate ↗
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-landing-border bg-zinc-950 font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="ml-2 text-[10px] text-zinc-500">resume.diff</span>
        </div>

        <div className="space-y-1 p-4 leading-relaxed">
          <div
            className={`flex gap-3 transition-all duration-500 ${
              inView ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <span className="select-none text-red-400/70">-</span>
            <span className="text-red-300/90">
              Built data pipeline using Python
            </span>
          </div>
          <div
            className={`flex gap-3 transition-all duration-500 ${
              inView ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
            }`}
            style={{ transitionDelay: '600ms' }}
          >
            <span className="select-none text-emerald-400/80">+</span>
            <span className="text-emerald-300/90">
              Built ETL pipeline ingesting events
              <br />
              <span className="pl-3">
                via Python + Airflow on AWS, surfaced
              </span>
              <br />
              <span className="pl-3">in Tableau for stakeholder review</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'pairs', value: '6' },
          { label: 'sections', value: '3' },
          { label: 'suit %', value: '78' },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-landing-border bg-landing-bg px-2 py-2"
          >
            <div className="font-mono text-base font-semibold text-landing-primary">
              {m.value}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-landing-subtle">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-wider text-landing-subtle">
        Claude Sonnet 4.6 · ~45s end-to-end
      </div>
    </div>
  )
}
