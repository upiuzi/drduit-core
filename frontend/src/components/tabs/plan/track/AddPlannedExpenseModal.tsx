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

export interface PlannedIncomeItem {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'annual'
  monthly_amount: number
  annual_amount: number
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
  onSaveIncome?: (payload: {
    id?: string
    name: string
    amount: number
    frequency: 'monthly' | 'annual'
    notes?: string | null
  }) => Promise<void>
  initialData?: PlannedExpenseItem | PlannedIncomeItem | null
  defaultBucket?: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
  initialType?: 'expense' | 'income'
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

export const VALID_BUCKETS = ['fixed_costs', 'investments', 'savings', 'guilt_free'] as const
export type BucketKey = (typeof VALID_BUCKETS)[number]

export function sanitizeBucket(b: unknown): BucketKey {
  if (typeof b === 'string' && (VALID_BUCKETS as readonly string[]).includes(b)) {
    return b as BucketKey
  }
  return 'fixed_costs'
}

export function AddPlannedExpenseModal({
  isOpen,
  onClose,
  onSave,
  onSaveIncome,
  initialData,
  defaultBucket,
  initialType,
}: Props) {
  const [itemType, setItemType] = useState<'expense' | 'income'>(initialType || 'expense')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<string>('')
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [bucket, setBucket] = useState<BucketKey>('fixed_costs')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      const isIncome = !('bucket' in initialData) || initialType === 'income'
      setItemType(isIncome ? 'income' : 'expense')
      setName(String(initialData.name || ''))
      setAmount(String(initialData.amount ?? ''))
      setFrequency(initialData.frequency === 'annual' ? 'annual' : 'monthly')
      if ('bucket' in initialData && initialData.bucket) {
        setBucket(sanitizeBucket(initialData.bucket))
      }
      if ('due_date' in initialData && initialData.due_date) {
        setDueDate(String(initialData.due_date))
      } else {
        setDueDate('')
      }
      setNotes(initialData.notes ? String(initialData.notes) : '')
    } else {
      setItemType(initialType || 'expense')
      setName('')
      setAmount('')
      setFrequency('monthly')
      setBucket(sanitizeBucket(defaultBucket))
      setDueDate('')
      setNotes('')
    }
    setError(null)
  }, [initialData, defaultBucket, initialType, isOpen])

  if (!isOpen) return null

  const numAmount = parseInputAmount(amount)
  const monthlyEquivalent = frequency === 'annual' ? Math.round(numAmount / 12) : numAmount

  const handleSubmit = async () => {
    const cleanName = String(name || '').trim()
    if (!cleanName) {
      setError(itemType === 'income' ? 'Please enter an income source name.' : 'Please enter an expense name.')
      return
    }
    if (numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (itemType === 'income') {
        const incomePayload = {
          id: initialData?.id ? String(initialData.id) : undefined,
          name: cleanName,
          amount: Number(numAmount) || 0,
          frequency: frequency === 'annual' ? ('annual' as const) : ('monthly' as const),
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        }
        if (onSaveIncome) {
          await onSaveIncome(incomePayload)
        } else {
          await onSave({
            ...incomePayload,
            bucket: 'fixed_costs',
          })
        }
      } else {
        const safePayload = {
          id: initialData?.id ? String(initialData.id) : undefined,
          name: cleanName,
          amount: Number(numAmount) || 0,
          frequency: frequency === 'annual' ? ('annual' as const) : ('monthly' as const),
          bucket: sanitizeBucket(bucket),
          due_date: typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : null,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        }
        await onSave(safePayload)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to save ${itemType}.`)
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

  const modalTitle = initialData
    ? itemType === 'income'
      ? 'Edit planned income'
      : 'Edit planned expense'
    : itemType === 'income'
      ? 'Add planned income'
      : 'Add planned expense'

  const modalSubtitle =
    itemType === 'income'
      ? 'Conscious Spending Plan · Sumber Pemasukan Bersih (Take-Home Pay)'
      : 'Conscious Spending Plan · Rencana Pengeluaran'

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      title={modalTitle}
      subtitle={modalSubtitle}
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
            {submitting ? 'Saving…' : initialData ? 'Save Changes' : itemType === 'income' ? 'Add Income' : 'Add to Plan'}
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

          <FormField label="Entry Type" htmlFor="entry-type">
            <SegmentedControl<'expense' | 'income'>
              options={[
                { value: 'expense', label: '💸 Pengeluaran (Expense)' },
                { value: 'income', label: '💰 Pemasukan (Income)' },
              ]}
              value={itemType}
              onChange={(v) => {
                setItemType(v)
                setError(null)
              }}
            />
          </FormField>

          <FormField
            label={itemType === 'income' ? 'Sumber Pemasukan (Income Name)' : 'Name'}
            htmlFor="expense-name"
            required
            error={error && !name.trim() ? error : undefined}
          >
            <TextField
              id="expense-name"
              autoFocus
              invalid={!!(error && !name.trim())}
              value={name}
              placeholder={
                itemType === 'income'
                  ? 'e.g. Gaji Pokok Kantor, Freelance UI, Dividen Saham, Bonus'
                  : 'e.g. Rent / Kontrakan Rumah, Listrik, Netflix'
              }
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
            />
          </FormField>

          <FormField label="Frequency (Ritme)" htmlFor="expense-freq">
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
            label={
              frequency === 'annual'
                ? itemType === 'income'
                  ? 'Annual Income (Nominal per Tahun)'
                  : 'Annual Amount (Nominal per Tahun)'
                : itemType === 'income'
                  ? 'Monthly Income (Nominal per Bulan)'
                  : 'Monthly Amount (Nominal per Bulan)'
            }
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
                  placeholder={
                    frequency === 'annual'
                      ? itemType === 'income'
                        ? 'e.g. 24jt or 24.000.000'
                        : 'e.g. 28jt or 28.000.000'
                      : itemType === 'income'
                        ? 'e.g. 15jt or 15.000.000'
                        : 'e.g. 2.5jt or 2.500.000'
                  }
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (error) setError(null)
                  }}
                />
              </div>
            </div>
          </FormField>

          {itemType === 'expense' ? (
            <>
              <FormField label="Conscious Spending Bucket (Pos)" htmlFor="expense-bucket" required>
                <Select
                  id="expense-bucket"
                  value={bucket}
                  options={BUCKET_OPTIONS}
                  onChange={(e) => setBucket(sanitizeBucket(e.target.value))}
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
            </>
          ) : (
            <div
              style={{
                background: 'var(--surface, #1e222a)',
                border: '1px solid var(--line, #2d3340)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '18px' }}>💡</span>
              <span style={{ fontSize: '12px', color: 'var(--muted, #94a3b8)', lineHeight: 1.4 }}>
                Pemasukan ini akan otomatis dijumlahkan ke <strong>Total Take-Home Pay</strong> untuk menghitung persentase alokasi Ramit Sethi (50-60% Fixed Costs, 10%+ Investasi, 5-10% Tabungan, 20-35% Bebas Bersalah).
              </span>
            </div>
          )}

          <FormField label="Notes (Optional)" htmlFor="expense-notes">
            <TextField
              id="expense-notes"
              value={notes}
              placeholder={
                itemType === 'income'
                  ? 'e.g. Gaji ditransfer setiap tanggal 25'
                  : 'e.g. Bayar kontrakan tahunan tiap tanggal 25 Jan'
              }
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </Stack>
      </div>
    </Modal>
  )
}
