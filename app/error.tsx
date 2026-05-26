'use client'

import Link from 'next/link'

export default function Error() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        color: '#1a2332',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Something went wrong.
        </h1>
        <p style={{ fontSize: 13, color: '#6b7785', marginBottom: 20 }}>
          Please try again in a moment.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: 10,
            background: '#1e3a5f',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go home
        </Link>
      </div>
    </main>
  )
}
