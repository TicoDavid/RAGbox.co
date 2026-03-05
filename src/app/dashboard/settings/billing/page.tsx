'use client'

/**
 * E26-007: Billing Settings Page
 *
 * - Current plan card (tier, price, renewal date)
 * - Usage meters (vault size, document count, queries this month)
 * - Upgrade/downgrade buttons
 * - Manage Payment Method → Stripe Customer Portal
 * - Invoice history table
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  ArrowUpRight,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  MessageSquare,
  Zap,
  ExternalLink,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface PlanInfo {
  name: string
  price: number
  interval: 'month' | 'year'
  renewsAt: string | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
}

interface UsageData {
  storageUsedBytes: number
  storageLimitBytes: number
  documentCount: number
  documentLimit: number
  queriesThisMonth: number
  queryLimit: number
}

interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'open' | 'void' | 'draft'
  pdfUrl?: string
}

interface BillingData {
  plan: PlanInfo
  usage: UsageData
  invoices: Invoice[]
  hasStripeCustomer: boolean
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function usagePct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function statusColor(status: PlanInfo['status']): string {
  switch (status) {
    case 'active': return 'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20'
    case 'trialing': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    case 'past_due': return 'text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20'
    case 'canceled': return 'text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/20'
  }
}

function invoiceStatusBadge(status: Invoice['status']) {
  const map: Record<Invoice['status'], { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'text-[var(--success)] bg-[var(--success)]/10' },
    open: { label: 'Open', cls: 'text-[var(--warning)] bg-[var(--warning)]/10' },
    void: { label: 'Void', cls: 'text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]' },
    draft: { label: 'Draft', cls: 'text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ============================================================================
// DEFAULT DATA — shown before API loads / when no subscription exists
// ============================================================================

const DEFAULT_BILLING: BillingData = {
  plan: { name: 'Free', price: 0, interval: 'month', renewsAt: null, status: 'active' },
  usage: {
    storageUsedBytes: 0,
    storageLimitBytes: 100 * 1024 * 1024, // 100MB free tier
    documentCount: 0,
    documentLimit: 5,
    queriesThisMonth: 0,
    queryLimit: 25,
  },
  invoices: [],
  hasStripeCustomer: false,
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function BillingSettings() {
  const [data, setData] = useState<BillingData>(DEFAULT_BILLING)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/usage')
      if (res.ok) {
        const json = await res.json()
        // Map Sheldon's response shape → internal UsageData
        // API returns: { documents: { used, limit }, storage: { used, limit }, queries: { used, limit }, period }
        if (json.documents || json.storage || json.queries) {
          setData((prev) => ({
            ...prev,
            usage: {
              storageUsedBytes: json.storage?.used ?? 0,
              storageLimitBytes: json.storage?.limit ?? 100 * 1024 * 1024,
              documentCount: json.documents?.used ?? 0,
              documentLimit: json.documents?.limit ?? 5,
              queriesThisMonth: json.queries?.used ?? 0,
              queryLimit: json.queries?.limit ?? 25,
            },
          }))
        }
      }
    } catch {
      // Use default data on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
    } catch {
      // Silent fail
    } finally {
      setPortalLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
    } catch {
      // Silent fail
    }
  }

  const { plan, usage, invoices, hasStripeCustomer } = data

  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <CreditCard size={16} className="text-[var(--brand-blue)]" />
        Billing & Subscription
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Current Plan Card ── */}
          <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-[var(--text-primary)]">{plan.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColor(plan.status)}`}>
                    {plan.status}
                  </span>
                </div>
                {plan.price > 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    ${plan.price}/{plan.interval === 'year' ? 'yr' : 'mo'}
                  </p>
                )}
                {plan.renewsAt && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {plan.status === 'canceled' ? 'Expires' : 'Renews'} {formatDate(plan.renewsAt)}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {plan.name === 'Sovereign' && (
                  <button
                    onClick={() => handleUpgrade('sovereign_mercury')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    Add Mercury
                  </button>
                )}
                {plan.name === 'Free' && (
                  <button
                    onClick={() => handleUpgrade('sovereign')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border border-[var(--brand-blue)]/20 hover:bg-[var(--brand-blue)]/20 transition-colors"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    Upgrade
                  </button>
                )}
              </div>
            </div>

            {/* Manage Payment */}
            {hasStripeCustomer && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 text-xs text-[var(--brand-blue)] hover:underline disabled:opacity-50"
              >
                {portalLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3" />
                )}
                Manage payment method & subscription
              </button>
            )}
          </div>

          {/* ── Usage Meters ── */}
          <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-4">
              Usage This Period
            </p>

            <div className="space-y-4">
              <UsageMeter
                icon={<HardDrive size={14} className="text-[var(--brand-blue)]" />}
                label="Vault Storage"
                used={formatBytes(usage.storageUsedBytes)}
                limit={formatBytes(usage.storageLimitBytes)}
                pct={usagePct(usage.storageUsedBytes, usage.storageLimitBytes)}
              />
              <UsageMeter
                icon={<FileText size={14} className="text-emerald-400" />}
                label="Documents"
                used={usage.documentCount.toString()}
                limit={usage.documentLimit > 0 ? usage.documentLimit.toString() : 'Unlimited'}
                pct={usage.documentLimit > 0 ? usagePct(usage.documentCount, usage.documentLimit) : 0}
              />
              <UsageMeter
                icon={<MessageSquare size={14} className="text-amber-400" />}
                label="Queries This Month"
                used={usage.queriesThisMonth.toString()}
                limit={usage.queryLimit > 0 ? usage.queryLimit.toString() : 'Unlimited'}
                pct={usage.queryLimit > 0 ? usagePct(usage.queriesThisMonth, usage.queryLimit) : 0}
              />
            </div>
          </div>

          {/* ── Invoice History ── */}
          <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-4">
              Invoice History
            </p>

            {invoices.length === 0 ? (
              <div className="py-4 text-center">
                <FileText className="w-6 h-6 text-[var(--text-tertiary)] mx-auto mb-1 opacity-40" />
                <p className="text-xs text-[var(--text-tertiary)]">No invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--bg-tertiary)]">
                      <th className="text-left py-2 text-[var(--text-tertiary)] font-medium">Date</th>
                      <th className="text-left py-2 text-[var(--text-tertiary)] font-medium">Amount</th>
                      <th className="text-left py-2 text-[var(--text-tertiary)] font-medium">Status</th>
                      <th className="text-right py-2 text-[var(--text-tertiary)] font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-[var(--bg-tertiary)] last:border-0">
                        <td className="py-2.5 text-[var(--text-secondary)]">{formatDate(inv.date)}</td>
                        <td className="py-2.5 text-[var(--text-primary)] font-medium">{formatCurrency(inv.amount)}</td>
                        <td className="py-2.5">{invoiceStatusBadge(inv.status)}</td>
                        <td className="py-2.5 text-right">
                          {inv.pdfUrl && (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[var(--brand-blue)] hover:underline"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Plan Comparison Quick Links ── */}
          <div className="text-center pt-2">
            <a
              href="/pricing"
              className="text-xs text-[var(--brand-blue)] hover:underline"
            >
              Compare all plans
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// USAGE METER
// ============================================================================

function UsageMeter({
  icon,
  label,
  used,
  limit,
  pct,
}: {
  icon: React.ReactNode
  label: string
  used: string
  limit: string
  pct: number
}) {
  const barColor = pct >= 90 ? 'bg-[var(--danger)]' : pct >= 70 ? 'bg-[var(--warning)]' : 'bg-[var(--brand-blue)]'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
        </div>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 90 && (
        <div className="flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3 h-3 text-[var(--danger)]" />
          <span className="text-[10px] text-[var(--danger)]">Approaching limit</span>
        </div>
      )}
      {pct >= 70 && pct < 90 && (
        <div className="flex items-center gap-1 mt-1">
          <CheckCircle2 className="w-3 h-3 text-[var(--warning)]" />
          <span className="text-[10px] text-[var(--warning)]">{pct}% used</span>
        </div>
      )}
    </div>
  )
}
