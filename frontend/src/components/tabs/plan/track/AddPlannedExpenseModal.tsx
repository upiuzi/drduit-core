import React, { useState, useEffect, type KeyboardEvent } from 'react'
import { Modal } from '../../../ui/Modal'
import { Button } from '../../../ui/Button'
import { FormField } from '../../../ui/FormField'
import { TextField } from '../../../ui/TextField'
import { Select } from '../../../ui/Select'
import { SegmentedControl } from '../../../ui/SegmentedControl'
import { Stack } from '../../../ui/Stack'
import { Text } from '../../../ui/Text'
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

export function parseInputAmount(val: string): number {
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

const BUCKET_OPTIONS = [
  { value: 'fixed_costs', label: 'Fixed Costs (Rent, bills, groceries — 50–60%)' },
  { value: 'investments', label: 'Investments (Stocks, crypto, retirement — 10%+)' },
  { value: 'savings', label: 'Savings Goals (Emergency fund, big goals — 5–10%)' },
  { value: 'guilt_free', label: 'Guilt-Free Spending (Dining, hobbies, fun — 20–35%)' },
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

  const handleSubmit = async () => {
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing) {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'button') {
        e.preventDefault()
        void handleSubmit()
      }
    }
  }

  const amountHelp =
    numAmount > 0
      ? frequency === 'annual'
        ? `💡 Terhitung: ${fBaseWhole(monthlyEquivalent)} / bulan (${fBaseWhole(numAmount)} ÷ 12)`
        : `💡 Terhitung: ${fBaseWhole(numAmount)} / bulan`
      : 'Your best estimate is fine. Format fleksibel (28jt, 500k, 28.000.000)'

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title={initialData ? 'Edit planned expense' : 'Add planned expense'}
      subtitle="Conscious Spending Plan · Rencana Pengeluaran"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginRight: 'auto' }}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={submitting || !name.trim() || numAmount <= 0}
          >
            {submitting ? 'Saving…' : initialData ? 'Save Changes' : 'Add to Plan'}
          </Button>
        </>
      }
    >
      <div onKeyDown={handleKeyDown}>
        <Stack gap="--space-5">
          {error && (
            <div role="alert">
              <Text size="xs" tone="bad">
                {error}
              </Text>
            </div>
          )}

          <FormField
            label="Name"
            htmlFor="expense-name"
            required
            error={error && !name.trim() ? error : undefined}
          >
            <TextField
              id="expense-name"
              autoFocus
              invalid={!!(error && !name.trim())}
              value={name}
              placeholder="e.g. Rent / Kontrakan Rumah, Listrik, Netflix"
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
            />
          </FormField>

          <FormField label="Payment Frequency" htmlFor="expense-freq">
            <SegmentedControl<'monthly' | 'annual'>
              options={[
                { value: 'monthly', label: 'Monthly (Bulanan)' },
                { value: 'annual', label: 'Annual / Yearly (Tahunan)' },
              ]}
              value={frequency}
              onChange={(v) => setFrequency(v)}
            />
          </FormField>

          <FormField
            label={frequency === 'annual' ? 'Annual Amount (Nominal per Tahun)' : 'Monthly Amount (Nominal per Bulan)'}
            htmlFor="expense-amount"
            required
            help={amountHelp}
            error={error && numAmount <= 0 ? error : undefined}
          >
            <div className="ui-money-field" style={{ '--ui-money-prefix-chars': 2 } as React.CSSProperties}>
              <div className="ui-money-field__box">
                <span className="ui-money-field__prefix">Rp</span>
                <TextField
                  id="expense-amount"
                  invalid={!!(error && numAmount <= 0)}
                  value={amount}
                  placeholder={frequency === 'annual' ? 'e.g. 28jt or 28.000.000' : 'e.g. 2.5jt or 2.500.000'}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (error) setError(null)
                  }}
                />
              </div>
            </div>
          </FormField>

          <FormField label="Conscious Spending Bucket (Pos)" htmlFor="expense-bucket" required>
            <Select
              id="expense-bucket"
              value={bucket}
              options={BUCKET_OPTIONS}
              onChange={(e) => setBucket(e.target.value as any)}
            />
          </FormField>

          <FormField label="Optional Due Date / Next Renewal" htmlFor="expense-due-date">
            <TextField
              id="expense-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>

          <FormField label="Notes (Optional)" htmlFor="expense-notes">
            <TextField
              id="expense-notes"
              value={notes}
              placeholder="e.g. Bayar kontrakan tahunan tiap tanggal 25 Jan"
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </Stack>
      </div>
    </Modal>
  )
}
