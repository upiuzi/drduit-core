// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackTab } from './TrackTab'
import * as serverState from '../../../../hooks/serverState'

describe('TrackTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the conscious spending plan track tab with guilt-free remaining hero', async () => {
    const mockData = {
      month: '2026-11',
      base_currency: 'IDR',
      net_income: 20000000,
      net_income_source: 'transactions',
      total_spent: 12000000,
      unallocated: 8000000,
      guilt_free_allowance: 5000000,
      guilt_free_spent: 2000000,
      guilt_free_remaining: 3000000,
      guilt_free_status: 'good',
      unexpected_buffer: 1500000,
      unexpected_buffer_enabled: true,
      buckets: {
        fixed_costs: {
          key: 'fixed_costs',
          label: 'Fixed Costs',
          description: 'Sewa, listrik, groceries',
          target_min: 50,
          target_max: 60,
          color: '#3b86dd',
          actual_spent: 10000000,
          actual_pct: 50,
          status: 'good',
          categories: [{ id: 'c1', label: 'Rent', color: '#3b86dd', spent: 6000000, count: 1, pct_of_income: 30 }],
          transactions_count: 5,
        },
        investments: {
          key: 'investments',
          label: 'Investments',
          description: 'Saham & reksadana',
          target_min: 10,
          target_max: 100,
          color: '#10b981',
          actual_spent: 2000000,
          actual_pct: 10,
          status: 'good',
          categories: [],
          transactions_count: 2,
        },
        savings: {
          key: 'savings',
          label: 'Savings Goals',
          description: 'Dana darurat',
          target_min: 5,
          target_max: 10,
          color: '#f59e0b',
          actual_spent: 1000000,
          actual_pct: 5,
          status: 'good',
          categories: [],
          transactions_count: 1,
        },
        guilt_free: {
          key: 'guilt_free',
          label: 'Guilt-Free Spending',
          description: 'Makan di luar, hobi',
          target_min: 20,
          target_max: 35,
          color: '#8b5cf6',
          actual_spent: 2000000,
          actual_pct: 10,
          status: 'good',
          categories: [],
          transactions_count: 8,
        },
      },
      recent_transactions: [
        {
          id: 't1',
          date: '2026-11-20',
          payee: 'Kopi Kenangan',
          amount: 25000,
          bucket: 'guilt_free',
          category_label: 'Ngopi',
        },
      ],
      category_mappings: {},
      categories_catalog: [],
    }

    vi.spyOn(serverState, 'fetchJson').mockResolvedValue(mockData)

    render(<TrackTab />)

    // Should show loading then content
    await waitFor(() => {
      expect(screen.getByText('Guilt-Free Spending Balance')).toBeDefined()
    })

    expect(screen.getAllByText('Fixed Costs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Investments').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Savings Goals').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Guilt-Free Spending').length).toBeGreaterThan(0)
    expect(screen.getByText('Kopi Kenangan')).toBeDefined()
  })
})
