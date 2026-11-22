import React, { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
  CalendarDays,
  Plus,
} from '../../../../ui/icons'
import { Button } from '../../../ui'
import { fBase, fBaseWhole } from '../../../../utils/format'
import { fetchJson } from '../../../../hooks/serverState'
import {
  CustomizeCategoriesModal,
  type CategoryCatalogItem,
} from './CustomizeCategoriesModal'
import { TransactionsDrawer, type TrackTransaction } from './TransactionsDrawer'
import { PlanWorksheet, type CspPlanData } from './PlanWorksheet'
import { AddPlannedExpenseModal } from './AddPlannedExpenseModal'
import './track.css'

interface BucketCategory {
  id: string
  label: string
  color: string
  spent: number
  count: number
  pct_of_income: number
}

interface BucketDetail {
  key: string
  label: string
  description: string
  target_min: number
  target_max: number
  color: string
  actual_spent: number
  actual_pct: number
  status: 'good' | 'warning' | 'danger' | 'neutral'
  categories: BucketCategory[]
  transactions_count: number
  planned_monthly?: number
  planned_items?: any[]
  planned_due_in_month?: any[]
  planned_due_amount?: number
}

interface CspTrackResponse {
  month: string
  base_currency: string
  net_income: number
  net_income_source: string
  total_spent: number
  unallocated: number
  guilt_free_allowance: number
  guilt_free_spent: number
  guilt_free_remaining: number
  guilt_free_status: 'good' | 'warning' | 'danger'
  unexpected_buffer: number
  unexpected_buffer_enabled: boolean
  buckets: {
    fixed_costs: BucketDetail
    investments: BucketDetail
    savings: BucketDetail
    guilt_free: BucketDetail
  }
  recent_transactions: TrackTransaction[]
  category_mappings: Record<string, string>
  categories_catalog: CategoryCatalogItem[]
  plan?: CspPlanData
  planned_in_month?: any[]
}

interface Props {
  onAskLucius?: (prompt: string) => void
  toast?: (msg: string) => void
}

function getInitialMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function formatMonthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function TrackTab({ onAskLucius, toast }: Props) {
  const [month, setMonth] = useState<string>(getInitialMonth)
  const [data, setData] = useState<CspTrackResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'worksheet' | 'track'>('worksheet')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalBucket, setAddModalBucket] = useState<'fixed_costs' | 'investments' | 'savings' | 'guilt_free'>('fixed_costs')

  const handleOpenAddModal = (bucket: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free' = 'fixed_costs') => {
    setAddModalBucket(bucket)
    setAddModalOpen(true)
  }

  // Modals state
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeDrawerBucket, setActiveDrawerBucket] = useState<{
    label: string
    color: string
    txns: TrackTransaction[]
  } | null>(null)

  const [activeTxnFilter, setActiveTxnFilter] = useState<string>('all')

  const loadData = useCallback(async (targetMonth: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJson<CspTrackResponse>(`/api/plan/track?month=${targetMonth}`)
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Conscious Spending Plan data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(month)
  }, [month, loadData])

  const handlePrevMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const prev = new Date(y, m - 2, 1)
    const nextY = prev.getFullYear()
    const nextM = String(prev.getMonth() + 1).padStart(2, '0')
    setMonth(`${nextY}-${nextM}`)
  }

  const handleNextMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const next = new Date(y, m, 1)
    const nextY = next.getFullYear()
    const nextM = String(next.getMonth() + 1).padStart(2, '0')
    setMonth(`${nextY}-${nextM}`)
  }

  const handleThisMonth = () => {
    setMonth(getInitialMonth())
  }

  const handleSaveConfig = async (payload: {
    category_mappings: Record<string, string>
    unexpected_buffer_enabled: boolean
    custom_monthly_income: number | null
  }) => {
    try {
      await fetchJson('/api/plan/track/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      toast?.('Conscious Spending Plan settings saved successfully!')
      await loadData(month)
    } catch {
      toast?.('Failed to save settings.')
    }
  }

  const handleSaveExpense = async (payload: {
    id?: string
    name: string
    amount: number
    frequency: 'monthly' | 'annual'
    bucket: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free'
    due_date?: string | null
    notes?: string | null
  }) => {
    try {
      await fetchJson('/api/plan/track/planned-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await loadData(month)
    } catch (err) {
      toast?.('Failed to save planned expense.')
      throw err
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await fetchJson(`/api/plan/track/planned-expenses/${expenseId}`, {
        method: 'DELETE',
      })
      await loadData(month)
    } catch {
      toast?.('Failed to delete planned expense.')
    }
  }

  const handleUpdateIncome = async (income: number) => {
    try {
      await fetchJson('/api/plan/track/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_net_income: income }),
      })
      await loadData(month)
    } catch {
      toast?.('Failed to update income.')
    }
  }

  const openDrawerForBucket = (bucketKey: 'fixed_costs' | 'investments' | 'savings' | 'guilt_free') => {
    if (!data) return
    const b = data.buckets[bucketKey]
    const txns = data.recent_transactions.filter((t) => t.bucket === bucketKey)
    setActiveDrawerBucket({
      label: b.label,
      color: b.color,
      txns,
    })
    setDrawerOpen(true)
  }

  if (loading && !data) {
    return (
      <div className="csp-track-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: 'var(--faint)' }}>Loading Conscious Spending Plan...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="csp-track-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: 'var(--bad)' }}>{error || 'An error occurred while loading data.'}</p>
        <Button variant="secondary" size="dense" onClick={() => void loadData(month)}>
          Try Again
        </Button>
      </div>
    )
  }

  const {
    net_income,
    total_spent,
    unallocated,
    guilt_free_allowance,
    guilt_free_spent,
    guilt_free_remaining,
    guilt_free_status,
    unexpected_buffer,
    unexpected_buffer_enabled,
    buckets,
    recent_transactions,
    category_mappings,
    categories_catalog,
  } = data

  const guiltFreeProgressPct =
    guilt_free_allowance > 0
      ? Math.min(100, Math.round((guilt_free_spent / guilt_free_allowance) * 100))
      : 100

  const filteredTxns =
    activeTxnFilter === 'all'
      ? recent_transactions
      : recent_transactions.filter((t) => t.bucket === activeTxnFilter)

  return (
    <div className="csp-track-container">
      {/* ── Toolbar: View Switcher, Month Navigation & Actions ── */}
      <div className="csp-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="csp-view-toggle">
            <button
              type="button"
              className={`csp-view-btn ${activeView === 'worksheet' ? 'active' : ''}`}
              onClick={() => setActiveView('worksheet')}
            >
              Plan Worksheet & Scorecard
              {data.plan?.planned_expenses?.length ? (
                <span className="csp-pill-badge">{data.plan.planned_expenses.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`csp-view-btn ${activeView === 'track' ? 'active' : ''}`}
              onClick={() => setActiveView('track')}
            >
              Monthly Actuals (Ledger)
            </button>
          </div>

          {activeView === 'track' && (
            <div className="csp-month-picker">
              <button className="csp-btn-icon" onClick={handlePrevMonth} aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <span className="csp-month-label">{formatMonthTitle(month)}</span>
              <button className="csp-btn-icon" onClick={handleNextMonth} aria-label="Next month">
                <ChevronRight size={16} />
              </button>
              {month !== getInitialMonth() && (
                <Button variant="secondary" size="dense" onClick={handleThisMonth}>
                  This Month
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="csp-tools-right">
          <Button
            variant="primary"
            size="dense"
            onClick={() => handleOpenAddModal('fixed_costs')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            <span>+ Add Expense (Manual)</span>
          </Button>

          {activeView === 'track' && (
            <Button
              variant="secondary"
              size="dense"
              onClick={() => setCustomizeOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <SlidersHorizontal size={14} />
              <span>Configure Buckets & Targets</span>
            </Button>
          )}

          {onAskLucius && (
            <Button
              variant="secondary"
              size="dense"
              onClick={() =>
                onAskLucius(
                  activeView === 'worksheet' && data.plan
                    ? `Evaluasi Conscious Spending Plan saya: Take-Home Income ${fBaseWhole(data.plan.net_income)}/bulan. Fixed Costs ${data.plan.buckets.fixed_costs.pct_of_income}% (${fBaseWhole(data.plan.buckets.fixed_costs.monthly_total)}), Investments ${data.plan.buckets.investments.pct_of_income}%, Savings ${data.plan.buckets.savings.pct_of_income}%, Guilt-Free ${data.plan.buckets.guilt_free.pct_of_income}%. Total pengeluaran bulanan ${fBaseWhole(data.plan.summary.total_planned_monthly)}. Apakah ada pengeluaran yang perlu di-cut atau income yang perlu ditambah agar sesuai aturan Ramit Sethi?`
                    : `Evaluate my Conscious Spending Plan for ${formatMonthTitle(month)}: Net Income ${fBaseWhole(net_income)}, Fixed Costs ${buckets.fixed_costs.actual_pct}%, Investments ${buckets.investments.actual_pct}%, Savings ${buckets.savings.actual_pct}%, and remaining Guilt-Free Spending ${fBaseWhole(guilt_free_remaining)}. What would Ramit Sethi advise for my current allocation?`,
                )
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              <span>Ask Uzi</span>
            </Button>
          )}
        </div>
      </div>

      {activeView === 'worksheet' && data.plan ? (
        <PlanWorksheet
          plan={data.plan}
          onRefresh={() => loadData(month)}
          onSaveExpense={handleSaveExpense}
          onDeleteExpense={handleDeleteExpense}
          onUpdateIncome={handleUpdateIncome}
          onAskLucius={onAskLucius}
          toast={toast}
        />
      ) : (
        <>
          {/* ── Hero Card: Guilt-Free Spending Balance ── */}
      <div className="csp-hero-card">
        <div className="csp-hero-header">
          <div className="csp-hero-title-group">
            <div className="csp-hero-tag">
              <Sparkles size={14} />
              <span>Conscious Spending Plan (Ramit Sethi)</span>
            </div>
            <h2 className="csp-hero-title">Guilt-Free Spending Balance</h2>
          </div>

          <div className={`csp-hero-status-pill ${guilt_free_status}`}>
            {guilt_free_status === 'good' && '🟢 Guilt-Free & On Track'}
            {guilt_free_status === 'warning' && '🟡 Running Low'}
            {guilt_free_status === 'danger' && '🔴 Over Allocation'}
          </div>
        </div>

        <div
          className={`csp-hero-big-number ${guilt_free_remaining < 0 ? 'negative' : ''}`}
        >
          {fBaseWhole(guilt_free_remaining)}
        </div>

        <div className="csp-hero-progress-track">
          <div
            className="csp-hero-progress-bar"
            style={{
              width: `${guiltFreeProgressPct}%`,
              background:
                guilt_free_status === 'danger'
                  ? 'var(--bad)'
                  : guilt_free_status === 'warning'
                    ? 'var(--warn)'
                    : 'var(--violet, #8b5cf6)',
            }}
          />
        </div>

        <div className="csp-hero-stats-row">
          <span className="csp-hero-stat">
            Available Allowance: <b>{fBase(guilt_free_allowance)}</b>
          </span>
          <span>•</span>
          <span className="csp-hero-stat">
            Spent: <b>{fBase(guilt_free_spent)}</b> ({guiltFreeProgressPct}%)
          </span>
          <span>•</span>
          <span className="csp-hero-stat">
            Take-Home Pay: <b>{fBase(net_income)}</b>
          </span>
        </div>

        <p className="csp-hero-quote">
          "Spend extravagantly on the things you love, and cut costs mercilessly on the things you
          don't." — Ramit Sethi
        </p>
      </div>

      {/* ── The 4 Buckets Grid ── */}
      <div className="csp-buckets-grid">
        {([
          { key: 'fixed_costs', max: 60, target: '50–60%', label: 'Max 60%' },
          { key: 'investments', max: 100, target: '10%+', label: 'Min 10%' },
          { key: 'savings', max: 10, target: '5–10%', label: 'Target 5–10%' },
          { key: 'guilt_free', max: 35, target: '20–35%', label: 'Max 35%' },
        ] as const).map(({ key, max, target, label }) => {
          const b = buckets[key]
          const hasActual = b.actual_spent > 0
          const hasDue = (b.planned_due_amount || 0) > 0
          const hasPlanned = (b.planned_monthly || 0) > 0
          const displayAmount = hasActual
            ? b.actual_spent
            : hasDue
              ? (b.planned_due_amount || 0)
              : (b.planned_monthly || 0)
          const displayPct =
            net_income > 0 ? Math.round((displayAmount / net_income) * 1000) / 10 : 0
          const pctWidth = Math.min(100, (displayPct / max) * 100)
          const isOver = displayPct > max && (key === 'fixed_costs' || key === 'guilt_free')

          return (
            <div key={b.key} className="csp-bucket-card">
              <div className="csp-bucket-card-head">
                <div className="csp-bucket-badge">
                  <span className="csp-bucket-dot" style={{ background: b.color }} />
                  <span>{b.label}</span>
                </div>
                <span className="csp-bucket-target-pill">Target: {target}</span>
              </div>

              <div>
                <div className="csp-bucket-amount">{fBaseWhole(displayAmount)}</div>
                <div className="csp-bucket-sub-amount">
                  {hasActual ? (
                    <span>
                      Actual spent ({fBase(b.planned_monthly || 0)}/mo planned)
                    </span>
                  ) : hasDue ? (
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      Due in {formatMonthTitle(month)} • {fBase(b.planned_monthly || 0)}/mo plan
                    </span>
                  ) : hasPlanned ? (
                    <span>Planned: {fBase(b.planned_monthly || 0)} / bulan</span>
                  ) : (
                    <span>No spend or plan recorded</span>
                  )}
                </div>
              </div>

              <div className="csp-bucket-progress-wrap">
                <div className="csp-bucket-pct-row">
                  <span style={{ color: b.color }}>{displayPct}% of income</span>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                </div>
                <div className="csp-bucket-track">
                  <div
                    className="csp-bucket-bar"
                    style={{
                      width: `${pctWidth}%`,
                      background: isOver ? 'var(--bad)' : b.color,
                    }}
                  />
                </div>
              </div>

              <p className="csp-bucket-desc">
                {b.description}
                {key === 'fixed_costs' && unexpected_buffer_enabled && unexpected_buffer > 0 && (
                  <span
                    style={{
                      display: 'block',
                      marginTop: '4px',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    +15% Unexpected Buffer: {fBase(unexpected_buffer)}
                  </span>
                )}
              </p>

              {/* Planned Expenses in this Pos */}
              {b.planned_items && b.planned_items.length > 0 && (
                <div className="csp-bucket-planned-section">
                  <span className="csp-bucket-section-label">
                    Planned Expenses ({b.planned_items.length})
                  </span>
                  {b.planned_items.slice(0, 3).map((it: any) => (
                    <div key={it.id} className="csp-bucket-cat-row">
                      <span className="csp-bucket-cat-name" title={it.name}>
                        {it.name} {it.due_date ? `• Due ${it.due_date}` : ''}
                      </span>
                      <span className="csp-bucket-cat-val">
                        {fBase(it.monthly_amount)}/mo
                        {it.frequency === 'annual' ? ` (${fBase(it.amount)}/thn)` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actual ledger transactions breakdown if any */}
              {b.categories && b.categories.length > 0 && (
                <div className="csp-bucket-cats">
                  <span className="csp-bucket-section-label">Actual Spent by Category</span>
                  {b.categories.slice(0, 3).map((c) => (
                    <div key={c.id || c.label} className="csp-bucket-cat-row">
                      <span className="csp-bucket-cat-name" title={c.label}>
                        {c.label}
                      </span>
                      <span className="csp-bucket-cat-val">{fBase(c.spent)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="csp-bucket-actions-row">
                <button
                  type="button"
                  className="csp-bucket-add-btn"
                  onClick={() => handleOpenAddModal(key)}
                  title={`Add expense to ${b.label}`}
                >
                  <Plus size={12} />
                  <span>+ Add</span>
                </button>
                <button
                  type="button"
                  className="csp-bucket-footer-btn"
                  style={{ flex: 1 }}
                  onClick={() => openDrawerForBucket(key)}
                >
                  Txns ({b.transactions_count})
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Summary Strip: Take-Home vs Total Spent vs Net Savings ── */}
      <div className="csp-summary-strip">
        <div className="csp-summary-box">
          <span className="csp-summary-label">Net Take-Home Pay</span>
          <span className="csp-summary-value">{fBaseWhole(net_income)}</span>
        </div>
        <div className="csp-summary-box">
          <span className="csp-summary-label">Total Spending This Month</span>
          <span className="csp-summary-value">{fBaseWhole(total_spent)}</span>
        </div>
        <div className="csp-summary-box">
          <span className="csp-summary-label">Unallocated Cash Flow</span>
          <span
            className="csp-summary-value"
            style={{ color: unallocated >= 0 ? 'var(--good)' : 'var(--bad)' }}
          >
            {fBaseWhole(unallocated)}
          </span>
        </div>
      </div>

      {/* ── Upcoming Planned in This Month ── */}
      {data.planned_in_month && data.planned_in_month.length > 0 && (
        <div className="csp-upcoming-banner">
          <div className="csp-upcoming-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={16} color="var(--primary, #3b86dd)" />
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700 }}>
                Planned Expenses Due in {formatMonthTitle(month)} ({data.planned_in_month.length})
              </h4>
            </div>
            <Button variant="secondary" size="dense" onClick={() => setActiveView('worksheet')}>
              View in Plan Worksheet
            </Button>
          </div>
          <div className="csp-upcoming-grid">
            {data.planned_in_month.map((it: any) => (
              <div key={it.id} className="csp-upcoming-chip">
                <span className="csp-upcoming-name">{it.name}</span>
                <span className="csp-upcoming-amt">{fBase(it.amount)}</span>
                <span className="csp-upcoming-due">Due: {it.due_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent CSP Transactions ── */}
      <div className="csp-txns-section">
        <div className="csp-txns-head">
          <h4>Month Transactions</h4>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'fixed_costs', label: 'Fixed Costs' },
              { id: 'investments', label: 'Investments' },
              { id: 'savings', label: 'Savings' },
              { id: 'guilt_free', label: 'Guilt-Free' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveTxnFilter(f.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: '1px solid var(--line)',
                  background: activeTxnFilter === f.id ? 'var(--text)' : 'var(--bg-2)',
                  color: activeTxnFilter === f.id ? 'var(--panel)' : 'var(--muted)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTxns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: '13px' }}>
            <p style={{ margin: '0 0 12px' }}>
              No bank transactions recorded for {formatMonthTitle(month)} in the ledger.
            </p>
            <Button variant="secondary" size="dense" onClick={() => setActiveView('worksheet')}>
              Open Plan Worksheet & Scorecard
            </Button>
          </div>
        ) : (
          <div className="csp-txns-list">
            {filteredTxns.slice(0, 15).map((t) => {
              const bucketColor =
                t.bucket === 'fixed_costs'
                  ? buckets.fixed_costs.color
                  : t.bucket === 'investments'
                    ? buckets.investments.color
                    : t.bucket === 'savings'
                      ? buckets.savings.color
                      : buckets.guilt_free.color
              return (
                <div key={t.id} className="csp-txn-item">
                  <div className="csp-txn-left">
                    <span className="csp-txn-payee">{t.payee}</span>
                    <span className="csp-txn-meta">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span>{t.category_label}</span>
                      {t.notes && <span>• {t.notes}</span>}
                    </span>
                  </div>
                  <div className="csp-txn-right">
                    <span
                      className="csp-bucket-tag"
                      style={{ background: bucketColor }}
                    >
                      {t.bucket.replace('_', ' ')}
                    </span>
                    <span className="csp-txn-amount">{fBase(t.amount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )}

      {/* ── Modals ── */}
      <CustomizeCategoriesModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        categories={categories_catalog}
        currentMappings={category_mappings}
        unexpectedBufferEnabled={unexpected_buffer_enabled}
        customIncome={net_income}
        onSave={handleSaveConfig}
      />

      {activeDrawerBucket && (
        <TransactionsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bucketLabel={activeDrawerBucket.label}
          bucketColor={activeDrawerBucket.color}
          transactions={activeDrawerBucket.txns}
        />
      )}

      {/* Manual Add Expense Modal (Accessible globally in Track) */}
      <AddPlannedExpenseModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={async (payload) => {
          await handleSaveExpense(payload)
          toast?.('Planned expense added.')
          await loadData(month)
        }}
        defaultBucket={addModalBucket}
      />
    </div>
  )
}
