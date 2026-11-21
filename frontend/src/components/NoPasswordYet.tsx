import { useState } from 'react'
import { authFetch } from '../api/client'
import { tooManyAttemptsMessage } from '../api/rateLimit'
import { useBrand } from '../brand-context'
import { PasswordField } from './ui'

// A server with no password yet answers "not required, not signed in" to every other device.
// We provide both: an immediate in-browser setup form to register the master password,
// and the check button if configured out-of-band via CLI / on the host machine.

interface Status {
  required: boolean
  authenticated: boolean
}

type Outcome = 'idle' | 'checking' | 'still-none' | 'unreachable'

export function NoPasswordYet({ onRetry }: { onRetry: () => Promise<Status | null> }) {
  const brand = useBrand()
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  async function retry() {
    setOutcome('checking')
    const status = await onRetry()
    if (!status) setOutcome('unreachable')
    else setOutcome(!status.required && !status.authenticated ? 'still-none' : 'idle')
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (registering) return
    setRegisterError(null)

    if (!newPassword.trim()) {
      setRegisterError('Password tidak boleh kosong.')
      return
    }
    if (newPassword.length < 8) {
      setRegisterError('Password minimal 8 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setRegisterError('Konfirmasi password tidak cocok.')
      return
    }

    setRegistering(true)
    try {
      const res = await authFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (res.status === 409) {
        setRegisterError('Instansi ini sudah terdaftar. Silakan login.')
        setRegistering(false)
        await onRetry()
        return
      }
      if (res.status === 429) {
        setRegisterError(tooManyAttemptsMessage(res))
        setRegistering(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setRegisterError(data?.detail || `Registrasi gagal (HTTP ${res.status})`)
        setRegistering(false)
        return
      }
      setNewPassword('')
      setConfirmPassword('')
      await onRetry()
    } catch {
      setRegisterError('Gagal menghubungi server. Pastikan server aktif dan coba lagi.')
      setRegistering(false)
    }
  }

  return (
    <div className="login-screen" role="alert">
      <div className="login-card">
        <div className="login-brand">{brand.app_name.toUpperCase()}</div>
        <h1 className="no-password-title">Set a password first</h1>
        <p className="login-sub">
          This server doesn&rsquo;t have a password yet, so by default it only opens on the computer it runs on.
          Daftarkan master password di bawah ini untuk mengamankan dan mengakses instansi catatan finansial {brand.app_name} Anda.
        </p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label className="form-label" htmlFor="setup-new-password">
            Master Password Baru
          </label>
          <PasswordField
            id="setup-new-password"
            name="new_password"
            value={newPassword}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (registerError) setRegisterError(null)
            }}
          />

          <label className="form-label" htmlFor="setup-confirm-password">
            Konfirmasi Password
          </label>
          <PasswordField
            id="setup-confirm-password"
            name="confirm_password"
            value={confirmPassword}
            placeholder="Ulangi password"
            autoComplete="new-password"
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (registerError) setRegisterError(null)
            }}
          />

          {registerError && <p className="login-error" role="status">{registerError}</p>}

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={registering || !newPassword || !confirmPassword}
            style={{ marginTop: '4px' }}
          >
            {registering ? 'Menyimpan…' : 'Daftar / Buat Password'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
          <p className="login-sub" style={{ fontSize: '12px', marginBottom: '8px' }}>
            Sudah mengatur password melalui terminal/server?
          </p>
          <button
            type="button"
            className="btn-secondary login-submit"
            disabled={outcome === 'checking'}
            onClick={() => void retry()}
          >
            I&rsquo;ve set it, sign in
          </button>
        </div>

        {outcome === 'still-none' && (
          <p className="login-error" role="status">
            Still no password on that server. Set one there first, then try again.
          </p>
        )}
        {outcome === 'unreachable' && (
          <p className="login-error" role="status">
            Could not reach the server. Try again.
          </p>
        )}
      </div>
    </div>
  )
}
