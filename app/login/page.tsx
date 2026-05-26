'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowser()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e8eef5',
          padding: 28,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a2332', marginBottom: 8 }}>
          Sign in
        </h1>
        <p style={{ fontSize: 13, color: '#6b7785', marginBottom: 24 }}>
          Owner-only access.
        </p>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            border: '1px solid #d4d8de',
            background: 'white',
            color: '#1a2332',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        {error && (
          <p style={{ fontSize: 12, color: '#c0392b', marginTop: 12 }}>{error}</p>
        )}
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 18,
            fontSize: 12,
            color: '#4682bf',
            textDecoration: 'none',
          }}
        >
          ← Back to home
        </Link>
      </div>
    </main>
  )
}
