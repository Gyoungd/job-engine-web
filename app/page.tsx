'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState, useCallback } from 'react'

/* ─── types ─── */
interface Stats {
  raw: number
  new: number
  target: number
  top: number
}

/** Embedded row from `/api/queue?include_application=true` */
type QueueApplication = {
  id: string
  status: string
  doc_url: string | null
  submitted_at: string | null
  created_at: string
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
  application?: QueueApplication | null
}

interface ApplicationJob {
  title: string
  company: string
  location: string
  url: string
  classified_role: string
  score: number | null
}

interface Application {
  id: string
  jd_hash: string
  folder_path: string
  classified_role: string
  status: string
  doc_url: string | null
  doc_id: string | null
  suitability_pct: number | null
  resume_changes: string | null
  notes: string | null
  response_status: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  seen_jobs: ApplicationJob
}

interface PipelineSummary {
  submitted: number
  pending: number
  response: number
}

type TabId = 'home' | 'search' | 'drafts' | 'pipeline' | 'profile'
type GenState = 'idle' | 'loading' | 'done' | 'error'

/* ─── constants ─── */
const ROLE_COLORS: Record<string, string> = {
  DS: '#4682bf',
  DA: '#6c9bcd',
  DE: '#90b4da',
}

const ACTIVE_DRAFT_STATUSES = ['draft', 'docs_copied'] as const
const APPLIED_STATUSES = ['submitted', 'sent_cold', 'online_test', 'interview', 'offer'] as const

type AppliedStatus = (typeof APPLIED_STATUSES)[number]
type ActiveDraftStatus = (typeof ACTIVE_DRAFT_STATUSES)[number]

function getCardState(application: QueueApplication | null | undefined): 'idle' | ActiveDraftStatus | AppliedStatus {
  if (!application) return 'idle'
  if ((ACTIVE_DRAFT_STATUSES as readonly string[]).includes(application.status)) {
    return application.status as ActiveDraftStatus
  }
  if ((APPLIED_STATUSES as readonly string[]).includes(application.status)) {
    return application.status as AppliedStatus
  }
  return 'idle'
}

function getQueueApplicationForHash(hash: string, homeJobs: Job[], searchJobList: Job[]): QueueApplication | null {
  for (const j of homeJobs) {
    if (j.hash === hash && j.application) return j.application
  }
  for (const j of searchJobList) {
    if (j.hash === hash && j.application) return j.application
  }
  return null
}

const STATUS_OPTIONS = ['draft', 'docs_copied', 'submitted', 'sent_cold', 'online_test', 'interview', 'offer', 'rejected', 'withdrawn']

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',       color: '#6b7785', bg: '#f0f5fa' },
  docs_copied: { label: 'Docs Ready',  color: '#b8860b', bg: '#fef9e7' },
  submitted:   { label: 'Submitted',   color: '#4682bf', bg: '#e8f0fe' },
  sent_cold:   { label: 'Sent Cold 📧', color: '#7b68ee', bg: '#ede7f6' },
  online_test: { label: 'Online Test', color: '#e67e22', bg: '#fef5e7' },
  interview:   { label: 'Interview',   color: '#1a8b5f', bg: '#e6f7ef' },
  offer:       { label: 'Offer',       color: '#1a8b5f', bg: '#d4edda' },
  rejected:    { label: 'Rejected',    color: '#c0392b', bg: '#fde8e8' },
  withdrawn:   { label: 'Withdrawn',   color: '#6b7785', bg: '#f0f0f0' },
}

const TAB_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'drafts', label: 'Drafts', icon: 'drafts' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
]

/* ─── helpers ─── */
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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
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

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.draft
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 6,
      background: s.bg,
      color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const r = role?.toUpperCase() ?? 'DA'
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 5,
      letterSpacing: 0.5,
      background: ROLE_COLORS[r] ?? '#6c9bcd',
      color: 'white',
    }}>
      {r}
    </span>
  )
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  /* ─── Home state ─── */
  const [stats, setStats] = useState<Stats>({ raw: 0, new: 0, target: 0, top: 0 })
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<Record<string, GenState>>({})
  const [ranking, setRanking] = useState(false)
  const [rankResult, setRankResult] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<PipelineSummary>({ submitted: 0, pending: 0, response: 0 })
  const [homeDrafts, setHomeDrafts] = useState<Application[]>([])
  const [rankedTotalCount, setRankedTotalCount] = useState(0)
  const [pipelineScrollTarget, setPipelineScrollTarget] = useState<string | null>(null)
  const [searchScoreGte, setSearchScoreGte] = useState<number | null>(null)
  const [searchExcludeStatus, setSearchExcludeStatus] = useState('')

  /* ─── Drafts state ─── */
  const [drafts, setDrafts] = useState<Application[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [draftsFilter, setDraftsFilter] = useState<string>('all')
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null)
  const [copyingDoc, setCopyingDoc] = useState<Record<string, boolean>>({})
  const [markingApplied, setMarkingApplied] = useState<Record<string, boolean>>({})

  /* ─── Search state ─── */
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRole, setSearchRole] = useState('all')
  const [searchRegion, setSearchRegion] = useState('all')
  const [searchSource, setSearchSource] = useState('all')
  const [searchSort, setSearchSort] = useState('newest')
  const [searchJobs, setSearchJobs] = useState<Job[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchOffset, setSearchOffset] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)

  /* ─── Profile state ─── */
  const [collectionSummary, setCollectionSummary] = useState<{
    today: { runs: number; new_jds: number; last_new_jd_at: string | null }
    week: { runs: number; new_jds: number }
  } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  /* ─── Expire state (optimistic hide before server confirms) ─── */
  const [expiredHashes, setExpiredHashes] = useState<Set<string>>(new Set())

  /* ─── Withdraw draft state ─── */
  const [withdrawingDraft, setWithdrawingDraft] = useState<Record<string, boolean>>({})

  /* ─── Pipeline state ─── */
  const [pipelineApps, setPipelineApps] = useState<Application[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [pipelineSort, setPipelineSort] = useState<'newest' | 'oldest' | 'score'>('newest')
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState<string>('all')
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [savingField, setSavingField] = useState<Record<string, boolean>>({})

  /* ─── Home tab data fetch ─── */
  const fetchHomeData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, jobsRes, summaryRes, draftsRes] = await Promise.all([
        fetch('/api/queue/stats').then(r => r.json()),
        fetch(
          '/api/queue?filter=ranked&limit=5&include_application=true&exclude_status=rejected,withdrawn&max_age_days=14',
        ).then(r => r.json()),
        fetch('/api/applications/summary').then(r => r.json()),
        fetch('/api/applications?status=draft,docs_copied&limit=3').then(r => r.json()),
      ])
      setStats(statsRes)
      setJobs(jobsRes.jobs ?? [])
      setPipeline(summaryRes)
      setHomeDrafts(draftsRes.applications ?? [])
      setRankedTotalCount(jobsRes.total ?? (jobsRes.jobs?.length ?? 0))
    } catch (e) {
      console.error('Fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHomeData()
  }, [fetchHomeData])

  /* ─── Generate top 10 (Haiku ranking) ─── */
  async function handleRankTop10() {
    if (ranking) return
    setRanking(true)
    setRankResult(null)
    try {
      const res = await fetch('/api/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'top10', limit: 10 }),
      })
      const data = await res.json()
      if (res.ok) {
        setRankResult(`Scored ${data.scored_count} jobs`)
        await fetchHomeData()
      } else {
        setRankResult(data.error ?? 'Scoring failed')
      }
    } catch {
      setRankResult('Network error')
    } finally {
      setRanking(false)
    }
  }

  /* ─── Generate resume (Sonnet) ─── */
  async function handleGenerate(hash: string) {
    const existingDraft = getQueueApplicationForHash(hash, jobs, searchJobs)
    if (existingDraft || generating[hash] === 'loading' || generating[hash] === 'done') return
    setGenerating(prev => ({ ...prev, [hash]: 'loading' }))
    try {
      const res = await fetch('/api/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_hash: hash }),
      })
      const data = await res.json()
      if (res.ok) {
        setGenerating(prev => ({ ...prev, [hash]: 'done' }))
        fetchHomeData()
      } else if (res.status === 409) {
        setGenerating(prev => ({ ...prev, [hash]: 'done' }))
      } else {
        setGenerating(prev => ({ ...prev, [hash]: 'error' }))
        console.error('Generate failed:', data.error)
      }
    } catch {
      setGenerating(prev => ({ ...prev, [hash]: 'error' }))
    }
  }

  /* ─── Mark job as expired ─── */
  async function handleExpire(hash: string) {
    setExpiredHashes(prev => new Set([...prev, hash]))
    try {
      const res = await fetch(`/api/jobs/${hash}/expire`, { method: 'PATCH' })
      if (!res.ok) {
        setExpiredHashes(prev => { const n = new Set(prev); n.delete(hash); return n })
      }
    } catch {
      setExpiredHashes(prev => { const n = new Set(prev); n.delete(hash); return n })
    }
  }

  /* ─── Withdraw draft without going through Pipeline ─── */
  async function handleWithdrawDraft(id: string) {
    if (withdrawingDraft[id]) return
    setWithdrawingDraft(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      })
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id))
        setHomeDrafts(prev => prev.filter(d => d.id !== id))
      }
    } catch {
      // silently fail — draft stays visible
    } finally {
      setWithdrawingDraft(prev => ({ ...prev, [id]: false }))
    }
  }

  /* ─── Drafts tab data fetch ─── */
  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const statusParam = draftsFilter === 'all' ? 'draft,docs_copied,submitted' : draftsFilter
      const res = await fetch(`/api/applications?status=${statusParam}&limit=50`)
      const data = await res.json()
      setDrafts(data.applications ?? [])
    } catch (e) {
      console.error('Drafts fetch failed:', e)
    } finally {
      setDraftsLoading(false)
    }
  }, [draftsFilter])

  useEffect(() => {
    if (activeTab === 'drafts') fetchDrafts()
  }, [activeTab, fetchDrafts])

  /* ─── Generate Docs ─── */
  async function handleCopyDocs(appId: string) {
    if (copyingDoc[appId]) return
    setCopyingDoc(prev => ({ ...prev, [appId]: true }))
    try {
      const res = await fetch('/api/docs/copy-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: appId }),
      })
      const data = await res.json()
      console.log('[Generate Docs] API response:', data)

      if (data.error) {
        console.error('[Generate Docs] API error:', data.error)
        alert(`문서 생성 실패: ${data.error}`)
        return
      }

      if (data.doc_url) {
        if (data.db_error) {
          console.warn('[Generate Docs] DB update issue:', data.db_error, data.db_state)
        }
        setDrafts(prev => prev.map(d =>
          d.id === appId
            ? { ...d, status: 'docs_copied', doc_url: data.doc_url, doc_id: data.doc_id }
            : d
        ))
        setHomeDrafts(prev => prev.map(d =>
          d.id === appId
            ? { ...d, status: 'docs_copied', doc_url: data.doc_url, doc_id: data.doc_id }
            : d
        ))
        void fetchHomeData()
        if (activeTab === 'search') void fetchSearch(true)
        window.open(data.doc_url, '_blank')
      }
    } catch (e) {
      console.error('Copy docs failed:', e)
    } finally {
      setCopyingDoc(prev => ({ ...prev, [appId]: false }))
    }
  }

  /* ─── Mark Applied ─── */
  async function handleMarkApplied(appId: string) {
    if (markingApplied[appId]) return
    setMarkingApplied(prev => ({ ...prev, [appId]: true }))
    try {
      const res = await fetch('/api/applications/mark-applied', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: appId }),
      })
      if (res.ok) {
        setDrafts(prev => prev.map(d =>
          d.id === appId ? { ...d, status: 'submitted' } : d
        ))
        setHomeDrafts(prev => prev.filter(d => d.id !== appId))
        fetch('/api/sheets/sync', { method: 'POST' }).catch(() => {})
        fetchHomeData()
      }
    } catch (e) {
      console.error('Mark applied failed:', e)
    } finally {
      setMarkingApplied(prev => ({ ...prev, [appId]: false }))
    }
  }

  /* ─── Search tab data fetch ─── */
  const fetchSearch = useCallback(async (resetOffset = true) => {
    setSearchLoading(true)
    const off = resetOffset ? 0 : searchOffset
    if (resetOffset) setSearchOffset(0)
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: String(off),
        include_application: 'true',
      })
      if (searchQuery) params.set('q', searchQuery)
      if (searchRole !== 'all') params.set('role', searchRole)
      if (searchRegion !== 'all') params.set('region', searchRegion)
      if (searchSource !== 'all') params.set('source', searchSource)
      if (searchSort !== 'newest') params.set('sort', searchSort)
      if (searchScoreGte != null) params.set('score_gte', String(searchScoreGte))
      if (searchExcludeStatus) params.set('exclude_status', searchExcludeStatus)
      const res = await fetch(`/api/queue?${params}`)
      const data = await res.json()
      if (resetOffset) {
        setSearchJobs(data.jobs ?? [])
      } else {
        setSearchJobs(prev => [...prev, ...(data.jobs ?? [])])
      }
      setSearchTotal(data.total ?? 0)
    } catch (e) {
      console.error('Search fetch failed:', e)
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, searchRole, searchRegion, searchSource, searchSort, searchOffset, searchScoreGte, searchExcludeStatus])

  useEffect(() => {
    if (activeTab === 'search') fetchSearch(true)
  }, [activeTab, searchRole, searchRegion, searchSource, searchSort, searchScoreGte, searchExcludeStatus, fetchSearch])

  /* ─── Profile tab data fetch ─── */
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/collection-runs/summary')
      const data = await res.json()
      if (!data.error) setCollectionSummary(data)
    } catch (e) {
      console.error('Profile fetch failed:', e)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'profile') fetchProfile()
  }, [activeTab, fetchProfile])

  /* ─── Pipeline tab data fetch ─── */
  const fetchPipeline = useCallback(async () => {
    setPipelineLoading(true)
    try {
      const statusParam = pipelineStatusFilter === 'all' ? '' : `&status=${pipelineStatusFilter}`
      const res = await fetch(`/api/applications?limit=100${statusParam}`)
      const data = await res.json()
      let apps: Application[] = data.applications ?? []

      if (pipelineSort === 'oldest') {
        apps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      } else if (pipelineSort === 'score') {
        apps.sort((a, b) => (b.suitability_pct ?? 0) - (a.suitability_pct ?? 0))
      }

      setPipelineApps(apps)
    } catch (e) {
      console.error('Pipeline fetch failed:', e)
    } finally {
      setPipelineLoading(false)
    }
  }, [pipelineSort, pipelineStatusFilter])

  useEffect(() => {
    if (activeTab === 'pipeline') fetchPipeline()
  }, [activeTab, fetchPipeline])

  useEffect(() => {
    if (activeTab !== 'pipeline' || !pipelineScrollTarget) return
    const el = document.getElementById(`pipeline-row-${pipelineScrollTarget}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.transition = 'background-color 0.3s'
    el.style.backgroundColor = '#fff8d8'
    const timer = setTimeout(() => {
      el.style.backgroundColor = ''
      setPipelineScrollTarget(null)
    }, 2000)
    return () => clearTimeout(timer)
  }, [activeTab, pipelineScrollTarget, pipelineApps])

  /* ─── Pipeline: update status ─── */
  async function handleStatusChange(appId: string, newStatus: string) {
    setSavingField(prev => ({ ...prev, [appId]: true }))
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const responseStatus = ['sent_cold', 'online_test', 'interview', 'offer', 'rejected'].includes(newStatus) ? newStatus : undefined
        setPipelineApps(prev => prev.map(a => a.id === appId
          ? { ...a, status: newStatus, ...(responseStatus ? { response_status: responseStatus } : {}) }
          : a
        ))
        fetch('/api/sheets/sync', { method: 'POST' }).catch(() => {})
        fetchHomeData()
      }
    } catch (e) {
      console.error('Status update failed:', e)
    } finally {
      setSavingField(prev => ({ ...prev, [appId]: false }))
    }
  }

  /* ─── Pipeline: save notes ─── */
  async function handleNoteSave(appId: string) {
    const notes = editingNotes[appId]
    if (notes === undefined) return
    setSavingField(prev => ({ ...prev, [`note-${appId}`]: true }))
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setPipelineApps(prev => prev.map(a => a.id === appId ? { ...a, notes } : a))
        setEditingNotes(prev => {
          const next = { ...prev }
          delete next[appId]
          return next
        })
        fetch('/api/sheets/sync', { method: 'POST' }).catch(() => {})
      }
    } catch (e) {
      console.error('Note save failed:', e)
    } finally {
      setSavingField(prev => ({ ...prev, [`note-${appId}`]: false }))
    }
  }

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
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
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

          {/* ─── Header ─── */}
          <div style={{
            padding: 'calc(env(safe-area-inset-top, 20px) + 12px) 20px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1a2332', letterSpacing: -0.5 }}>
                {activeTab === 'home' ? 'Job Dashboard' :
                 activeTab === 'drafts' ? 'Resume Drafts' :
                 activeTab === 'pipeline' ? 'Pipeline' :
                 activeTab === 'search' ? 'Search Jobs' :
                 'Profile'}
              </h1>
              <p style={{ fontSize: 13, color: '#6b7785', marginTop: 2 }}>
                {getGreeting()}, Ina
              </p>
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4682bf, #6c9bcd)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 14,
              boxShadow: '0 2px 8px rgba(70, 130, 191, 0.3)',
            }}>
              I
            </div>
          </div>

          {/* ═══ HOME TAB ═══ */}
          {activeTab === 'home' && (
            <>
              {/* Stats Grid */}
              <div style={{ padding: '0 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '8px 0 16px' }}>
                  {[
                    { num: stats.raw, label: 'Raw', title: 'Collected (7d)' },
                    { num: stats.new, label: 'New', title: 'Posted (24h)' },
                    { num: stats.target, label: 'Target', title: 'Target role + queued' },
                    { num: stats.top, label: 'Top', title: 'Score ≥80' },
                  ].map((s) => (
                    <div key={s.label} title={s.title} style={{
                      background: 'white', borderRadius: 14, padding: '14px 6px',
                      textAlign: 'center', border: '1px solid #e8eef5', cursor: 'help',
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e3a5f', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {loading ? '–' : s.num}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#6b7785', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                  <button
                    onClick={fetchHomeData}
                    style={{
                      flex: 1, background: 'white', color: '#4682bf',
                      border: '1px solid #b4cde7', padding: 14, borderRadius: 12,
                      fontSize: 14, fontWeight: 500, cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(70,130,191,0.15)',
                    }}
                  >
                    Refresh queue
                  </button>
                  <button
                    onClick={handleRankTop10}
                    disabled={ranking}
                    style={{
                      flex: 1, background: ranking ? '#6c9bcd' : '#4682bf', color: 'white',
                      border: 'none', padding: 14, borderRadius: 12,
                      fontSize: 14, fontWeight: 600, cursor: ranking ? 'default' : 'pointer',
                      boxShadow: '0 2px 8px rgba(70,130,191,0.3)',
                      opacity: ranking ? 0.8 : 1,
                    }}
                  >
                    {ranking ? 'Scoring...' : '✨ Generate top 10'}
                  </button>
                </div>
                {rankResult && (
                  <div style={{
                    fontSize: 12, color: '#4682bf', textAlign: 'center',
                    marginTop: -16, marginBottom: 16, fontWeight: 500,
                  }}>
                    {rankResult}
                  </div>
                )}
              </div>

              {/* New Jobs */}
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{
                  fontSize: 17, fontWeight: 600, color: '#1a2332', margin: '8px 0 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: -0.2,
                }}>
                  <span>New Jobs</span>
                  <span style={{ fontSize: 12, color: '#6b7785', fontWeight: 400, background: '#f0f5fa', padding: '3px 10px', borderRadius: 10 }}>
                    {jobs.length} listed
                  </span>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>Loading jobs...</div>
                ) : jobs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>No jobs in queue yet.</div>
                ) : (
                  <>
                  {jobs.filter(j => !expiredHashes.has(j.hash)).map((job) => {
                    const application = job.application ?? null
                    const cardState = getCardState(application)
                    const isApplied = !!(application && (APPLIED_STATUSES as readonly string[]).includes(application.status))
                    const isDraftLike = !!(application && (ACTIVE_DRAFT_STATUSES as readonly string[]).includes(application.status))
                    const role = job.classified_role?.toUpperCase() ?? 'DA'
                    const roleColor = ROLE_COLORS[role] ?? '#6c9bcd'
                    const isActive = job.queued || (Date.now() - new Date(job.first_seen).getTime()) < 7 * 24 * 60 * 60 * 1000
                    const genState = isDraftLike ? 'done' as GenState : (generating[job.hash] ?? 'idle')

                    const cardStyle: CSSProperties = {
                      background: isDraftLike ? '#f8fbff' : 'white',
                      borderRadius: 16,
                      padding: isApplied ? '14px 14px 14px 11px' : 14,
                      marginBottom: 10,
                      border: `1px solid ${isDraftLike ? '#b4cde7' : '#e8eef5'}`,
                      ...(isApplied ? { borderLeft: '3px solid #1a8b5f' } : {}),
                      opacity: isApplied ? 0.92 : 1,
                    }

                    const statusBadge = (() => {
                      if (cardState === 'idle') return null
                      const config = isApplied
                        ? { bg: '#e6f7ef', color: '#1a8b5f', text: `✓ Applied · ${timeAgo(application!.submitted_at ?? application!.created_at)}` }
                        : cardState === 'docs_copied'
                          ? { bg: '#e8f0fe', color: '#4682bf', text: '✓ Docs ready' }
                          : { bg: '#e8f0fe', color: '#4682bf', text: '✓ Draft ready' }
                      return (
                        <span style={{
                          background: config.bg, color: config.color, fontSize: 10, fontWeight: 600,
                          padding: '3px 8px', borderRadius: 6,
                        }}>{config.text}</span>
                      )
                    })()

                    const rightButton = (() => {
                      if (cardState === 'idle') {
                        return (
                          <button
                            type="button"
                            onClick={() => handleGenerate(job.hash)}
                            disabled={genState !== 'idle'}
                            style={{
                              flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: 'none', textAlign: 'center', cursor: genState === 'idle' ? 'pointer' : 'default',
                              background: genState === 'idle' ? '#b4cde7'
                                : genState === 'error' ? '#c0392b'
                                : '#1e3a5f',
                              color: genState === 'idle' ? '#4682bf' : 'white',
                              opacity: genState === 'loading' ? 0.7 : 1,
                            }}
                          >
                            {genState === 'idle' ? 'Generate resume'
                              : genState === 'loading' ? 'Generating...'
                              : genState === 'error' ? '✗ Failed'
                              : '✓ Resume Generated'}
                          </button>
                        )
                      }
                      if (cardState === 'docs_copied' && application?.doc_url) {
                        return (
                          <a href={application.doc_url} target="_blank" rel="noopener noreferrer" style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            textAlign: 'center', background: '#1e3a5f', color: 'white',
                            textDecoration: 'none', display: 'block',
                          }}>Open doc →</a>
                        )
                      }
                      if (isDraftLike) {
                        return (
                          <button
                            type="button"
                            onClick={() => setActiveTab('drafts')}
                            style={{
                              flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: 'none', cursor: 'pointer', textAlign: 'center',
                              background: '#1e3a5f', color: 'white',
                            }}
                          >View draft →</button>
                        )
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setPipelineScrollTarget(application!.id)
                            setActiveTab('pipeline')
                          }}
                          style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: 'none', cursor: 'pointer', textAlign: 'center',
                            background: '#1a8b5f', color: 'white',
                          }}
                        >View in pipeline →</button>
                      )
                    })()

                    return (
                      <div key={job.hash} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#d9e6f3', color: '#1a4a7c', fontSize: 11,
                              fontWeight: 600, padding: '4px 9px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
                            }}>
                              {job.score != null ? `${job.score} · fit` : 'Unscored'}
                            </span>
                            {statusBadge}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                            letterSpacing: 0.5, background: roleColor, color: 'white',
                          }}>
                            {role}
                          </span>
                        </div>

                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', lineHeight: 1.3, marginBottom: 4 }}>
                          {job.title}
                        </div>
                        <div style={{ fontSize: 13, color: '#4682bf', fontWeight: 500, marginBottom: 6 }}>
                          {job.company ?? 'Company not listed'}
                        </div>

                        <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: '#6b7785', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>{job.location ?? 'Location TBC'}</span>
                          <span style={{ width: 3, height: 3, background: '#b4cde7', borderRadius: '50%', display: 'inline-block' }} />
                          {isActive && !isApplied ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1a8b5f', fontWeight: 500 }}>
                              <span style={{ width: 6, height: 6, background: '#1a8b5f', borderRadius: '50%', boxShadow: '0 0 0 2px rgba(26,139,95,0.2)', display: 'inline-block' }} />
                              Active
                            </span>
                          ) : (
                            <span>{timeAgo(job.first_seen)}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
                          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: 'none', cursor: 'pointer', textAlign: 'center',
                            background: '#f0f5fa', color: '#4682bf', textDecoration: 'none', display: 'block',
                          }}>
                            Preview JD
                          </a>
                          {cardState === 'idle' && (
                            <button
                              type="button"
                              onClick={() => handleExpire(job.hash)}
                              style={{
                                padding: '9px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                border: '1px solid #d4d8de', cursor: 'pointer', textAlign: 'center',
                                background: '#f0f2f4', color: '#6b7785', whiteSpace: 'nowrap', flexShrink: 0,
                              }}
                            >
                              Expired
                            </button>
                          )}
                          {rightButton}
                        </div>
                      </div>
                    )
                  })}
                  {rankedTotalCount > 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchScoreGte(80)
                        setSearchExcludeStatus('rejected,withdrawn')
                        setSearchSort('score')
                        setActiveTab('search')
                      }}
                      style={{
                        width: '100%', textAlign: 'center', padding: 8,
                        fontSize: 12, color: '#4682bf', fontWeight: 500,
                        background: '#f0f5fa', borderRadius: 8, border: 'none',
                        cursor: 'pointer', marginTop: 4,
                      }}
                    >
                      Show all {rankedTotalCount} in Search →
                    </button>
                  )}
                  </>
                )}
              </div>

              {/* Drafts Ready (live from API) */}
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{
                  fontSize: 17, fontWeight: 600, color: '#1a2332', margin: '8px 0 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: -0.2,
                }}>
                  <span>Drafts ready</span>
                  <span style={{ fontSize: 12, color: '#6b7785', fontWeight: 400, background: '#f0f5fa', padding: '3px 10px', borderRadius: 10 }}>
                    {homeDrafts.length} awaiting
                  </span>
                </div>

                {homeDrafts.length === 0 ? (
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 24,
                    border: '1px solid #e8eef5', borderLeft: '3px solid #6c9bcd',
                    textAlign: 'center', color: '#6b7785', fontSize: 13,
                  }}>
                    No drafts yet. Generate a resume from New Jobs above.
                  </div>
                ) : (
                  homeDrafts.map(draft => (
                    <div key={draft.id} style={{
                      background: 'white', borderRadius: 16, padding: 14,
                      marginBottom: 10, border: '1px solid #e8eef5',
                      borderLeft: `3px solid ${draft.status === 'docs_copied' ? '#b8860b' : '#6c9bcd'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2332' }}>
                          {draft.seen_jobs?.company ?? 'Unknown'}
                        </div>
                        <StatusBadge status={draft.status} />
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7785', marginBottom: 8 }}>
                        {draft.seen_jobs?.title ?? draft.folder_path} · {timeAgo(draft.created_at)}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setActiveTab('drafts')}
                          style={{
                            flex: 1, padding: 8, borderRadius: 8, fontSize: 11, fontWeight: 600,
                            border: 'none', cursor: 'pointer', background: '#f0f5fa', color: '#4682bf',
                          }}
                        >
                          View details
                        </button>
                        {(draft.status === 'draft' || draft.status === 'docs_copied') && (
                          <button
                            onClick={() => handleWithdrawDraft(draft.id)}
                            disabled={!!withdrawingDraft[draft.id]}
                            style={{
                              padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              border: '1px solid #d4d8de', cursor: withdrawingDraft[draft.id] ? 'default' : 'pointer',
                              background: '#f0f2f4', color: '#6b7785', whiteSpace: 'nowrap', flexShrink: 0,
                              opacity: withdrawingDraft[draft.id] ? 0.6 : 1,
                            }}
                          >
                            {withdrawingDraft[draft.id] ? '...' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pipeline Card (live from API) */}
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #4682bf 0%, #6c9bcd 100%)',
                  borderRadius: 16, padding: 18, color: 'white',
                  boxShadow: '0 4px 16px rgba(70,130,191,0.2)',
                }}>
                  <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 500 }}>Application pipeline</div>
                  <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                    {[
                      { num: pipeline.submitted, label: 'Submitted' },
                      { num: pipeline.pending, label: 'Pending' },
                      { num: pipeline.response, label: 'Response' },
                    ].map((p) => (
                      <div key={p.label}>
                        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{p.num}</div>
                        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{p.label}</div>
                      </div>
                    ))}
                  </div>
                  <div
                    onClick={() => setActiveTab('pipeline')}
                    style={{
                      marginTop: 14, fontSize: 13, fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12, cursor: 'pointer',
                    }}
                  >
                    <span>View full pipeline</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══ DRAFTS TAB ═══ */}
          {activeTab === 'drafts' && (
            <div style={{ padding: '0 20px 20px' }}>
              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
                {['all', 'draft', 'docs_copied', 'submitted'].map(f => (
                  <button
                    key={f}
                    onClick={() => setDraftsFilter(f)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: 'none', cursor: 'pointer',
                      background: draftsFilter === f ? '#4682bf' : 'white',
                      color: draftsFilter === f ? 'white' : '#4682bf',
                      boxShadow: draftsFilter === f ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                  >
                    {f === 'all' ? 'All' : (STATUS_LABELS[f]?.label ?? f)}
                  </button>
                ))}
              </div>

              {draftsLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>Loading drafts...</div>
              ) : drafts.length === 0 ? (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 32,
                  border: '1px solid #e8eef5', textAlign: 'center', color: '#6b7785', fontSize: 13,
                }}>
                  No drafts found. Generate resumes from the Home tab.
                </div>
              ) : (
                drafts.map(draft => {
                  const isExpanded = expandedDraft === draft.id
                  const job = draft.seen_jobs
                  return (
                    <div key={draft.id} style={{
                      background: 'white', borderRadius: 16, padding: 16,
                      marginBottom: 12, border: '1px solid #e8eef5',
                      borderLeft: `3px solid ${STATUS_LABELS[draft.status]?.color ?? '#6c9bcd'}`,
                    }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', lineHeight: 1.3, marginBottom: 4 }}>
                            {job?.title ?? 'Untitled'}
                          </div>
                          <div style={{ fontSize: 13, color: '#4682bf', fontWeight: 500 }}>
                            {job?.company ?? 'Unknown company'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <RoleBadge role={draft.classified_role} />
                          <StatusBadge status={draft.status} />
                        </div>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#6b7785', marginBottom: 12, flexWrap: 'wrap' }}>
                        {draft.suitability_pct && (
                          <span style={{ fontWeight: 600, color: draft.suitability_pct >= 80 ? '#1a8b5f' : '#b8860b' }}>
                            {draft.suitability_pct}% fit
                          </span>
                        )}
                        <span>{timeAgo(draft.created_at)}</span>
                        {draft.status === 'draft' && <span style={{ color: '#1a8b5f' }}>✓ Ready</span>}
                        {draft.status === 'docs_copied' && <span style={{ color: '#b8860b' }}>⏳ Awaiting submission</span>}
                      </div>

                      {/* Resume changes preview */}
                      {draft.resume_changes && (
                        <div
                          onClick={() => setExpandedDraft(isExpanded ? null : draft.id)}
                          style={{
                            background: '#f8fafb', borderRadius: 10, padding: 12,
                            marginBottom: 12, cursor: 'pointer', border: '1px solid #e8eef5',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 8 : 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#4682bf', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Resume Changes
                            </span>
                            <span style={{ fontSize: 11, color: '#6b7785' }}>
                              {isExpanded ? '▲ Collapse' : '▼ Expand'}
                            </span>
                          </div>
                          {isExpanded ? (
                            <pre style={{
                              fontSize: 11.5, color: '#1a2332', lineHeight: 1.5,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              maxHeight: 400, overflowY: 'auto', margin: 0,
                              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            }}>
                              {draft.resume_changes}
                            </pre>
                          ) : (
                            <div style={{ fontSize: 12, color: '#6b7785', lineHeight: 1.4, marginTop: 4 }}>
                              {truncate(draft.resume_changes, 120)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {job?.url && (
                          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: 'none', textAlign: 'center', background: '#f0f5fa', color: '#4682bf',
                            textDecoration: 'none', display: 'block',
                          }}>
                            View JD
                          </a>
                        )}

                        {draft.status === 'draft' && !draft.doc_url && (
                          <button
                            onClick={() => handleCopyDocs(draft.id)}
                            disabled={!!copyingDoc[draft.id]}
                            style={{
                              flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: 'none', cursor: copyingDoc[draft.id] ? 'default' : 'pointer',
                              background: '#b4cde7', color: '#4682bf',
                              opacity: copyingDoc[draft.id] ? 0.7 : 1,
                            }}
                          >
                            {copyingDoc[draft.id] ? 'Generating...' : 'Generate Docs'}
                          </button>
                        )}

                        {draft.doc_url && (
                          <a href={draft.doc_url} target="_blank" rel="noopener noreferrer" style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: 'none', textAlign: 'center',
                            background: draft.status === 'submitted' ? '#f0f5fa' : '#1e3a5f',
                            color: draft.status === 'submitted' ? '#4682bf' : 'white',
                            textDecoration: 'none', display: 'block',
                          }}>
                            Open Resume
                          </a>
                        )}

                        {(draft.status === 'draft' || draft.status === 'docs_copied') && (
                          <button
                            onClick={() => handleMarkApplied(draft.id)}
                            disabled={!!markingApplied[draft.id]}
                            style={{
                              flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: 'none', cursor: markingApplied[draft.id] ? 'default' : 'pointer',
                              background: '#1e3a5f', color: 'white',
                              opacity: markingApplied[draft.id] ? 0.7 : 1,
                            }}
                          >
                            {markingApplied[draft.id] ? 'Submitting...' : 'Mark Applied'}
                          </button>
                        )}
                        {(draft.status === 'draft' || draft.status === 'docs_copied') && (
                          <button
                            onClick={() => handleWithdrawDraft(draft.id)}
                            disabled={!!withdrawingDraft[draft.id]}
                            style={{
                              padding: '9px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              border: '1px solid #d4d8de', cursor: withdrawingDraft[draft.id] ? 'default' : 'pointer',
                              background: '#f0f2f4', color: '#6b7785', whiteSpace: 'nowrap', flexShrink: 0,
                              opacity: withdrawingDraft[draft.id] ? 0.6 : 1,
                            }}
                          >
                            {withdrawingDraft[draft.id] ? '...' : 'Withdraw'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ═══ PIPELINE TAB ═══ */}
          {activeTab === 'pipeline' && (
            <div style={{ padding: '0 0 20px' }}>
              {/* Sticky header: stats + filters */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                background: '#f8fafb', padding: '0 20px 4px',
              }}>
              {/* Summary row */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0 16px',
              }}>
                {[
                  { num: pipeline.submitted, label: 'Submitted', color: '#4682bf' },
                  { num: pipeline.pending, label: 'Pending', color: '#b8860b' },
                  { num: pipeline.response, label: 'Responses', color: '#1a8b5f' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'white', borderRadius: 12, padding: '12px 8px',
                    textAlign: 'center', border: '1px solid #e8eef5',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.num}</div>
                    <div style={{ fontSize: 10, color: '#6b7785', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Filters & sort */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                  value={pipelineStatusFilter}
                  onChange={e => setPipelineStatusFilter(e.target.value)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: '1px solid #e8eef5', background: 'white', color: '#1a2332',
                    cursor: 'pointer', flex: 1,
                  }}
                >
                  <option value="all">All status</option>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>
                  ))}
                </select>
                <select
                  value={pipelineSort}
                  onChange={e => setPipelineSort(e.target.value as 'newest' | 'oldest' | 'score')}
                  style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: '1px solid #e8eef5', background: 'white', color: '#1a2332',
                    cursor: 'pointer', flex: 1,
                  }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="score">Score desc</option>
                </select>
                <button
                  onClick={fetchPipeline}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer', background: '#4682bf', color: 'white',
                  }}
                >
                  Refresh
                </button>
              </div>
              </div>{/* end sticky header */}

              <div style={{ padding: '0 20px' }}>
              {pipelineLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>Loading pipeline...</div>
              ) : pipelineApps.length === 0 ? (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 32,
                  border: '1px solid #e8eef5', textAlign: 'center', color: '#6b7785', fontSize: 13,
                }}>
                  No applications yet.
                </div>
              ) : (
                /* Pipeline table — mobile card view */
                pipelineApps.map(app => {
                  const job = app.seen_jobs
                  const isEditingNote = editingNotes[app.id] !== undefined
                  return (
                    <div
                      id={`pipeline-row-${app.id}`}
                      key={app.id}
                      style={{
                        background: 'white', borderRadius: 14, padding: 14,
                        marginBottom: 10, border: '1px solid #e8eef5',
                      }}
                    >
                      {/* Row 1: Company + Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2332', flex: 1 }}>
                          {job?.company ?? 'Unknown'}
                        </div>
                        <select
                          value={app.status}
                          onChange={e => handleStatusChange(app.id, e.target.value)}
                          disabled={!!savingField[app.id]}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                            border: 'none', cursor: 'pointer',
                            background: STATUS_LABELS[app.status]?.bg ?? '#f0f5fa',
                            color: STATUS_LABELS[app.status]?.color ?? '#6b7785',
                            opacity: savingField[app.id] ? 0.6 : 1,
                          }}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2: Title + Role */}
                      <div style={{ fontSize: 13, color: '#4682bf', fontWeight: 500, marginBottom: 6 }}>
                        {job?.title ?? app.folder_path}
                      </div>

                      {/* Row 3: Meta chips */}
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6b7785', marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <RoleBadge role={app.classified_role} />
                        {app.suitability_pct && (
                          <span style={{ fontWeight: 600, color: app.suitability_pct >= 80 ? '#1a8b5f' : '#b8860b' }}>
                            {app.suitability_pct}%
                          </span>
                        )}
                        <span>{app.submitted_at ? app.submitted_at.slice(0, 10) : app.created_at.slice(0, 10)}</span>
                        {app.response_status && (
                          <span style={{
                            fontWeight: 600,
                            color: STATUS_LABELS[app.response_status]?.color ?? '#6b7785',
                          }}>
                            {STATUS_LABELS[app.response_status]?.label ?? app.response_status}
                          </span>
                        )}
                      </div>

                      {/* Notes inline edit */}
                      <div style={{ borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
                        {isEditingNote ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={editingNotes[app.id] ?? ''}
                              onChange={e => setEditingNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleNoteSave(app.id) }}
                              placeholder="Add notes..."
                              style={{
                                flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 12,
                                border: '1px solid #b4cde7', outline: 'none', color: '#1a2332',
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleNoteSave(app.id)}
                              disabled={!!savingField[`note-${app.id}`]}
                              style={{
                                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                border: 'none', cursor: 'pointer', background: '#4682bf', color: 'white',
                              }}
                            >
                              {savingField[`note-${app.id}`] ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingNotes(prev => {
                                const next = { ...prev }
                                delete next[app.id]
                                return next
                              })}
                              style={{
                                padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                                border: '1px solid #e8eef5', cursor: 'pointer', background: 'white', color: '#6b7785',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div
                              onClick={() => setEditingNotes(prev => ({ ...prev, [app.id]: app.notes ?? '' }))}
                              style={{
                                fontSize: 12, color: app.notes ? '#1a2332' : '#b4cde7', cursor: 'pointer',
                                fontStyle: app.notes ? 'normal' : 'italic', flex: 1,
                              }}
                            >
                              {app.notes || 'Click to add notes...'}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                              {job?.url && (
                                <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                                  fontSize: 11, color: '#4682bf', fontWeight: 500, textDecoration: 'none',
                                }}>
                                  JD
                                </a>
                              )}
                              {app.doc_url && (
                                <a href={app.doc_url} target="_blank" rel="noopener noreferrer" style={{
                                  fontSize: 11, color: '#4682bf', fontWeight: 500, textDecoration: 'none',
                                }}>
                                  Doc
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              </div>{/* end content area */}
            </div>
          )}

          {/* ═══ SEARCH TAB ═══ */}
          {activeTab === 'search' && (
            <div style={{ padding: '0 0 20px' }}>
              {/* Sticky header: search + filters + sort */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                background: '#f8fafb', padding: '0 20px 4px',
              }}>
              {/* Search input */}
              <div style={{ margin: '12px 0 12px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchSearch(true) }}
                    placeholder="Search by title or company..."
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13,
                      border: '1px solid #e8eef5', outline: 'none', color: '#1a2332',
                      background: 'white',
                    }}
                  />
                  <button
                    onClick={() => fetchSearch(true)}
                    style={{
                      padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: 'none', cursor: 'pointer', background: '#4682bf', color: 'white',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <select value={searchRole} onChange={e => setSearchRole(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #e8eef5', background: 'white', color: '#1a2332', cursor: 'pointer', minWidth: 80 }}>
                  <option value="all">All Roles</option>
                  <option value="DA">DA</option>
                  <option value="DS">DS</option>
                  <option value="DE">DE</option>
                </select>
                <select value={searchRegion} onChange={e => setSearchRegion(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #e8eef5', background: 'white', color: '#1a2332', cursor: 'pointer', minWidth: 80 }}>
                  <option value="all">All Regions</option>
                  <option value="melbourne">Melbourne</option>
                  <option value="korea">Korea</option>
                  <option value="singapore">Singapore</option>
                  <option value="malaysia">Malaysia</option>
                </select>
                <select value={searchSource} onChange={e => setSearchSource(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #e8eef5', background: 'white', color: '#1a2332', cursor: 'pointer', minWidth: 80 }}>
                  <option value="all">All Sources</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="seek">Seek</option>
                  <option value="adzuna">Adzuna</option>
                </select>
              </div>

              {/* Sort + results count */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#6b7785' }}>
                  {searchTotal} results
                </span>
                <select value={searchSort} onChange={e => setSearchSort(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid #e8eef5', background: 'white', color: '#1a2332', cursor: 'pointer' }}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="score">Score ↓</option>
                </select>
              </div>
              </div>{/* end sticky header */}

              <div style={{ padding: '0 20px' }}>
              {/* Results */}
              {searchLoading && searchJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>Searching...</div>
              ) : searchJobs.length === 0 ? (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 32,
                  border: '1px solid #e8eef5', textAlign: 'center', color: '#6b7785', fontSize: 13,
                }}>
                  No jobs found. Try different filters.
                </div>
              ) : (
                <>
                  {searchJobs.filter(j => !expiredHashes.has(j.hash)).map(job => {
                    const application = job.application ?? null
                    const cardState = getCardState(application)
                    const isApplied = !!(application && (APPLIED_STATUSES as readonly string[]).includes(application.status))
                    const isDraftLike = !!(application && (ACTIVE_DRAFT_STATUSES as readonly string[]).includes(application.status))
                    const genState = isDraftLike ? 'done' as GenState : (generating[job.hash] ?? 'idle')
                    const role = job.classified_role?.toUpperCase() ?? 'DA'

                    return (
                      <div key={job.hash} style={{
                        background: isDraftLike || isApplied ? '#f8fbff' : 'white', borderRadius: 16, padding: 14,
                        marginBottom: 10, border: `1px solid ${isDraftLike || isApplied ? '#b4cde7' : '#e8eef5'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {job.score != null && (
                              <span style={{ background: '#d9e6f3', color: '#1a4a7c', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>
                                {job.score} fit
                              </span>
                            )}
                            {cardState !== 'idle' && (
                              <span style={{
                                background: isApplied ? '#e6f7ef' : '#e8f0fe',
                                color: isApplied ? '#1a8b5f' : '#4682bf',
                                fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                              }}>
                                {isApplied ? `✓ Applied · ${timeAgo(application!.submitted_at ?? application!.created_at)}`
                                  : cardState === 'docs_copied' ? '✓ Docs ready'
                                  : '✓ Draft ready'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <RoleBadge role={role} />
                            {job.source_region && job.source_region !== 'unknown' && (
                              <span style={{ fontSize: 10, color: '#6b7785', background: '#f0f5fa', padding: '3px 6px', borderRadius: 4 }}>
                                {job.source_region}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2332', lineHeight: 1.3, marginBottom: 4 }}>
                          {job.title}
                        </div>
                        <div style={{ fontSize: 13, color: '#4682bf', fontWeight: 500, marginBottom: 4 }}>
                          {job.company ?? 'Company not listed'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#6b7785', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>{job.location ?? 'Location TBC'}</span>
                          <span style={{ width: 3, height: 3, background: '#b4cde7', borderRadius: '50%', display: 'inline-block' }} />
                          <span>{timeAgo(job.first_seen)}</span>
                          {job.source && (
                            <>
                              <span style={{ width: 3, height: 3, background: '#b4cde7', borderRadius: '50%', display: 'inline-block' }} />
                              <span style={{ textTransform: 'capitalize' }}>{job.source}</span>
                            </>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f0f4f8', paddingTop: 10 }}>
                          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: 'none', textAlign: 'center', background: '#f0f5fa', color: '#4682bf',
                            textDecoration: 'none', display: 'block',
                          }}>
                            Preview JD
                          </a>
                          {cardState === 'idle' && (
                            <button
                              type="button"
                              onClick={() => handleExpire(job.hash)}
                              style={{
                                padding: '9px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                border: '1px solid #d4d8de', cursor: 'pointer', textAlign: 'center',
                                background: '#f0f2f4', color: '#6b7785', whiteSpace: 'nowrap', flexShrink: 0,
                              }}
                            >
                              Expired
                            </button>
                          )}
                          {cardState === 'idle' ? (
                            <button
                              type="button"
                              onClick={() => handleGenerate(job.hash)}
                              disabled={genState !== 'idle'}
                              style={{
                                flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: 'none', textAlign: 'center',
                                cursor: genState === 'idle' ? 'pointer' : 'default',
                                background: genState === 'done' ? '#1e3a5f' : genState === 'error' ? '#c0392b' : '#b4cde7',
                                color: genState === 'done' || genState === 'error' ? 'white' : '#4682bf',
                                opacity: genState === 'loading' ? 0.7 : 1,
                              }}
                            >
                              {genState === 'loading' ? 'Generating...'
                                : genState === 'done' ? '✓ Resume Generated'
                                : genState === 'error' ? '✗ Failed'
                                : 'Generate resume'}
                            </button>
                          ) : cardState === 'docs_copied' && application?.doc_url ? (
                            <a href={application.doc_url} target="_blank" rel="noopener noreferrer" style={{
                              flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                              textAlign: 'center', background: '#1e3a5f', color: 'white',
                              textDecoration: 'none', display: 'block',
                            }}>Open doc →</a>
                          ) : isDraftLike ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('drafts')}
                              style={{
                                flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: 'none', cursor: 'pointer', textAlign: 'center',
                                background: '#1e3a5f', color: 'white',
                              }}
                            >
                              View draft →
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPipelineScrollTarget(application!.id)
                                setActiveTab('pipeline')
                              }}
                              style={{
                                flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: 'none', cursor: 'pointer', textAlign: 'center',
                                background: '#1a8b5f', color: 'white',
                              }}
                            >
                              View in pipeline →
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Load more */}
                  {searchJobs.length < searchTotal && (
                    <button
                      onClick={() => {
                        setSearchOffset(searchJobs.length)
                        setTimeout(() => fetchSearch(false), 0)
                      }}
                      disabled={searchLoading}
                      style={{
                        width: '100%', padding: 14, borderRadius: 12, fontSize: 13, fontWeight: 600,
                        border: '1px solid #e8eef5', cursor: 'pointer', background: 'white', color: '#4682bf',
                        marginTop: 4,
                      }}
                    >
                      {searchLoading ? 'Loading...' : `Load more (${searchJobs.length} of ${searchTotal})`}
                    </button>
                  )}
                </>
              )}
              </div>{/* end content area */}
            </div>
          )}

          {/* ═══ PROFILE TAB ═══ */}
          {activeTab === 'profile' && (
            <div style={{ padding: '0 20px 20px' }}>
              {/* User info card */}
              <div style={{
                background: 'white', borderRadius: 16, padding: 20, marginTop: 16,
                border: '1px solid #e8eef5',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4682bf, #6c9bcd)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 18,
                  }}>
                    I
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2332' }}>Gayoung Dan (Ina)</div>
                    <div style={{ fontSize: 12, color: '#6b7785' }}>Fortuna mihi favet ✨</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['DA', 'DS', 'DE'].map(r => (
                    <span key={r} style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                      background: ROLE_COLORS[r] ?? '#6c9bcd', color: 'white',
                    }}>{r}</span>
                  ))}
                  {['Melbourne', 'Seoul', 'Singapore', 'Malaysia'].map(r => (
                    <span key={r} style={{
                      fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                      background: '#f0f5fa', color: '#4682bf',
                    }}>{r}</span>
                  ))}
                </div>
              </div>

              {/* Collection monitoring cards */}
              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#6b7785', fontSize: 13 }}>Loading collection data...</div>
              ) : collectionSummary ? (
                <>
                  {/* Today's collection */}
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 18, marginTop: 12,
                    border: '1px solid #e8eef5', borderLeft: '3px solid #4682bf',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7785', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Today (24h)
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>
                          {collectionSummary.today.runs}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7785', marginTop: 4 }}>runs</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#4682bf', lineHeight: 1 }}>
                          {collectionSummary.today.new_jds}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7785', marginTop: 4 }}>new JDs</div>
                      </div>
                    </div>
                  </div>

                  {/* Last new JD */}
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 18, marginTop: 10,
                    border: '1px solid #e8eef5', borderLeft: '3px solid #1a8b5f',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7785', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Last new JD
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a2332' }}>
                      {collectionSummary.today.last_new_jd_at
                        ? timeAgo(collectionSummary.today.last_new_jd_at)
                        : 'No JDs collected yet'}
                    </div>
                  </div>

                  {/* This week */}
                  <div style={{
                    background: 'white', borderRadius: 16, padding: 18, marginTop: 10,
                    border: '1px solid #e8eef5', borderLeft: '3px solid #b8860b',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7785', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      This week (7d)
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e3a5f', lineHeight: 1 }}>
                          {collectionSummary.week.runs}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7785', marginTop: 4 }}>runs</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#b8860b', lineHeight: 1 }}>
                          {collectionSummary.week.new_jds}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7785', marginTop: 4 }}>new JDs</div>
                      </div>
                    </div>
                  </div>

                  {/* Collection status info */}
                  <div style={{
                    background: '#f8fafb', borderRadius: 12, padding: 14, marginTop: 10,
                    fontSize: 12, color: '#6b7785', lineHeight: 1.6,
                  }}>
                    {collectionSummary.today.runs === 0
                      ? 'No collection runs in the last 24 hours. Cloud cron will be active after GitHub Actions setup (Phase 5 Tasks 1-4).'
                      : `Collection active: ${collectionSummary.today.runs} runs today with ${collectionSummary.today.new_jds} new discoveries.`}
                  </div>
                </>
              ) : (
                <div style={{
                  background: 'white', borderRadius: 16, padding: 24, marginTop: 12,
                  border: '1px solid #e8eef5', textAlign: 'center', color: '#6b7785', fontSize: 13,
                }}>
                  Collection monitoring will activate after cron setup.
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={fetchProfile}
                style={{
                  width: '100%', padding: 14, borderRadius: 12, fontSize: 13, fontWeight: 600,
                  border: '1px solid #e8eef5', cursor: 'pointer', background: 'white', color: '#4682bf',
                  marginTop: 12,
                }}
              >
                Refresh collection data
              </button>
            </div>
          )}
        </div>

        {/* ─── Tab Bar ─── */}
        <div style={{
          display: 'flex', background: 'white', borderTop: '1px solid #e8eef5',
          padding: '10px 12px calc(env(safe-area-inset-bottom, 20px) + 8px)',
          justifyContent: 'space-around',
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, zIndex: 100,
        }}>
          {TAB_ITEMS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, fontSize: 10, color: isActive ? '#4682bf' : '#6b7785',
                  cursor: 'pointer', padding: '4px 8px', borderRadius: 10,
                  border: 'none', background: 'transparent', fontWeight: isActive ? 600 : 400,
                }}
              >
                <div style={{
                  width: 36, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, background: isActive ? '#f0f5fa' : 'transparent',
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
