/**
 * Persona/Lens Data - Shared between InputBar and GlobalHeader
 */

import {
  CrownIcon,
  VaultDiamondIcon,
  NetworkSystemIcon,
  ScopeIcon,
  BroadcastIcon,
  CircuitNodeIcon,
  ScaleIcon,
  ComplianceIcon,
  AuditorIcon,
  LanternIcon,
} from '../icons/SovereignIcons'

export type PersonaCategory = 'EXECUTIVE' | 'COMPLIANCE'

export interface Persona {
  id: string
  label: string
  Icon: React.FC<{ className?: string; size?: number; color?: string }>
  description: string
  systemPrompt: string
  category: PersonaCategory
  isWhistleblower?: boolean
}

export const PERSONAS: Persona[] = [
  // Executive
  {
    id: 'ceo',
    label: 'CEO',
    Icon: CrownIcon,
    description: 'Strategic overview, high-level insights',
    systemPrompt: 'Prioritize board-level impact, strategic alignment, and competitive positioning.',
    category: 'EXECUTIVE',
  },
  {
    id: 'cfo',
    label: 'CFO',
    Icon: VaultDiamondIcon,
    description: 'Financial analysis, budget implications',
    systemPrompt: 'Prioritize EBITDA impact, identify unbudgeted liabilities, and flag cash flow risks.',
    category: 'EXECUTIVE',
  },
  {
    id: 'coo',
    label: 'COO',
    Icon: NetworkSystemIcon,
    description: 'Operations, process efficiency',
    systemPrompt: 'Focus on operational bottlenecks, resource allocation, and process optimization.',
    category: 'EXECUTIVE',
  },
  {
    id: 'cpo',
    label: 'CPO',
    Icon: ScopeIcon,
    description: 'Product insights, roadmap alignment',
    systemPrompt: 'Analyze product-market fit, roadmap dependencies, and user impact.',
    category: 'EXECUTIVE',
  },
  {
    id: 'cmo',
    label: 'CMO',
    Icon: BroadcastIcon,
    description: 'Market reach, brand strategy',
    systemPrompt: 'Evaluate brand positioning, market penetration, and competitive messaging.',
    category: 'EXECUTIVE',
  },
  {
    id: 'cto',
    label: 'CTO',
    Icon: CircuitNodeIcon,
    description: 'Technical architecture, security',
    systemPrompt: 'Assess technical debt, security vulnerabilities, and scalability concerns.',
    category: 'EXECUTIVE',
  },
  // Compliance
  {
    id: 'legal',
    label: 'Legal Counsel',
    Icon: ScaleIcon,
    description: 'Contract review, liability analysis',
    systemPrompt: 'Identify legal exposure, contractual obligations, and regulatory requirements.',
    category: 'COMPLIANCE',
  },
  {
    id: 'compliance',
    label: 'Compliance Officer',
    Icon: ComplianceIcon,
    description: 'Regulatory adherence, policy check',
    systemPrompt: 'Flag regulatory violations, policy gaps, and audit findings.',
    category: 'COMPLIANCE',
  },
  {
    id: 'auditor',
    label: 'Internal Auditor',
    Icon: AuditorIcon,
    description: 'Control testing, risk assessment',
    systemPrompt: 'Test internal controls, identify material weaknesses, and assess risk exposure.',
    category: 'COMPLIANCE',
  },
  {
    id: 'whistleblower',
    label: 'Whistleblower',
    Icon: LanternIcon,
    description: 'Forensic analysis, anomaly detection',
    systemPrompt: 'FORENSIC MODE: Hunt for anomalies, discrepancies, and hidden patterns. Flag anything suspicious.',
    category: 'COMPLIANCE',
    isWhistleblower: true,
  },
]
