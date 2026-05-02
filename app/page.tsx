'use client'

import { useEffect, useState, useCallback } from 'react'

/* ─── types ─── */
interface Stats {
  raw: number
  new: number
  target: number
  top: number
}

interface Job {
  hash: string
  title: string
  company: string
  location: string
  url: string
  classified_role: string
  source_region: string
  source: string
  first_seen: string
  score: number | null
  queued: boolean
}

interface Application {
  id: string
  jd_hash: string
  classified_role: string
  status: string
  doc_url: string | null
  suitability_pct: number | null
  created_at: string
  job?: Job
}

/* ─── constants ─── */
const ROLE_COLORS: Record<string, string> = {
  DS: '#4682bf',
  DA: '#6c9bcd',
  DE: '#90b4da',
}

const TAB_ITEMS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'drafts', label: 'Drafts', icon: 'drafts' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
]

/* ─── helper ─── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ─── SVG Icons ─── */
function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#4682bf' : '#6b7785'
  const w = 20
  switch (type) {
    case 'home':
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <path d="M3 12L12 3l9 9M5 10v10h14V10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'search':
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.6" />
          <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'drafts':
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke={color} strokeWidth="1.6" />
          <path d="M8 10h8M8 14h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'pipeline':
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'profile':
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.6" />
          <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function Home() {
  const [stats, setStats] = useState<Stats>({ raw: 0, new: 0, target: 0, top: 0 })
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeTab, setActiveTab] = useState('home')
  const [generating, setGenerating] = useState<Record<string, 'idle' | 'loading' | 'done'>>({})
  const [loading, setLoading] = useState(true)

  /* pipeline mock (Phase 4에서 /api/applications/summary로 교체) */
  const [pipeline] = useState({ submitted: 5, pending: 3, response: 1 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, jobsRes] = await Promise.all([
        fetch('/api/queue/stats').then(r => r.json()),
        fetch('/api/queue?limit=12').then(r => r.json()),
      ])
      setStats(statsRes)
      setJobs(jobsRes.jobs ?? [])
    } catch (e) {
      console.error('Fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleGenerate(hash: string) {
    if (generating[hash] === 'loading' || generating[hash] === 'done') return
    setGenerating(prev => ({ ...prev, [hash]: 'loading' }))
    // TODO: POST /api/generate-resume (Phase 3)
    setTimeout(() => {
      setGenerating(prev => ({ ...prev, [hash]: 'done' }))
    }, 1200)
  }

  /* ─── render ─── */
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '0', minHeight: '100vh', background: '#f8fafb' }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        background: '#f8fafb',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'relative',
      }}>

        {/* ─── Scroll Area ─── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 80,
        }}>

          {/* ─── Header ─── */}
          <div style={{
            padding: '52px 20px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1a2332', letterSpacing: -0.5 }}>
                Job Dashboard
              </h1>
              <p style={{ fontSize: 13, color: '#6b7785', marginTop: 2 }}>
                {getGreeting()}, Ina ☀️
              </p>
            </div>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4682bf, #6c9bcd)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(70, 130, 191, 0.3)',
            }}>
              I
            </div>
          </div>

          {/* ─── Stats Grid ─── */}
          <div style={{ padding: '0 20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              margin: '8px 0 16px',
            }}>
              {[
                { num: stats.raw, label: 'Raw' },
                { num: stats.new, label: 'New' },
                { num: stats.target, label: 'Target' },
                { num: stats.top, label: 'Top' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: 'white',
                    borderRadius: 14,
                    padding: '14px 6px',
                    textAlign: 'center',
                    border: '1px solid #e8eef5',
                    transition: 'all 0.2s',
                    cursor: 'default',
                  }}
                >
                  <div style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#1e3a5f',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {loading ? '–' : s.num}
                  </div>
                  <div style={{
                    fontSize: 9.5,
                    color: '#6b7785',
                    marginTop: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 500,
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Action Buttons ─── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                onClick={fetchData}
                style={{
                  flex: 1,
                  background: 'white',
                  color: '#4682bf',
                  border: '1px solid #b4cde7',
                  padding: 14,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(70,130,191,0.15)',
                }}
              >
                Refresh queue
              </button>
              <button
                style={{
                  flex: 1,
                  background: '#4682bf',
                  color: 'white',
                  border: 'none',
                  padding: 14,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(70,130,191,0.3)',
                }}
              >
                ✨ Generate top 10
              </button>
            </div>
          </div>

          {/* ─── Top Picks ─── */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              fontSize: 17,
              fontWeight: 600,
              color: '#1a2332',
              margin: '8px 0 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              letterSpacing: -0.2,
            }}>
              <span>Top picks</span>
              <span style={{
                fontSize: 12,
                color: '#6b7785',
                fontWeight: 400,
                background: '#f0f5fa',
                padding: '3px 10px',
                borderRadius: 10,
              }}>
                {jobs.length} listed
              </span>
            </div>

            {loading ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                color: '#6b7785',
                fontSize: 13,
              }}>
                Loading jobs...
              </div>
            ) : jobs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 40,
                color: '#6b7785',
                fontSize: 13,
              }}>
                No jobs in queue yet.
              </div>
            ) : (
              jobs.map((job) => {
                const genState = generating[job.hash] ?? 'idle'
                const role = job.classified_role?.toUpperCase() ?? 'DA'
                const roleColor = ROLE_COLORS[role] ?? '#6c9bcd'
                const isActive = job.queued || (Date.now() - new Date(job.first_seen).getTime()) < 7 * 24 * 60 * 60 * 1000

                return (
                  <div
                    key={job.hash}
                    style={{
                      background: 'white',
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 10,
                      border: '1px solid #e8eef5',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 10,
                    }}>
                      <span style={{
                        background: '#d9e6f3',
                        color: '#1a4a7c',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: 6,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {job.score != null ? `${job.score} · fit` : 'Unscored'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 5,
                        letterSpacing: 0.5,
                        background: roleColor,
                        color: 'white',
                      }}>
                        {role}
                      </span>
                    </div>

                    {/* title + company */}
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1a2332',
                      lineHeight: 1.3,
                      marginBottom: 4,
                    }}>
                      {job.title}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#4682bf',
                      fontWeight: 500,
                      marginBottom: 6,
                    }}>
                      {job.company ?? 'Company not listed'}
                    </div>

                    {/* meta */}
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: 11.5,
                      color: '#6b7785',
                      marginBottom: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}>
                      <span>📍 {job.location ?? 'Location TBC'}</span>
                      <span style={{
                        width: 3,
                        height: 3,
                        background: '#b4cde7',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }} />
                      {isActive ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: '#1a8b5f',
                          fontWeight: 500,
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            background: '#1a8b5f',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 2px rgba(26,139,95,0.2)',
                            display: 'inline-block',
                          }} />
                          Active
                        </span>
                      ) : (
                        <span>{timeAgo(job.first_seen)}</span>
                      )}
                    </div>

                    {/* actions */}
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      borderTop: '1px solid #f0f4f8',
                      paddingTop: 10,
                    }}>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          padding: 9,
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'center',
                          background: '#f0f5fa',
                          color: '#4682bf',
                          textDecoration: 'none',
                          display: 'block',
                        }}
                      >
                        Preview JD
                      </a>
                      <button
                        onClick={() => handleGenerate(job.hash)}
                        disabled={genState !== 'idle'}
                        style={{
                          flex: 1,
                          padding: 9,
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: genState === 'idle' ? 'pointer' : 'default',
                          textAlign: 'center',
                          background: genState === 'done' ? '#1e3a5f' : '#b4cde7',
                          color: genState === 'done' ? 'white' : '#4682bf',
                          opacity: genState === 'loading' ? 0.7 : 1,
                          transition: 'background 0.18s, color 0.18s',
                        }}
                      >
                        {genState === 'loading'
                          ? 'Generating...'
                          : genState === 'done'
                          ? '✓ Resume Generated'
                          : 'Generate resume'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ─── Drafts Ready (mock until /api/applications) ─── */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              fontSize: 17,
              fontWeight: 600,
              color: '#1a2332',
              margin: '8px 0 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              letterSpacing: -0.2,
            }}>
              <span>Drafts ready</span>
              <span style={{
                fontSize: 12,
                color: '#6b7785',
                fontWeight: 400,
                background: '#f0f5fa',
                padding: '3px 10px',
                borderRadius: 10,
              }}>
                0 awaiting
              </span>
            </div>

            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e8eef5',
              borderLeft: '3px solid #6c9bcd',
              textAlign: 'center',
              color: '#6b7785',
              fontSize: 13,
            }}>
              No drafts yet. Generate a resume from Top picks above.
            </div>
          </div>

          {/* ─── Pipeline Card ─── */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #4682bf 0%, #6c9bcd 100%)',
              borderRadius: 16,
              padding: 18,
              color: 'white',
              boxShadow: '0 4px 16px rgba(70,130,191,0.2)',
            }}>
              <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 500 }}>
                Application pipeline
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                {[
                  { num: pipeline.submitted, label: 'Submitted' },
                  { num: pipeline.pending, label: 'Pending' },
                  { num: pipeline.response, label: 'Response' },
                ].map((p) => (
                  <div key={p.label}>
                    <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
                      {p.num}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                      {p.label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14,
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                paddingTop: 12,
                cursor: 'pointer',
              }}>
                <span>View full pipeline</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tab Bar ─── */}
        <div style={{
          display: 'flex',
          background: 'white',
          borderTop: '1px solid #e8eef5',
          padding: '10px 12px 28px',
          justifyContent: 'space-around',
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          zIndex: 100,
        }}>
          {TAB_ITEMS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  color: isActive ? '#4682bf' : '#6b7785',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <div style={{
                  width: 36,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: isActive ? '#f0f5fa' : 'transparent',
                }}>
                  <TabIcon type={tab.icon} active={isActive} />
                </div>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
