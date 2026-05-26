import type { CSSProperties, ReactNode } from 'react'
import { T } from './tokens'

const TABS = ['home', 'add', 'search', 'drafts', 'pipeline', 'profile'] as const
type TabId = (typeof TABS)[number]

const TAB_LABEL: Record<TabId, string> = {
  home: 'Home',
  add: 'Add',
  search: 'Search',
  drafts: 'Drafts',
  pipeline: 'Pipeline',
  profile: 'Profile',
}

function TabIcon({ type, active }: { type: TabId; active: boolean }) {
  const color = active ? T.primary : T.gray
  const sw = 1.6
  switch (type) {
    case 'home':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 12L12 3l9 9M5 10v10h14V10" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'add':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <path d="M12 8v8M8 12h8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'search':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={color} strokeWidth={sw} />
          <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      )
    case 'drafts':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke={color} strokeWidth={sw} />
          <path d="M8 10h8M8 14h5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      )
    case 'pipeline':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      )
    case 'profile':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke={color} strokeWidth={sw} />
          <path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      )
  }
}

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '9 / 16',
        background: T.bg,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
        fontSize: 11,
        color: T.dark,
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  )
}

export function MockHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: '14px 14px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.dark, letterSpacing: -0.3 }}>{title}</div>
        <div style={{ fontSize: 9, color: T.gray, marginTop: 1 }}>Good afternoon, Ina</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div
          style={{
            fontSize: 8,
            fontWeight: 600,
            padding: '3px 6px',
            borderRadius: 5,
            border: `1px solid ${T.border}`,
            color: T.gray,
            background: T.white,
          }}
        >
          Sign out
        </div>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${T.primary}, ${T.secondary})`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 9,
          }}
        >
          I
        </div>
      </div>
    </div>
  )
}

export function TabBar({ active }: { active: TabId }) {
  return (
    <div
      style={{
        marginTop: 'auto',
        display: 'flex',
        background: T.white,
        borderTop: `1px solid ${T.border}`,
        padding: '6px 4px 8px',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === active
        return (
          <div
            key={tab}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '2px 0',
              borderRadius: 6,
              background: isActive ? T.hoverBg : 'transparent',
            }}
          >
            <TabIcon type={tab} active={isActive} />
            <div style={{ fontSize: 7.5, fontWeight: 600, color: isActive ? T.primary : T.gray }}>{TAB_LABEL[tab]}</div>
          </div>
        )
      })}
    </div>
  )
}

export function RoleBadge({ role }: { role: 'DA' | 'DS' | 'DE' }) {
  const colorMap = { DA: T.roleDA, DS: T.roleDS, DE: T.roleDE }
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: 0.5,
        background: colorMap[role],
        color: 'white',
      }}
    >
      {role}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      style={{
        background: T.lightest,
        color: T.navy,
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score} · fit
    </span>
  )
}

export function StatusBadge({ label, variant }: { label: string; variant: 'blue' | 'green' | 'purple' | 'gold' }) {
  const map = {
    blue: { bg: T.statusBlueBg, fg: T.statusBlue },
    green: { bg: T.statusGreenBg, fg: T.statusGreen },
    purple: { bg: T.statusPurpleBg, fg: T.statusPurple },
    gold: { bg: T.statusGoldBg, fg: T.statusGold },
  }[variant]
  return (
    <span
      style={{
        background: map.bg,
        color: map.fg,
        fontSize: 8,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function ActiveDot({ label = 'Active' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: T.success, fontWeight: 500, fontSize: 9 }}>
      <span
        style={{
          width: 5,
          height: 5,
          background: T.success,
          borderRadius: '50%',
          boxShadow: '0 0 0 2px rgba(26,139,95,0.18)',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: T.white,
        borderRadius: 10,
        padding: 10,
        border: `1px solid ${T.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function ScrollBody({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '0 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}
