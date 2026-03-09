'use client'

import React from 'react'
import { Check, Minus } from 'lucide-react'
import { TIERS, FEATURE_SECTIONS, type TierFeatures } from './tierData'

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-[var(--text-secondary)] font-medium">{value}</span>
  }
  if (value) {
    return <Check className="w-4 h-4 text-[var(--success)] mx-auto" />
  }
  return <Minus className="w-4 h-4 text-[var(--text-tertiary)]/30 mx-auto" />
}

export function FeatureComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            <th className="text-left py-4 pr-4 text-sm font-semibold text-[var(--text-tertiary)] w-[28%] sticky left-0 bg-[var(--bg-primary)]">
              Features
            </th>
            {TIERS.map((tier) => (
              <th
                key={tier.id}
                className={`text-center py-4 px-2 text-sm font-semibold w-[14.4%] ${
                  tier.popular ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_SECTIONS.map((section) => (
            <React.Fragment key={section.title}>
              <tr>
                <td
                  colSpan={6}
                  className="pt-6 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-tertiary)]"
                >
                  {section.title}
                </td>
              </tr>
              {section.keys.map((featureKey, idx) => (
                <tr
                  key={featureKey}
                  className={`border-b border-[var(--border-subtle)] ${
                    idx % 2 === 0 ? 'bg-[var(--bg-secondary)]/30' : ''
                  }`}
                >
                  <td className="py-3 pr-4 text-sm text-[var(--text-secondary)] sticky left-0 bg-inherit">
                    {featureKey}
                  </td>
                  {TIERS.map((tier) => (
                    <td key={tier.id} className="py-3 px-2 text-center">
                      <CellValue value={tier.features[featureKey as keyof TierFeatures]} />
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
