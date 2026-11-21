import { useState } from 'react'
import { authFetch } from '../api/client'
import { tooManyAttemptsMessage } from '../api/rateLimit'
import { useBrand } from '../brand-context'
import { PasswordField } from './ui'

const MIN_LENGTH = 8

export interface RegisterProps {
  onAuthenticated: () => void
  onGoToLogin?: () => void
}

export function Register({ onAuthenticated, onGoToLogin }: RegisterProps) {
  const brand = useBrand()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (!password.trim()) {
      setError('Password tidak boleh kosong.')
      return
    }
    if (password.length < MIN_LENGTH) {
      setError(`Password minimal ${MIN_LENGTH} karakter.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setSubmitting(true)
    try {
      const res = await authFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 409) {
        setError('Instansi ini sudah terdaftar. Silakan login.')
        setSubmitting(false)
        return
      }
      if (res.status === 429) {
        setError(tooManyAttemptsMessage(res))
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.detail || `Registrasi gagal (HTTP ${res.status})`)
        setSubmitting(false)
        return
      }
      setPassword('')
      setConfirmPassword('')
      onAuthenticated()
    } catch {
      setError('Gagal menghubungi server. Pastikan server aktif dan coba lagi.')
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">{brand.app_name.toUpperCase()}</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '4px 0 0 0', color: 'var(--ink)' }}>
          Buat Master Password
        </h2>
        <p className="login-sub">
          Daftarkan master password untuk mengamankan dan mengakses instansi catatan finansial Anda.
        </p>

        <label className="form-label" htmlFor="register-password">
          Password Baru
        </label>
        <PasswordField
          id="register-password"
          name="password"
          value={password}
          autoFocus
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          onChange={(e) => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
        />

        <label className="form-label" htmlFor="register-confirm" style={{ marginTop: '4px' }}>
          Konfirmasi Password
        </label>
        <PasswordField
          id="register-confirm"
          name="confirm_password"
          value={confirmPassword}
          autoComplete="new-password"
          placeholder="Ulangi password"
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (error) setError(null)
          }}
        />

        {error && <div className="login-error">{error}</div>}

        <button
          className="btn-primary login-submit"
          type="submit"
          disabled={submitting || !password || !confirmPassword}
          style={{ marginTop: '8px' }}
        >
          {submitting ? 'Mendaftarkan…' : 'Daftar & Masuk'}
        </button>

        {onGoToLogin && (
          <p className="login-help" style={{ marginTop: '12px', textAlign: 'center' }}>
            Sudah mengatur password?{' '}
            <button
              type="button"
              className="text-btn"
              onClick={onGoToLogin}
              style={{
                color: 'var(--accent)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Masuk di sini
            </button>
          </p>
        )}
      </form>
    </div>
  )
}
