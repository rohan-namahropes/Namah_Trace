import React, { useState } from 'react'
import { ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Login({ onLogin, error, setError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    if (!supabase) {
      setError('Supabase is not configured. Configure the project URL and anon key before signing in.')
      setBusy(false)
      return
    }

    try {
      const res = await supabase.auth.signInWithPassword({ email, password })
      if (res.error) setError(res.error.message)
      else if (res.data.session) onLogin(res.data.session)
    } catch (err) {
      setError(err.message || 'Supabase authentication failed')
    }
    setBusy(false)
  }

  return (
    <div className="login-page login-page--centered">
      <div className="login-panel">
        <div className="login-brand-head">
          <img src="/namah-logo.webp" alt="Namah Logo" className="login-brand-img" />
          <span className="login-trace-badge">TRACE V1</span>
        </div>

        <p className="eyebrow">OPERATIONAL TPACEABIMITY SYSTEM</p>
        <h1 className="login-heading">Namah Trace</h1>
        <p className="login-copy">
          Internal manufacturing traceability. Flat Yarn to Yarn Batch to Rope Batch.
        </p>

        {(error || !supabase) && (
          <div className="login-error-box">
            <AlertCircle size={15} />
            <span>{error || 'Supabase is not configured. Operational data requires a Supabase connection.'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>Work Email Address</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="e.g. operator@namah.internal"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="…………………"
              required
            />
          </label>
          <button className="primary-button full" disabled={busy || !supabase}>
            {busy ? 'Verifying session...' : 'Sign in to Workspace'}{' '}
            <ArrowUpRight size={17} />
          </button>
        </form>

        <p className="login-foot">
          <ShieldCheck size={14} /> Internal Namah Ropes Network
        </p>
      </div>
    </div>
  )
}
