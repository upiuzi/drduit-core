import React, { useState } from 'react'
import { X, Check } from '../../../../ui/icons'
import { Button } from '../../../ui'

export interface CategoryCatalogItem {
  id: string
  label: string
  color: string
  current_bucket: string
}

interface Props {
  open: boolean
  onClose: () => void
  categories: CategoryCatalogItem[]
  currentMappings: Record<string, string>
  unexpectedBufferEnabled: boolean
  customIncome: number | null
  onSave: (payload: {
    category_mappings: Record<string, string>
    unexpected_buffer_enabled: boolean
    custom_monthly_income: number | null
  }) => Promise<void>
}

const BUCKET_OPTIONS = [
  { key: 'fixed_costs', label: 'Fixed Costs (50–60%)', color: '#3b86dd' },
  { key: 'investments', label: 'Investments (10%+)', color: '#10b981' },
  { key: 'savings', label: 'Savings Goals (5–10%)', color: '#f59e0b' },
  { key: 'guilt_free', label: 'Guilt-Free Spending (20–35%)', color: '#8b5cf6' },
]

export function CustomizeCategoriesModal({
  open,
  onClose,
  categories,
  currentMappings,
  unexpectedBufferEnabled,
  customIncome,
  onSave,
}: Props) {
  const [mappings, setMappings] = useState<Record<string, string>>({ ...currentMappings })
  const [bufferEnabled, setBufferEnabled] = useState(unexpectedBufferEnabled)
  const [incomeVal, setIncomeVal] = useState<string>(customIncome ? String(customIncome) : '')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  if (!open) return null

  const handleBucketChange = (catId: string, bucketKey: string) => {
    setMappings((prev) => ({
      ...prev,
      [catId]: bucketKey,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        category_mappings: mappings,
        unexpected_buffer_enabled: bufferEnabled,
        custom_monthly_income: incomeVal ? Number(incomeVal) : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const filteredCats = categories.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="csp-modal-backdrop" onClick={onClose}>
      <div className="csp-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="csp-modal-head">
          <h3>Atur Conscious Spending Plan</h3>
          <button className="csp-btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="csp-modal-body">
          {/* Unexpected Buffer Toggle */}
          <div
            style={{
              background: 'var(--bg-hover, #f9fafb)',
              padding: '12px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                15% Unexpected Costs Buffer
              </div>
              <div style={{ fontSize: '12px', color: 'var(--faint)' }}>
                Rekomendasi Ramit Sethi: tambahkan 15% cadangan biaya tak terduga pada Fixed Costs.
              </div>
            </div>
            <input
              type="checkbox"
              checked={bufferEnabled}
              onChange={(e) => setBufferEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          {/* Custom Monthly Income */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
              Penghasilan Bersih Bulanan (Manual Override)
            </label>
            <input
              type="number"
              placeholder="Kosongkan jika otomatis dari transaksi income"
              value={incomeVal}
              onChange={(e) => setIncomeVal(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '13px',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--faint)' }}>
              Jika diisi, angka ini menggantikan kalkulasi income otomatis untuk pembagian persentase.
            </span>
          </div>

          {/* Category Mapping Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--faint)' }}>
                Pemetaan Kategori ({filteredCats.length})
              </span>
              <input
                type="text"
                placeholder="Cari kategori..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  width: '150px',
                }}
              />
            </div>

            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              {filteredCats.map((cat) => {
                const currentBucket = mappings[cat.id] || cat.current_bucket || 'guilt_free'
                return (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--card-bg)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: cat.color || '#9ca3af',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                        {cat.label}
                      </span>
                    </div>

                    <select
                      value={currentBucket}
                      onChange={(e) => handleBucketChange(cat.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {BUCKET_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="csp-modal-footer">
          <Button variant="secondary" size="dense" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" size="dense" onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
