'use client'

import React from 'react'
import { ContextBar } from './ContextBar'
import { ConversationThread } from './ConversationThread'
import { InputBar } from './InputBar'

export function MercuryPanel() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <ContextBar />
      <ConversationThread />
      <InputBar />
    </div>
  )
}
