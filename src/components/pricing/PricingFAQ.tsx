'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'Can I change plans anytime?',
    a: 'Yes. Upgrade or downgrade anytime from your dashboard Settings. Changes are prorated automatically by Stripe — you only pay the difference for the remainder of your billing cycle.',
  },
  {
    q: 'How does the free trial work?',
    a: 'Every paid plan includes a 14-day free trial. No credit card required to start. At the end of your trial, you can choose to subscribe or your account reverts to the free tier.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your documents remain encrypted and accessible until the end of your billing period. After that, your account moves to the free tier with reduced limits. We never delete your data without explicit action.',
  },
  {
    q: 'What is Privilege Mode?',
    a: 'Attorney-Client Privilege Mode is a binary toggle that segregates privileged documents from standard queries. When active, privileged docs are invisible to non-privileged users. Full immutable audit trail included.',
  },
  {
    q: 'What does "Bring Your Own LLM" mean?',
    a: 'Mercury supports BYOLLM — connect your own API key from OpenAI, Anthropic, Google AI, or OpenRouter. Your key, your model, your data stays in your pipeline. Available on Business and higher plans.',
  },
  {
    q: 'Is my data secure?',
    a: 'RAGbox encrypts all documents at rest (AES-256) and in transit (TLS 1.3). We operate on a zero-retention model — we never train on your data. Enterprise tiers add CMEK (Customer Managed Encryption Keys) for full key control.',
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left group"
      >
        <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--brand-blue)] transition-colors pr-4">
          {question}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed pb-4">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PricingFAQ() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-8 font-[family-name:var(--font-space)]">
        Frequently Asked Questions
      </h2>
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-default)] px-6">
        {FAQS.map((faq) => (
          <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
        ))}
      </div>
    </div>
  )
}
