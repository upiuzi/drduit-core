import React from 'react'
import { X } from '../../../../ui/icons'
import { fBase } from '../../../../utils/format'

export interface TrackTransaction {
  id: string
  date: string
  payee: string
  notes?: string
  amount: number
  bucket: string
  category_label: string
}

interface Props {
  open: boolean
  onClose: () => void
  bucketLabel: string
  bucketColor: string
  transactions: TrackTransaction[]
}

export function TransactionsDrawer({
  open,
  onClose,
  bucketLabel,
  bucketColor,
  transactions,
}: Props) {
  if (!open) return null

  return (
    <div className="csp-modal-backdrop" onClick={onClose}>
      <div className="csp-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="csp-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: bucketColor,
              }}
            />
            <h3>{bucketLabel} Transactions</h3>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'var(--bg-2)',
                color: 'var(--muted)',
                border: '1px solid var(--line)',
              }}
            >
              {transactions.length} transactions
            </span>
          </div>
          <button className="csp-btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="csp-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {transactions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--muted)',
                fontSize: '13px',
              }}
            >
              No transactions in this bucket for the selected month.
            </div>
          ) : (
            <div className="csp-txns-list">
              {transactions.map((t) => (
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
                    <span className="csp-txn-amount">{fBase(t.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="csp-modal-footer">
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--panel)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
