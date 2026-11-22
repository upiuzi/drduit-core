// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AddPlannedExpenseModal,
  parseInputAmount,
  sanitizeBucket,
  type PlannedExpenseItem,
} from './AddPlannedExpenseModal'

afterEach(() => {
  cleanup()
})

describe('AddPlannedExpenseModal - unit tests for all form controls', () => {
  it('parses various human-friendly amount strings correctly', () => {
    expect(parseInputAmount('28jt')).toBe(28000000)
    expect(parseInputAmount('28 jt')).toBe(28000000)
    expect(parseInputAmount('28 juta')).toBe(28000000)
    expect(parseInputAmount('2.5jt')).toBe(2500000)
    expect(parseInputAmount('500k')).toBe(500000)
    expect(parseInputAmount('500rb')).toBe(500000)
    expect(parseInputAmount('28.000.000')).toBe(28000000)
    expect(parseInputAmount('Rp 28.000.000')).toBe(28000000)
    expect(parseInputAmount('1000')).toBe(1000)
    expect(parseInputAmount('')).toBe(0)
    expect(parseInputAmount('invalid')).toBe(0)
  })

  it('safely sanitizes non-string or event objects as bucket', () => {
    expect(sanitizeBucket('fixed_costs')).toBe('fixed_costs')
    expect(sanitizeBucket('investments')).toBe('investments')
    expect(sanitizeBucket('savings')).toBe('savings')
    expect(sanitizeBucket('guilt_free')).toBe('guilt_free')

    // Synthetic event / DOM element simulation
    const mockElement = document.createElement('span')
    expect(sanitizeBucket(mockElement)).toBe('fixed_costs')
    expect(sanitizeBucket({ target: mockElement })).toBe('fixed_costs')
    expect(sanitizeBucket(undefined)).toBe('fixed_costs')
    expect(sanitizeBucket(null)).toBe('fixed_costs')
    expect(sanitizeBucket('unknown_bucket')).toBe('fixed_costs')
  })

  it('disables submit button when required name or amount is missing', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        defaultBucket="fixed_costs"
      />,
    )

    const submitBtn = screen.getByText('Add to Plan')
    // Both name and amount are empty -> button is disabled
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    // Fill in amount only -> button still disabled
    const amountInput = screen.getByPlaceholderText('e.g. 2.5jt or 2.500.000')
    fireEvent.change(amountInput, { target: { value: '500k' } })
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    // Fill in name -> button becomes enabled
    const nameInput = screen.getByPlaceholderText('e.g. Rent / Kontrakan Rumah, Listrik, Netflix')
    fireEvent.change(nameInput, { target: { value: 'Listrik' } })
    expect(submitBtn.hasAttribute('disabled')).toBe(false)
  })

  it('tests full creation flow with frequency, bucket selection, date, and notes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        defaultBucket="fixed_costs"
      />,
    )

    // 1. Name input
    const nameInput = screen.getByPlaceholderText('e.g. Rent / Kontrakan Rumah, Listrik, Netflix')
    fireEvent.change(nameInput, { target: { value: 'Kontrakan Rumah Tahunan' } })

    // 2. Frequency segmented control -> switch to Annual
    const annualBtn = screen.getByText('Annual / Yearly (Tahunan)')
    fireEvent.click(annualBtn)

    // 3. Amount input with 28jt
    const amountInput = screen.getByPlaceholderText('e.g. 28jt or 28.000.000')
    fireEvent.change(amountInput, { target: { value: '28jt' } })

    // 4. Bucket selection dropdown
    const bucketSelect = screen.getByLabelText(/Conscious Spending Bucket/)
    fireEvent.change(bucketSelect, { target: { value: 'fixed_costs' } })

    // 5. Due date
    const dateInput = screen.getByLabelText(/Optional Due Date/)
    fireEvent.change(dateInput, { target: { value: '2027-01-25' } })

    // 6. Notes
    const notesInput = screen.getByPlaceholderText('e.g. Bayar kontrakan tahunan tiap tanggal 25 Jan')
    fireEvent.change(notesInput, { target: { value: 'Kontrakan 1 tahun lunas di muka' } })

    // 7. Submit
    const submitBtn = screen.getByText('Add to Plan')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        id: undefined,
        name: 'Kontrakan Rumah Tahunan',
        amount: 28000000,
        frequency: 'annual',
        bucket: 'fixed_costs',
        due_date: '2027-01-25',
        notes: 'Kontrakan 1 tahun lunas di muka',
      })
      expect(onClose).toHaveBeenCalled()
    })

    // Assert the exact argument passed to onSave is cleanly JSON-serializable
    const lastArg = onSave.mock.calls[0]![0]
    expect(JSON.parse(JSON.stringify(lastArg))).toEqual({
      name: 'Kontrakan Rumah Tahunan',
      amount: 28000000,
      frequency: 'annual',
      bucket: 'fixed_costs',
      due_date: '2027-01-25',
      notes: 'Kontrakan 1 tahun lunas di muka',
    })
  })

  it('tests editing mode with initialData', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    const initialItem: PlannedExpenseItem = {
      id: 'plan_12345',
      name: 'Gym Gold',
      amount: 500000,
      frequency: 'monthly',
      monthly_amount: 500000,
      annual_amount: 6000000,
      bucket: 'fixed_costs',
      due_date: '2026-12-01',
      notes: 'Member gym bulanan',
    }

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        initialData={initialItem}
      />,
    )

    expect(screen.getByText('Edit planned expense')).toBeDefined()

    // Change amount to 600k
    const amountInput = screen.getByPlaceholderText('e.g. 2.5jt or 2.500.000')
    fireEvent.change(amountInput, { target: { value: '600000' } })

    // Change bucket to guilt_free
    const bucketSelect = screen.getByLabelText(/Conscious Spending Bucket/)
    fireEvent.change(bucketSelect, { target: { value: 'guilt_free' } })

    const saveChangesBtn = screen.getByText('Save Changes')
    fireEvent.click(saveChangesBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        id: 'plan_12345',
        name: 'Gym Gold',
        amount: 600000,
        frequency: 'monthly',
        bucket: 'guilt_free',
        due_date: '2026-12-01',
        notes: 'Member gym bulanan',
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('submitting with Enter key triggers handleSubmit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        defaultBucket="fixed_costs"
      />,
    )

    const nameInput = screen.getByPlaceholderText('e.g. Rent / Kontrakan Rumah, Listrik, Netflix')
    fireEvent.change(nameInput, { target: { value: 'Internet WiFi' } })

    const amountInput = screen.getByPlaceholderText('e.g. 2.5jt or 2.500.000')
    fireEvent.change(amountInput, { target: { value: '350k' } })

    // Press Enter in input
    fireEvent.keyDown(amountInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        id: undefined,
        name: 'Internet WiFi',
        amount: 350000,
        frequency: 'monthly',
        bucket: 'fixed_costs',
        due_date: null,
        notes: null,
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('guarantees protection against circular structure when defaultBucket is a DOM event', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    // Simulate clicking button which passed event { target: <span> }
    const spanEl = document.createElement('span')
    const simulatedEvent: Record<string, unknown> = { target: spanEl, currentTarget: spanEl }
    simulatedEvent.circularRef = simulatedEvent

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        defaultBucket={simulatedEvent as unknown as 'fixed_costs'}
      />,
    )

    const nameInput = screen.getByPlaceholderText('e.g. Rent / Kontrakan Rumah, Listrik, Netflix')
    fireEvent.change(nameInput, { target: { value: 'Biaya Air PDAM' } })

    const amountInput = screen.getByPlaceholderText('e.g. 2.5jt or 2.500.000')
    fireEvent.change(amountInput, { target: { value: '150k' } })

    const submitBtn = screen.getByText('Add to Plan')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })

    const payload = onSave.mock.calls[0]![0]
    expect(typeof payload.bucket).toBe('string')
    expect(payload.bucket).toBe('fixed_costs')
    expect(() => JSON.stringify(payload)).not.toThrow()
  })

  it('supports Income mode with onSaveIncome callback', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onSaveIncome = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        onSaveIncome={onSaveIncome}
        initialType="income"
      />,
    )

    expect(screen.getByText('Add planned income')).toBeDefined()

    const nameInput = screen.getByPlaceholderText('e.g. Gaji Pokok Kantor, Freelance UI, Dividen Saham, Bonus')
    fireEvent.change(nameInput, { target: { value: 'Gaji Pokok' } })

    const amountInput = screen.getByPlaceholderText('e.g. 15jt or 15.000.000')
    fireEvent.change(amountInput, { target: { value: '15jt' } })

    const submitBtn = screen.getByText('Add Income')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSaveIncome).toHaveBeenCalledWith({
        id: undefined,
        name: 'Gaji Pokok',
        amount: 15000000,
        frequency: 'monthly',
        notes: null,
      })
      expect(onClose).toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  it('allows switching from Expense to Income via SegmentedControl', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onSaveIncome = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <AddPlannedExpenseModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        onSaveIncome={onSaveIncome}
        initialType="expense"
      />,
    )

    // Initially expense
    expect(screen.getByText('Add planned expense')).toBeDefined()

    // Click Pemasukan (Income)
    const incomeOption = screen.getByText('💰 Pemasukan (Income)')
    fireEvent.click(incomeOption)

    expect(screen.getByText('Add planned income')).toBeDefined()
    const nameInput = screen.getByPlaceholderText('e.g. Gaji Pokok Kantor, Freelance UI, Dividen Saham, Bonus')
    fireEvent.change(nameInput, { target: { value: 'Freelance Design' } })

    const amountInput = screen.getByPlaceholderText('e.g. 15jt or 15.000.000')
    fireEvent.change(amountInput, { target: { value: '5000000' } })

    const submitBtn = screen.getByText('Add Income')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSaveIncome).toHaveBeenCalledWith({
        id: undefined,
        name: 'Freelance Design',
        amount: 5000000,
        frequency: 'monthly',
        notes: null,
      })
    })
  })
})
