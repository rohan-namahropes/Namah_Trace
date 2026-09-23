import React, { useState } from 'react'
import { ArrowUpRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Login({ onLogin, error, setError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (supabase) {
      try {
        const res = await supabase.auth.signInWithPassword({ email, password })
        if (res.error) {
          setError(res.error.message)
        } else if (res.data.session) {
          onLogin(res.data.session)
          return
        }
      } catch (err) {
        console.warn('Supabase sign-in error:', err)
        setError(err.message || 'Supabase authentication failed')
      }
    }

    // If local or offline or fallback
    if (!supabase) {
      // Local fallback mock login
      const mockSession = {
        user: {
          id: 'user-operator',
          email,
          user_metadata: {
            full_name: email.split('@')[0] || 'Operator',
            role: email.includes('admin') ? 'admin' : 'operator',
          },
        },
      }
      onLogin(mockSession)
    }

    setBusy(false)
  }

  const handleQuickDemoLogin = (role) => {
    setError('')
    const mockSession = {
      user: {
        id: role === 'admin' ? 'usr-admin-1' : 'usr-op-1',
        email: role === 'admin' ? 'arjun.admin@namah.internal' : 'priya.operator@namah.internal',
        user_metadata: {
          full_name: role === 'admin' ? 'Arjun Sharma' : 'Priya Kapoor',
          role,
        },
      },
    }
    onLogin(mockSession)
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand-head">
          <img src="/namah-logo.webp" alt="Namah Logo" className="login-brand-img" />
          <span className="login-trace-badge">TRACE V1</span>
        </div>

        <p className="eyebrow">OPERATIONAL TRACEABILITY SYSTEM</p>
        <h1 className="login-heading">
          Welcome to
          <br />
          <em>Namah Trace.</em>
        </h1>
        <p className="login-copy">
          From incoming flat yarn to certified braided rope. Every lot, process parameter, and genealogical link accounted for.
        </p>

        {error && (
          <div className="login-error-box">
            <AlertCircle size={15} />
            <span>{error}</span>
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
              placeholder="••••••••"
              required
            />
          </label>
          <button className="primary-button full" disabled={busy}>
            {busy ? 'Verifying session...' : 'Sign in to Workspace'}{' '}
            <ArrowUpRight size={17} />
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="demo-login-divider">
          <span>OR INSTANT WORKSPACE ACCESS</span>
        </div>

        <div className="demo-login-buttons-grid">
          <button
            type="button"
            className="secondary-button demo-btn"
            onClick={() => handleQuickDemoLogin('admin')}
          >
            <ShieldCheck size={16} className="text-navy" />
            <div>
              <strong>Arjun Sharma</strong>
              <small>Production Lead (Admin)</small>
            </div>
          </button>
          <button
            type="button"
            className="secondary-button demo-btn"
            onClick={() => handleQuickDemoLogin('operator')}
          >
            <UserCheck size={16} className="text-blue" />
            <div>
              <strong>Priya Kapoor</strong>
              <small>Floor Operator (Operator)</small>
            </div>
          </button>
        </div>

        <p className="login-foot">
          <ShieldCheck size={14} /> Internal Namah Ropes Operational Network · V1 Production
        </p>
      </div>

      <div className="login-aside">
        <div className="rope-lines"></div>
        <div className="aside-quote-content">
          <p className="aside-sub">NAMAH MANUFACTURING EXCELLENCE</p>
          <strong className="aside-quote">
            "Genealogy is truth. Capture reality as it happens."
          </strong>
          <div className="aside-specs">
            <span>FLAT YARN → YARN → ROPE</span>
            <span>EN 892 · EN 1891 · UIAA</span>
          </div>
        </div>
      </div>
    </div>
  )
}
