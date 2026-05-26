'use client'

import { useEffect, useState } from 'react'
import { useInView, prefersReducedMotion } from './useInView'

export function ScoreCard() {
  const { ref, inView } = useInView<HTMLDivElement>()
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) {
      setScore(87)
      return
    }
    const target = 87
    const duration = 1200
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setScore(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  return (
    <div
      ref={ref}
      className="group flex h-full flex-col rounded-2xl border border-landing-border bg-white p-6 transition-all duration-200 hover:scale-[1.01] hover:border-zinc-300"
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
          AI Fit Ranking
        </span>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
          DA
        </span>
      </div>

      {/* Fake job card mockup */}
      <div className="mt-5 rounded-xl border border-landing-border bg-landing-bg p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-landing-accent/10 px-2 py-1 font-mono text-xs font-semibold text-landing-accent">
            {score} · fit
          </span>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            Tier A
          </span>
        </div>
        <div className="mt-3 text-sm font-semibold text-landing-primary">
          Data Analyst
        </div>
        <div className="text-xs text-landing-secondary">Acme Corp</div>
        <div className="mt-1 text-[11px] text-landing-subtle">
          Melbourne · 2h ago
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {[
          'Python + SQL match',
          'Tableau dashboard experience',
          'Stakeholder reporting',
        ].map((line, i) => (
          <li
            key={line}
            className={`flex items-center gap-2 text-xs text-landing-secondary transition-all duration-300 ${
              inView ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
            }`}
            style={{ transitionDelay: `${600 + i * 150}ms` }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2 6l3 3 5-6"
                stroke="#16a34a"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-landing-subtle">
          Claude Haiku 4.5 · ranked in 1.4s
        </div>
      </div>
    </div>
  )
}
