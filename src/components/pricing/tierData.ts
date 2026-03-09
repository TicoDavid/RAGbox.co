// E31-006: Hardcoded tier data — canonical pricing source
// Tier card data, feature map, and comparison sections

export interface TierFeatures {
  'Vault storage': string
  Documents: string
  'RAG queries/month': string
  'Mercury AI chat': boolean
  'Citation system': boolean
  'Audit log': boolean
  'Voice features': boolean
  'WhatsApp integration': boolean
  'Email/SMS actions': boolean
  'Custom personas': boolean
  'API access': boolean
  'Team management': boolean
}

export interface TierDef {
  id: string
  name: string
  monthlyPrice: number
  annualPrice: number
  description: string
  popular?: boolean
  features: TierFeatures
  cta: string
  priceEnvKey: { monthly: string; annual: string }
}

export const TIERS: TierDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 23,
    description: 'For solo practitioners getting started',
    features: {
      'Vault storage': '500 MB',
      Documents: '100',
      'RAG queries/month': '500',
      'Mercury AI chat': true,
      'Citation system': true,
      'Audit log': true,
      'Voice features': false,
      'WhatsApp integration': false,
      'Email/SMS actions': false,
      'Custom personas': false,
      'API access': false,
      'Team management': false,
    },
    cta: 'Start Free Trial',
    priceEnvKey: {
      monthly: 'NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY',
      annual: 'NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 99,
    annualPrice: 79,
    description: 'For growing firms that need more power',
    popular: true,
    features: {
      'Vault storage': '2 GB',
      Documents: '500',
      'RAG queries/month': '2,000',
      'Mercury AI chat': true,
      'Citation system': true,
      'Audit log': true,
      'Voice features': true,
      'WhatsApp integration': true,
      'Email/SMS actions': false,
      'Custom personas': false,
      'API access': false,
      'Team management': false,
    },
    cta: 'Start Free Trial',
    priceEnvKey: {
      monthly: 'NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY',
      annual: 'NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL',
    },
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 249,
    annualPrice: 199,
    description: 'For firms requiring advanced compliance',
    features: {
      'Vault storage': '10 GB',
      Documents: '2,000',
      'RAG queries/month': '10,000',
      'Mercury AI chat': true,
      'Citation system': true,
      'Audit log': true,
      'Voice features': true,
      'WhatsApp integration': true,
      'Email/SMS actions': true,
      'Custom personas': true,
      'API access': true,
      'Team management': false,
    },
    cta: 'Start Free Trial',
    priceEnvKey: {
      monthly: 'NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY',
      annual: 'NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_ANNUAL',
    },
  },
  {
    id: 'vrep',
    name: 'Single V-Rep',
    monthlyPrice: 499,
    annualPrice: 399,
    description: 'Your dedicated AI representative',
    features: {
      'Vault storage': '25 GB',
      Documents: '5,000',
      'RAG queries/month': '50,000',
      'Mercury AI chat': true,
      'Citation system': true,
      'Audit log': true,
      'Voice features': true,
      'WhatsApp integration': true,
      'Email/SMS actions': true,
      'Custom personas': true,
      'API access': true,
      'Team management': true,
    },
    cta: 'Get Started',
    priceEnvKey: {
      monthly: 'NEXT_PUBLIC_STRIPE_PRICE_VREP_MONTHLY',
      annual: 'NEXT_PUBLIC_STRIPE_PRICE_VREP_ANNUAL',
    },
  },
  {
    id: 'aiteam',
    name: 'AI Team',
    monthlyPrice: 2499,
    annualPrice: 1999,
    description: 'Full AI workforce for enterprise teams',
    features: {
      'Vault storage': '100 GB',
      Documents: '20,000',
      'RAG queries/month': 'Unlimited',
      'Mercury AI chat': true,
      'Citation system': true,
      'Audit log': true,
      'Voice features': true,
      'WhatsApp integration': true,
      'Email/SMS actions': true,
      'Custom personas': true,
      'API access': true,
      'Team management': true,
    },
    cta: 'Contact Sales',
    priceEnvKey: {
      monthly: 'NEXT_PUBLIC_STRIPE_PRICE_AITEAM_MONTHLY',
      annual: 'NEXT_PUBLIC_STRIPE_PRICE_AITEAM_ANNUAL',
    },
  },
]

// Feature keys grouped for the comparison table
export const FEATURE_SECTIONS: { title: string; keys: (keyof TierFeatures)[] }[] = [
  {
    title: 'Core',
    keys: ['Mercury AI chat', 'Citation system', 'Audit log'],
  },
  {
    title: 'Channels',
    keys: ['Voice features', 'WhatsApp integration', 'Email/SMS actions'],
  },
  {
    title: 'Advanced',
    keys: ['Custom personas', 'API access', 'Team management'],
  },
  {
    title: 'Limits',
    keys: ['Vault storage', 'Documents', 'RAG queries/month'],
  },
]
