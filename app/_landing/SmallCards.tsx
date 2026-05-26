'use client'

import { useEffect, useState } from 'react'
import { useInView, prefersReducedMotion } from './useInView'

export function CronCard() {
  const { ref, inView } = useInView<HTMLDivElement>()
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) {
      setN(126)
      return
    }
    const target = 126
    const duration = 1100
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setN(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  return (
    <div
      ref={ref}
      className="flex h-full flex-col justify-between rounded-2xl border border-landing-border bg-white p-6 transition-all duration-200 hover:scale-[1.01] hover:border-zinc-300"
    >
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
          Cron Collection
        </span>
        <div className="mt-4 font-mono text-4xl font-semibold tracking-tight text-landing-primary tabular-nums">
          {n}
        </div>
        <div className="mt-1 text-xs text-landing-secondary">
          jobs collected this week
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <span
            key={i}
            className="h-3 flex-1 rounded-sm bg-landing-accent/20"
            style={{ opacity: 0.4 + (i / 8) * 0.6 }}
          />
        ))}
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-landing-subtle">
        GitHub Actions · 8×/day AEST
      </div>
    </div>
  )
}

export function DocsCard() {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-landing-border bg-white p-6 transition-all duration-200 hover:scale-[1.01] hover:border-zinc-300">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-landing-subtle">
          Google Docs auto-apply
        </span>
        <div className="mt-4 flex items-center gap-3">
          <div className="rounded-lg border border-landing-border bg-landing-bg p-2">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden>
              <path
                d="M3 1h9l5 5v16a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z"
                stroke="#2563eb"
                strokeWidth="1.4"
              />
              <path d="M12 1v5h5" stroke="#2563eb" strokeWidth="1.4" />
              <path
                d="M6 12h8M6 15h8M6 18h5"
                stroke="#2563eb"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
            <path
              d="M1 7h17m0 0l-5-5m5 5l-5 5"
              stroke="#71717a"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden>
              <path
                d="M3 1h9l5 5v16a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z"
                stroke="#16a34a"
                strokeWidth="1.4"
              />
              <path
                d="M5 14l3 3 7-7"
                stroke="#16a34a"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="mt-3 text-xs text-landing-secondary">
          [ORIGINAL] / [REVISED] pairs replaced in-place. Formatting preserved.
        </div>
      </div>
      <div className="mt-4 font-mono text-[10px] uppercase tracking-wider text-landing-subtle">
        Drive copy → Docs batchUpdate
      </div>
    </div>
  )
}

export function MobileCard() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-landing-border bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 text-white transition-all duration-200 hover:scale-[1.01]">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Mobile-first PWA
        </span>
        <p className="mt-4 text-sm text-zinc-200">
          Installable on iOS. Triage and tailor on the go — review the diff,
          open the Doc, mark applied.
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Add to Home Screen
      </div>

      {/* Decorative phone outline */}
      <svg
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-4 opacity-15"
        width="120"
        height="140"
        viewBox="0 0 120 140"
        fill="none"
      >
        <rect
          x="20"
          y="10"
          width="80"
          height="130"
          rx="12"
          stroke="white"
          strokeWidth="2"
        />
        <rect x="48" y="18" width="24" height="4" rx="2" fill="white" />
      </svg>
    </div>
  )
}
