import React, { useState, useEffect } from 'react'
import { X, CalendarDays, DollarSign } from '../../../../ui/icons'
import { Button } from '../../../ui'
import { fBaseWhole } from '../../../../utils/format'

export interface PlannedExpenseItem {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'annual'
  monthly_amount: number
  annual_amount: number
  bucket: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
  category_id?: string | null
  category_label?: string | null
  due_date?: string | null
  notes?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: {
    id?: string
    name: string
    amount: number
    frequency: 'monthly' | 'annual'
    bucket: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
    due_date?: string | null
    notes?: string | null
  }) => Promise<void>
  initialData?: PlannedExpenseItem | null
  defaultBucket?: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
}

function parseInputAmount(val: string): number {
  let s = (val || '').trim().toLowerCase()
  let mult = 1
  if (s.includes('jt') || s.includes('juta')) {
    mult = 1_000_000
    s = s.replace(/(jt|juta)/g, '')
  } else if (s.includes('rb') || s.includes('ribu') || s.endsWith('k')) {
    mult = 1_000
    s = s.replace(/(rb|ribu|k)/g, '')
  } else if (s.endsWith('m') && !s.endsWith('am') && !s.endsWith('pm')) {
    mult = 1_000_000
    s = s.slice(0, -1)
  }
  s = s.replace(/^(rp|idr|\$)/g, '').trim()
  if (s.split('.').length > 2) {
    s = s.replace(/\./g, '')
  } else if (s.split(',').length > 2) {
    s = s.replace(/,/g, '')
  } else if (s.includes('.') && s.includes(',')) {
    if (s.indexOf('.') < s.indexOf(',')) {
      s = s.replace(/\./g, '').replace(/,/g, '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else {
    s = s.replace(/,/g, '.')
  }
  const num = parseFloat(s)
  return isNaN(num) ? 0 : Math.round(num * mult * 100) / 100
}

const BUCKET_OPTIONS: {
  key: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
  label: string
  desc: string
  target: string
  color: string
}[] = [
  {
    key: 'fixed_costs',
    label: 'Fixed Costs',
    desc: 'Rent/mortgage, utilities, food, transport, bills, debt',
    target: '50%–60%',
    color: '#3b86dd',
  },
  {
    key: 'investments',
    label: 'Investments',
    desc: 'Index funds, stocks, crypto, retirement, mutual funds',
    target: '10%+',
    color: '#10b981',
  },
  {
    key: 'savings',
    label: 'Savings Goals',
    desc: 'Emergency fund, vacation, wedding, big purchases',
    target: '5%–10%',
    color: '#f59e0b',
  },
  {
    key: 'guilt_free',
    label: 'Guilt-Free Spending',
    desc: 'Dining out, shopping, drinks, entertainment, hobbies',
    target: '20%–35%',
    color: '#8b5cf6',
  },
]

export function AddPlannedExpenseModal({ isOpen, onClose, onSave, initialData, defaultBucket }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<string>('')
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [bucket, setBucket] = useState<'fixed_costs' | 'investments' | 'savings' | 'guilt_free'>('fixed_costs')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setAmount(String(initialData.amount))
      setFrequency(initialData.frequency)
      setBucket(initialData.bucket)
      setDueDate(initialData.due_date || '')
      setNotes(initialData.notes || '')
    } else {
      setName('')
      setAmount('')
      setFrequency('monthly')
      setBucket(defaultBucket || 'fixed_costs')
      setDueDate('')
      setNotes('')
    }
    setError(null)
  }, [initialData, defaultBucket, isOpen])

  if (!isOpen) return null

  const numAmount = parseInputAmount(amount)
  const monthlyEquivalent = frequency === 'annual' ? Math.round(numAmount / 12) : numAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter an expense name.')
      return
    }
    if (numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        id: initialData?.id,
        name: name.trim(),
        amount: numAmount,
        frequency,
        bucket,
        due_date: dueDate.trim() || null,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save planned expense.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="csp-modal-overlay" role="dialog" aria-modal="true">
      <div className="csp-modal-card">
        <div className="csp-modal-header">
          <div>
            <h2 className="csp-modal-title">
              {initialData ? 'Edit Planned Expense' : 'Add Planned Expense'}
            </h2>
            <p className="csp-modal-subtitle">
              Plan your monthly bills or annual lump-sum expenses (e.g. rent, insurance, tuition).
            </p>
          </div>
          <button className="csp-modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="csp-modal-body">
            {error && <div className="csp-form-error">{error}</div>}

            {/* Expense Name */}
            <div className="csp-form-group">
              <label className="csp-form-label" htmlFor="expense-name">
                Expense Name <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <input
                id="expense-name"
                className="csp-form-input"
                type="text"
                placeholder="e.g. Rent / Kontrakan Rumah, Internet, Gym, Asuransi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Frequency Toggle */}
            <div className="csp-form-group">
              <label className="csp-form-label">Payment Frequency</label>
              <div className="csp-freq-toggle">
                <button
                  type="button"
                  className={`csp-freq-btn ${frequency === 'monthly' ? 'active' : ''}`}
                  onClick={() => setFrequency('monthly')}
                >
                  Monthly (Bulanan)
                </button>
                <button
                  type="button"
                  className={`csp-freq-btn ${frequency === 'annual' ? 'active' : ''}`}
                  onClick={() => setFrequency('annual')}
                >
                  Annual / Yearly (Tahunan)
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="csp-form-group">
              <label className="csp-form-label" htmlFor="expense-amount">
                {frequency === 'annual' ? 'Annual Amount (Nominal per Tahun)' : 'Monthly Amount (Nominal per Bulan)'}{' '}
                <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <div className="csp-input-prefix-wrap">
                <span className="csp-input-prefix">
                  <DollarSign size={14} />
                </span>
                <input
                  id="expense-amount"
                  className="csp-form-input csp-input-with-prefix"
                  type="text"
                  placeholder={frequency === 'annual' ? 'e.g. 28jt or 28000000 / year' : 'e.g. 2.5jt or 2500000'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              {/* Live Preview */}
              {numAmount > 0 && (
                <div className="csp-prorated-callout">
                  <span>💡 <strong>Calculated:</strong></span>{' '}
                  <span className="csp-prorated-value">{fBaseWhole(monthlyEquivalent)} / month</span>{' '}
                  {frequency === 'annual' && <span>({fBaseWhole(numAmount)} / year ÷ 12)</span>}
                </div>
              )}
            </div>

            {/* Bucket Choice */}
            <div className="csp-form-group">
              <label className="csp-form-label">Conscious Spending Bucket</label>
              <div className="csp-bucket-options-grid">
                {BUCKET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`csp-bucket-option-btn ${bucket === opt.key ? 'selected' : ''}`}
                    onClick={() => setBucket(opt.key)}
                  >
                    <div className="csp-bucket-option-top">
                      <span className="csp-bucket-dot" style={{ backgroundColor: opt.color }} />
                      <span className="csp-bucket-name">{opt.label}</span>
                      <span className="csp-bucket-target-badge">{opt.target}</span>
                    </div>
                    <div className="csp-bucket-desc">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Due Date */}
            <div className="csp-form-group">
              <label className="csp-form-label" htmlFor="expense-due-date">
                Optional Due Date / Next Renewal Date
              </label>
              <div className="csp-input-prefix-wrap">
                <span className="csp-input-prefix">
                  <CalendarDays size={14} />
                </span>
                <input
                  id="expense-due-date"
                  className="csp-form-input csp-input-with-prefix"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div className="csp-form-group">
              <label className="csp-form-label" htmlFor="expense-notes">
                Notes (Optional)
              </label>
              <input
                id="expense-notes"
                className="csp-form-input"
                type="text"
                placeholder="e.g. Bayar kontrakan tahunan tiap tanggal 25 Jan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="csp-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : initialData ? 'Update Expense' : 'Add to Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
