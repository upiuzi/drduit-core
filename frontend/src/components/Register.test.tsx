// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Register } from './Register'

const authFetch = vi.hoisted(() => vi.fn())
vi.mock('../api/client', () => ({ authFetch }))
vi.mock('../brand-context', () => ({ useBrand: () => ({ app_name: 'Dr Duit' }) }))

afterEach(() => {
  cleanup()
  authFetch.mockReset()
})

describe('Register component', () => {
  it('renders master password setup form with Dr Duit brand', () => {
    render(<Register onAuthenticated={() => {}} />)
    expect(screen.getByText('DR DUIT')).toBeTruthy()
    expect(screen.getByText('Buat Master Password')).toBeTruthy()
    expect(screen.getByLabelText('Password Baru')).toBeTruthy()
    expect(screen.getByLabelText('Konfirmasi Password')).toBeTruthy()
  })

  it('validates password mismatch before calling server', () => {
    render(<Register onAuthenticated={() => {}} />)
    fireEvent.change(screen.getByLabelText('Password Baru'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Konfirmasi Password'), { target: { value: 'password456' } })
    fireEvent.click(screen.getByRole('button', { name: /daftar & masuk/i }))

    expect(screen.getByText('Konfirmasi password tidak cocok.')).toBeTruthy()
    expect(authFetch).not.toHaveBeenCalled()
  })

  it('validates short password length', () => {
    render(<Register onAuthenticated={() => {}} />)
    fireEvent.change(screen.getByLabelText('Password Baru'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Konfirmasi Password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /daftar & masuk/i }))

    expect(screen.getByText('Password minimal 8 karakter.')).toBeTruthy()
    expect(authFetch).not.toHaveBeenCalled()
  })

  it('submits successfully and calls onAuthenticated', async () => {
    const onAuth = vi.fn()
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })

    render(<Register onAuthenticated={onAuth} />)
    fireEvent.change(screen.getByLabelText('Password Baru'), { target: { value: 'securepassword123' } })
    fireEvent.change(screen.getByLabelText('Konfirmasi Password'), { target: { value: 'securepassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /daftar & masuk/i }))

    await vi.waitFor(() => expect(onAuth).toHaveBeenCalledTimes(1))
    expect(authFetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'securepassword123' }),
      }),
    )
  })
})
