import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  CircleCheck,
  Info,
  CalendarDays,
  Sparkles,
  DollarSign,
  TrendingUp,
} from '../../../../ui/icons'
import { Button } from '../../../ui'
import { fBase, fBaseWhole } from '../../../../utils/format'
import {
  AddPlannedExpenseModal,
  type PlannedExpenseItem,
} from './AddPlannedExpenseModal'

export interface CspDiagnosisItem {
  bucket: string
  severity: 'good' | 'warning' | 'danger'
  title: string
  message: string
  action: string
}

export interface CspPlanData {
  base_currency: string
  net_income: number
  net_income_source: string
  unexpected_buffer_enabled: boolean
  planned_expenses: PlannedExpenseItem[]
  score?: {
    points: number
    grade: string
    verdict: string
  }
  buckets: {
    fixed_costs: {
      key: string
      label: string
      description: string
      target_min: number
      target_max: number
      color: string
      monthly_subtotal: number
      unexpected_buffer?: number
      monthly_total: number
      pct_of_income: number
      status: 'good' | 'warning' | 'danger' | 'neutral'
      items: PlannedExpenseItem[]
    }
    investments: {
      key: string
      label: string
      description: string
      target_min: number
      target_max: number
      color: string
      monthly_subtotal: number
      monthly_total: number
      pct_of_income: number
      status: 'good' | 'warning' | 'danger' | 'neutral'
      items: PlannedExpenseItem[]
    }
    savings: {
      key: string
      label: string
      description: string
      target_min: number
      target_max: number
      color: string
      monthly_subtotal: number
      monthly_total: number
      pct_of_income: number
      status: 'good' | 'warning' | 'danger' | 'neutral'
      items: PlannedExpenseItem[]
    }
    guilt_free: {
      key: string
      label: string
      description: string
      target_min: number
      target_max: number
      color: string
      monthly_subtotal: number
      monthly_total: number
      pct_of_income: number
      status: 'good' | 'warning' | 'danger' | 'neutral'
      items: PlannedExpenseItem[]
    }
  }
  summary: {
    total_planned_monthly: number
    surplus_or_deficit: number
    guilt_free_allowance: number
    guilt_free_remaining: number
  }
  diagnoses: CspDiagnosisItem[]
}

interface Props {
  plan: CspPlanData
  onRefresh: () => Promise<void>
  onSaveExpense: (expense: {
    id?: string
    name: string
    amount: number
    frequency: 'monthly' | 'annual'
    bucket: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
    due_date?: string | null
    notes?: string | null
  }) => Promise<void>
  onDeleteExpense: (expenseId: string) => Promise<void>
  onUpdateIncome: (income: number) => Promise<void>
  onAskLucius?: (prompt: string) => void
  toast?: (msg: string) => void
}

export function PlanWorksheet({
  plan,
  onRefresh,
  onSaveExpense,
  onDeleteExpense,
  onUpdateIncome,
  onAskLucius,
  toast,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PlannedExpenseItem | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Income edit modal/inline state
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState<string>(String(plan.net_income || ''))

  // Quick inline row state (Excel style)
  const [quickName, setQuickName] = useState('')
  const [quickAmount, setQuickAmount] = useState('')
  const [quickFrequency, setQuickFrequency] = useState<'monthly' | 'annual'>('monthly')
  const [quickBucket, setQuickBucket] = useState<'fixed_costs' | 'investments' | 'savings' | 'guilt_free'>('fixed_costs')
  const [quickDueDate, setQuickDueDate] = useState('')
  const [savingQuick, setSavingQuick] = useState(false)

  const parseInputAmount = (val: string): number => {
    let s = val.trim().toLowerCase()
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
    } else {
      s = s.replace(/,/g, '.')
    }
    const num = parseFloat(s)
    return isNaN(num) ? 0 : Math.round(num * mult * 100) / 100
  }

  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!quickName.trim()) {
      toast?.('Please enter an expense name.')
      return
    }
    const amt = parseInputAmount(quickAmount)
    if (amt <= 0) {
      toast?.('Please enter a valid amount (e.g. 28jt or 28000000).')
      return
    }
    setSavingQuick(true)
    try {
      await onSaveExpense({
        name: quickName.trim(),
        amount: amt,
        frequency: quickFrequency,
        bucket: quickBucket,
        due_date: quickDueDate.trim() || null,
      })
      setQuickName('')
      setQuickAmount('')
      setQuickDueDate('')
      toast?.(`Added "${quickName.trim()}" to worksheet.`)
      await onRefresh()
    } catch {
      toast?.('Failed to add expense.')
    } finally {
      setSavingQuick(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: PlannedExpenseItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleDelete = async (item: PlannedExpenseItem) => {
    if (confirm(`Remove planned expense "${item.name}"?`)) {
      try {
        await onDeleteExpense(item.id)
        toast?.(`Removed "${item.name}".`)
        await onRefresh()
      } catch {
        toast?.('Failed to delete expense.')
      }
    }
  }

  const handleSaveIncome = async () => {
    const val = parseFloat(incomeInput)
    if (isNaN(val) || val < 0) {
      toast?.('Please enter a valid positive number for Net Income.')
      return
    }
    try {
      await onUpdateIncome(val)
      setEditingIncome(false)
      toast?.('Monthly Take-Home Net Income updated.')
      await onRefresh()
    } catch {
      toast?.('Failed to update income.')
    }
  }

  const filteredItems =
    activeFilter === 'all'
      ? plan.planned_expenses
      : plan.planned_expenses.filter((it) => it.bucket === activeFilter)

  const { fixed_costs, investments, savings, guilt_free } = plan.buckets

  return (
    <div className="csp-worksheet-root">
      {/* ── Net Income Header Card ── */}
      <div className="csp-income-strip">
        <div className="csp-income-left">
          <div className="csp-income-badge">
            <DollarSign size={14} />
            <span>Monthly Take-Home Pay (Net Income)</span>
          </div>
          <div className="csp-income-amount-wrap">
            {editingIncome ? (
              <div className="csp-income-edit-form">
                <input
                  type="number"
                  className="csp-form-input csp-income-input"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="e.g. 15000000"
                  autoFocus
                />
                <Button variant="primary" size="dense" onClick={handleSaveIncome}>
                  Save
                </Button>
                <Button variant="secondary" size="dense" onClick={() => setEditingIncome(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="csp-income-display">
                <span className="csp-income-figure">{fBase(plan.net_income)}</span>
                <span className="csp-income-per-mo">/ month</span>
                <button
                  type="button"
                  className="csp-edit-income-btn"
                  onClick={() => {
                    setIncomeInput(String(plan.net_income || ''))
                    setEditingIncome(true)
                  }}
                  title="Update Net Income"
                >
                  <Pencil size={13} />
                  <span>Edit Income</span>
                </button>
              </div>
            )}
          </div>
          <p className="csp-income-caption">
            Used as the 100% denominator for your 4 Conscious Spending Plan target ratios.
          </p>
        </div>

        <div className="csp-income-right">
          <div className="csp-summary-stat">
            <span className="csp-stat-label">Total Planned Monthly Outflows</span>
            <span className="csp-stat-val">{fBaseWhole(plan.summary.total_planned_monthly)} /mo</span>
          </div>
          <div className="csp-summary-stat">
            <span className="csp-stat-label">Remaining Surplus / Deficit</span>
            <span
              className="csp-stat-val"
              style={{
                color: plan.summary.surplus_or_deficit >= 0 ? 'var(--good, #10b981)' : 'var(--bad, #ef4444)',
              }}
            >
              {plan.summary.surplus_or_deficit >= 0 ? '+' : ''}
              {fBaseWhole(plan.summary.surplus_or_deficit)} /mo
            </span>
          </div>
        </div>
      </div>

      {/* ── Financial Health Scorecard Banner ── */}
      {plan.score && (
        <div className={`csp-score-banner csp-score-${plan.score.grade.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className="csp-score-left">
            <div className="csp-score-circle">
              <span className="csp-score-number">{plan.score.points}</span>
              <span className="csp-score-denom">/100</span>
            </div>
            <div className="csp-score-details">
              <div className="csp-score-badge-wrap">
                <span className="csp-score-badge">{plan.score.grade} Plan</span>
                <span className="csp-score-subtext">Ramit Sethi Conscious Spending Score</span>
              </div>
              <p className="csp-score-verdict">{plan.score.verdict}</p>
            </div>
          </div>
          <div className="csp-score-metrics">
            <div className="csp-score-metric-item">
              <span className="csp-sm-label">Fixed Costs</span>
              <span className={`csp-sm-val ${fixed_costs.pct_of_income <= 60 ? 'good' : 'danger'}`}>
                {fixed_costs.pct_of_income}% <span className="csp-sm-target">(50-60%)</span>
              </span>
            </div>
            <div className="csp-score-metric-item">
              <span className="csp-sm-label">Investments</span>
              <span className={`csp-sm-val ${investments.pct_of_income >= 10 ? 'good' : 'warning'}`}>
                {investments.pct_of_income}% <span className="csp-sm-target">(10%+)</span>
              </span>
            </div>
            <div className="csp-score-metric-item">
              <span className="csp-sm-label">Savings</span>
              <span className={`csp-sm-val ${savings.pct_of_income >= 5 ? 'good' : 'warning'}`}>
                {savings.pct_of_income}% <span className="csp-sm-target">(5-10%)</span>
              </span>
            </div>
            <div className="csp-score-metric-item">
              <span className="csp-sm-label">Guilt-Free</span>
              <span className={`csp-sm-val ${guilt_free.pct_of_income <= 35 ? 'good' : 'warning'}`}>
                {guilt_free.pct_of_income}% <span className="csp-sm-target">(20-35%)</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Ramit Sethi 4-Bucket Ratio Progress Cards ── */}
      <div className="csp-worksheet-cards-grid">
        {/* Fixed Costs Card */}
        <div className={`csp-worksheet-card csp-card-${fixed_costs.status}`}>
          <div className="csp-wcard-top">
            <div className="csp-wcard-title-group">
              <span className="csp-bucket-dot" style={{ backgroundColor: fixed_costs.color }} />
              <span className="csp-wcard-name">Fixed Costs</span>
            </div>
            <span className="csp-target-badge">Target: 50%–60%</span>
          </div>

          <div className="csp-wcard-figures">
            <div className="csp-wcard-main-pct" style={{ color: fixed_costs.color }}>
              {fixed_costs.pct_of_income}%
            </div>
            <div className="csp-wcard-nominal">{fBaseWhole(fixed_costs.monthly_total)} /mo</div>
          </div>

          {/* Progress bar with 50-60% target guideline */}
          <div className="csp-ratio-bar-wrap">
            <div className="csp-ratio-bar-track">
              <div
                className="csp-ratio-bar-fill"
                style={{
                  width: `${Math.min(100, fixed_costs.pct_of_income)}%`,
                  backgroundColor: fixed_costs.color,
                }}
              />
              {/* Target zone 50-60% marker */}
              <div
                className="csp-target-zone-marker"
                style={{ left: '50%', width: '10%' }}
                title="Target Zone: 50% - 60%"
              />
            </div>
            <div className="csp-ratio-bar-legend">
              <span>0%</span>
              <span style={{ color: 'var(--ink)' }}>Target: 50%–60%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="csp-wcard-footer">
            <span>
              {fixed_costs.items.length} item{fixed_costs.items.length !== 1 ? 's' : ''} planned
            </span>
            {plan.unexpected_buffer_enabled && (fixed_costs.unexpected_buffer || 0) > 0 && (
              <span className="csp-buffer-tag" title="15% buffer for unexpected bills">
                +{fBaseWhole(fixed_costs.unexpected_buffer || 0)} buffer
              </span>
            )}
          </div>
        </div>

        {/* Investments Card */}
        <div className={`csp-worksheet-card csp-card-${investments.status}`}>
          <div className="csp-wcard-top">
            <div className="csp-wcard-title-group">
              <span className="csp-bucket-dot" style={{ backgroundColor: investments.color }} />
              <span className="csp-wcard-name">Investments</span>
            </div>
            <span className="csp-target-badge">Target: 10%+</span>
          </div>

          <div className="csp-wcard-figures">
            <div className="csp-wcard-main-pct" style={{ color: investments.color }}>
              {investments.pct_of_income}%
            </div>
            <div className="csp-wcard-nominal">{fBaseWhole(investments.monthly_total)} /mo</div>
          </div>

          <div className="csp-ratio-bar-wrap">
            <div className="csp-ratio-bar-track">
              <div
                className="csp-ratio-bar-fill"
                style={{
                  width: `${Math.min(100, investments.pct_of_income * 2)}%`,
                  backgroundColor: investments.color,
                }}
              />
              <div className="csp-target-min-marker" style={{ left: '20%' }} title="Target: 10%+" />
            </div>
            <div className="csp-ratio-bar-legend">
              <span>0%</span>
              <span style={{ color: 'var(--ink)' }}>Min: 10%</span>
              <span>50%+</span>
            </div>
          </div>

          <div className="csp-wcard-footer">
            <span>
              {investments.items.length} item{investments.items.length !== 1 ? 's' : ''} planned
            </span>
            <span>Index funds, crypto, retirement</span>
          </div>
        </div>

        {/* Savings Goals Card */}
        <div className={`csp-worksheet-card csp-card-${savings.status}`}>
          <div className="csp-wcard-top">
            <div className="csp-wcard-title-group">
              <span className="csp-bucket-dot" style={{ backgroundColor: savings.color }} />
              <span className="csp-wcard-name">Savings Goals</span>
            </div>
            <span className="csp-target-badge">Target: 5%–10%</span>
          </div>

          <div className="csp-wcard-figures">
            <div className="csp-wcard-main-pct" style={{ color: savings.color }}>
              {savings.pct_of_income}%
            </div>
            <div className="csp-wcard-nominal">{fBaseWhole(savings.monthly_total)} /mo</div>
          </div>

          <div className="csp-ratio-bar-wrap">
            <div className="csp-ratio-bar-track">
              <div
                className="csp-ratio-bar-fill"
                style={{
                  width: `${Math.min(100, savings.pct_of_income * 5)}%`,
                  backgroundColor: savings.color,
                }}
              />
              <div className="csp-target-zone-marker" style={{ left: '25%', width: '25%' }} title="Target: 5%–10%" />
            </div>
            <div className="csp-ratio-bar-legend">
              <span>0%</span>
              <span style={{ color: 'var(--ink)' }}>Target: 5%–10%</span>
              <span>20%</span>
            </div>
          </div>

          <div className="csp-wcard-footer">
            <span>
              {savings.items.length} item{savings.items.length !== 1 ? 's' : ''} planned
            </span>
            <span>Emergency fund, vacations, gifts</span>
          </div>
        </div>

        {/* Guilt-Free Spending Card */}
        <div className={`csp-worksheet-card csp-card-${guilt_free.status}`}>
          <div className="csp-wcard-top">
            <div className="csp-wcard-title-group">
              <span className="csp-bucket-dot" style={{ backgroundColor: guilt_free.color }} />
              <span className="csp-wcard-name">Guilt-Free Spending</span>
            </div>
            <span className="csp-target-badge">Target: 20%–35%</span>
          </div>

          <div className="csp-wcard-figures">
            <div className="csp-wcard-main-pct" style={{ color: guilt_free.color }}>
              {guilt_free.pct_of_income}%
            </div>
            <div className="csp-wcard-nominal">{fBaseWhole(guilt_free.monthly_total)} /mo</div>
          </div>

          <div className="csp-ratio-bar-wrap">
            <div className="csp-ratio-bar-track">
              <div
                className="csp-ratio-bar-fill"
                style={{
                  width: `${Math.min(100, guilt_free.pct_of_income * 2)}%`,
                  backgroundColor: guilt_free.color,
                }}
              />
              <div className="csp-target-zone-marker" style={{ left: '40%', width: '30%' }} title="Target: 20%–35%" />
            </div>
            <div className="csp-ratio-bar-legend">
              <span>0%</span>
              <span style={{ color: 'var(--ink)' }}>Target: 20%–35%</span>
              <span>50%</span>
            </div>
          </div>

          <div className="csp-wcard-footer">
            <span>
              {guilt_free.items.length} item{guilt_free.items.length !== 1 ? 's' : ''} planned
            </span>
            <span>Allowance: {fBaseWhole(plan.summary.guilt_free_allowance)} /mo</span>
          </div>
        </div>
      </div>

      {/* ── Diagnosis & Action Recommendations Banner ── */}
      {plan.diagnoses && plan.diagnoses.length > 0 && (
        <div className="csp-diagnoses-container">
          <div className="csp-diagnoses-header">
            <div className="csp-diagnoses-title-group">
              <Sparkles size={16} />
              <h3>Conscious Spending Plan Diagnosis & Advice</h3>
            </div>
            {onAskLucius && (
              <Button
                variant="secondary"
                size="dense"
                onClick={() =>
                  onAskLucius(
                    `Evaluasi Conscious Spending Plan saya: Take-Home Income ${fBaseWhole(plan.net_income)}/bulan. Fixed Costs ${fixed_costs.pct_of_income}% (${fBaseWhole(fixed_costs.monthly_total)}), Investments ${investments.pct_of_income}%, Savings ${savings.pct_of_income}%, Guilt-Free ${guilt_free.pct_of_income}%. Total pengeluaran bulanan ${fBaseWhole(plan.summary.total_planned_monthly)}. Apakah ada pengeluaran yang perlu di-cut atau income yang perlu ditambah agar sesuai aturan Ramit Sethi? Berikan rekomendasi langkah demi langkah.`,
                  )
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={13} />
                <span>Ask Uzi to Analyze Plan</span>
              </Button>
            )}
          </div>

          <div className="csp-diagnoses-list">
            {plan.diagnoses.map((diag, idx) => (
              <div key={idx} className={`csp-diag-item csp-diag-${diag.severity}`}>
                <div className="csp-diag-icon">
                  {diag.severity === 'danger' && <AlertTriangle size={18} color="var(--bad, #ef4444)" />}
                  {diag.severity === 'warning' && <AlertTriangle size={18} color="var(--warning, #f59e0b)" />}
                  {diag.severity === 'good' && <CircleCheck size={18} color="var(--good, #10b981)" />}
                </div>
                <div className="csp-diag-content">
                  <div className="csp-diag-title">{diag.title}</div>
                  <div className="csp-diag-msg">{diag.message}</div>
                  {diag.action && (
                    <div className="csp-diag-action">
                      <strong>Recommended Action:</strong> {diag.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Planned Expenses Management Table ── */}
      <div className="csp-planned-table-section">
        <div className="csp-table-toolbar">
          <div className="csp-table-title-wrap">
            <h3>Planned Monthly & Annual Expenses</h3>
            <span className="csp-count-pill">{plan.planned_expenses.length}</span>
          </div>

          <div className="csp-table-actions">
            <div className="csp-filter-chips">
              <button
                type="button"
                className={`csp-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All ({plan.planned_expenses.length})
              </button>
              <button
                type="button"
                className={`csp-filter-chip ${activeFilter === 'fixed_costs' ? 'active' : ''}`}
                onClick={() => setActiveFilter('fixed_costs')}
              >
                Fixed Costs ({fixed_costs.items.length})
              </button>
              <button
                type="button"
                className={`csp-filter-chip ${activeFilter === 'investments' ? 'active' : ''}`}
                onClick={() => setActiveFilter('investments')}
              >
                Investments ({investments.items.length})
              </button>
              <button
                type="button"
                className={`csp-filter-chip ${activeFilter === 'savings' ? 'active' : ''}`}
                onClick={() => setActiveFilter('savings')}
              >
                Savings ({savings.items.length})
              </button>
              <button
                type="button"
                className={`csp-filter-chip ${activeFilter === 'guilt_free' ? 'active' : ''}`}
                onClick={() => setActiveFilter('guilt_free')}
              >
                Guilt-Free ({guilt_free.items.length})
              </button>
            </div>

            <Button
              variant="primary"
              size="dense"
              onClick={handleOpenAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Add Planned Expense</span>
            </Button>
          </div>
        </div>

        <div className="csp-table-wrap">
          <table className="csp-planned-table">
            <thead>
              <tr>
                <th>Expense Name</th>
                <th>Frequency</th>
                <th>Nominal Amount</th>
                <th>Monthly Impact</th>
                <th>Bucket</th>
                <th>Due / Renewal</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* ── Excel-like Quick Add Row ── */}
              <tr className="csp-quick-add-tr">
                <td>
                  <input
                    type="text"
                    className="csp-quick-cell-input"
                    placeholder="+ Add expense (e.g. Kontrakan)..."
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleQuickAdd()
                    }}
                  />
                </td>
                <td>
                  <select
                    className="csp-quick-cell-select"
                    value={quickFrequency}
                    onChange={(e) => setQuickFrequency(e.target.value as 'monthly' | 'annual')}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual (/yr)</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    className="csp-quick-cell-input"
                    placeholder="e.g. 28jt or 28000000"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleQuickAdd()
                    }}
                  />
                </td>
                <td>
                  <span className="csp-quick-preview-impact">
                    {quickAmount
                      ? `${fBase(parseInputAmount(quickAmount) / (quickFrequency === 'annual' ? 12 : 1))} /mo`
                      : '—'}
                  </span>
                </td>
                <td>
                  <select
                    className="csp-quick-cell-select"
                    value={quickBucket}
                    onChange={(e) => setQuickBucket(e.target.value as any)}
                  >
                    <option value="fixed_costs">Fixed Costs (50-60%)</option>
                    <option value="investments">Investments (10%+)</option>
                    <option value="savings">Savings (5-10%)</option>
                    <option value="guilt_free">Guilt-Free (20-35%)</option>
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    className="csp-quick-cell-input"
                    value={quickDueDate}
                    onChange={(e) => setQuickDueDate(e.target.value)}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Button
                    variant="primary"
                    size="dense"
                    onClick={() => void handleQuickAdd()}
                    disabled={savingQuick || !quickName.trim() || !quickAmount.trim()}
                    title="Add expense row"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </Button>
                </td>
              </tr>

              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--faint)' }}>
                    No planned expenses found for this filter. Use the input row above to add one, or click &ldquo;Add Planned Expense&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const bMeta = plan.buckets[item.bucket] || fixed_costs
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="csp-expense-name-cell">
                          <span className="csp-item-title">{item.name}</span>
                          {item.notes && <span className="csp-item-notes">{item.notes}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`csp-freq-tag ${item.frequency}`}>
                          {item.frequency === 'annual' ? 'Annual (Yearly)' : 'Monthly'}
                        </span>
                      </td>
                      <td>
                        <span className="csp-nominal-figure">
                          {fBase(item.amount)}
                          <span className="csp-freq-sub">
                            {item.frequency === 'annual' ? ' / yr' : ' / mo'}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="csp-monthly-figure">
                          {fBase(item.monthly_amount)}
                          <span className="csp-freq-sub"> / mo</span>
                        </span>
                      </td>
                      <td>
                        <span
                          className="csp-bucket-badge"
                          style={{
                            color: bMeta.color,
                            backgroundColor: `color-mix(in srgb, ${bMeta.color} 12%, transparent)`,
                            borderColor: `color-mix(in srgb, ${bMeta.color} 30%, transparent)`,
                          }}
                        >
                          <span className="csp-badge-dot" style={{ backgroundColor: bMeta.color }} />
                          {bMeta.label}
                        </span>
                      </td>
                      <td>
                        {item.due_date ? (
                          <span className="csp-due-date-cell">
                            <CalendarDays size={12} />
                            <span>{item.due_date}</span>
                          </span>
                        ) : (
                          <span className="csp-faint">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="csp-row-actions">
                          <button
                            type="button"
                            className="csp-action-btn edit"
                            onClick={() => handleOpenEdit(item)}
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="csp-action-btn delete"
                            onClick={() => handleDelete(item)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Planned Expense Modal */}
      <AddPlannedExpenseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (payload) => {
          await onSaveExpense(payload)
          toast?.(editingItem ? 'Planned expense updated.' : 'Planned expense added.')
          await onRefresh()
        }}
        initialData={editingItem}
      />
    </div>
  )
}
