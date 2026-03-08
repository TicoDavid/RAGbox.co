'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useIsDesktop, useIsTablet } from '@/hooks/useMediaQuery'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { SovereignExplorer } from './vault/explorer'
import { MercuryWindow } from './mercury/MercuryWindow'
import { isMercuryEnabled } from '@/lib/features'
import { useMercuryEntitlement } from '@/hooks/useMercuryEntitlement'
import { MercuryUpgradeCard } from '@/components/ui/MercuryUpgradeCard'
import { CenterChat } from './chat'
import { ChatErrorBoundary } from './chat/ChatErrorBoundary'
import { OnboardingWizard } from './OnboardingWizard'
import { PostCheckoutWizard } from '@/components/onboarding/PostCheckoutWizard'
import { SovereignStudio } from './studio'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'
import {
  RightStealthRail,
  type LeftRailTab,
  type RightRailTab,
} from './StealthRails'
import { Sidebar } from '@/components/Sidebar'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import { apiFetch } from '@/lib/api'
import { ExportPanel } from './export'
import {
  RecentFilesPanel,
  StarredPanel,
  AuditPanel,
  MobileOverlay,
  MobileToolbar,
  MobileBottomNav,
  type MobileTab,
} from './DashboardPanels'

// ============================================================================
// MAIN DASHBOARD LAYOUT
// ============================================================================

export function DashboardLayout() {
  const pathname = usePathname()

  // Responsive breakpoints
  const isDesktop = useIsDesktop()   // >= 1024px
  const isTablet = useIsTablet()     // >= 768px
  const isMobile = !isTablet         // < 768px

  // Store state
  const isVaultCollapsed = useVaultStore((s) => s.isCollapsed)
  const setVaultCollapsed = useVaultStore((s) => s.setCollapsed)
  const isExplorerMode = useVaultStore((s) => s.isExplorerMode)
  const toggleExplorerMode = useVaultStore((s) => s.toggleExplorerMode)
  const fetchPrivilege = usePrivilegeStore((s) => s.fetch)
  const gapSummary = useContentIntelligenceStore((s) => s.gapSummary)
  const fetchGapSummary = useContentIntelligenceStore((s) => s.fetchGapSummary)
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)

  // Rail state
  const [leftExpanded, setLeftExpanded] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('vault')
  const [rightExpanded, setRightExpanded] = useState(false)
  const [rightTab, setRightTab] = useState<RightRailTab>('studio')
  const mercuryEnabled = isMercuryEnabled()
  const { hasMercury } = useMercuryEntitlement()
  const [mercuryOpen, setMercuryOpen] = useState(false)
  const [mercuryWidth, setMercuryWidth] = useState(() => {
    if (typeof window === 'undefined') return 400
    const stored = localStorage.getItem('mercury-panel-width')
    return stored ? Math.max(320, Math.min(Number(stored), window.innerWidth * 0.5)) : 400
  })
  const mercuryDragRef = useRef(false)
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)

  // Mobile overlay state
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)
  const [mobileRightOpen, setMobileRightOpen] = useState(false)
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('chat')

  // Onboarding wizard state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardingChecked = useRef(false)

  useEffect(() => {
    if (onboardingChecked.current) return
    onboardingChecked.current = true

    // Skip onboarding entirely if user has completed it before (localStorage flag)
    try {
      if (localStorage.getItem('ragbox-onboarding-done') === '1') return
    } catch { /* SSR / private browsing */ }

    apiFetch('/api/user/onboarding')
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success && data.onboardingCompleted) {
          // Already onboarded — persist locally so we never re-check
          try { localStorage.setItem('ragbox-onboarding-done', '1') } catch { /* */ }
          return
        }

        // Double-check: if user has documents, they're clearly not new
        try {
          const docsRes = await apiFetch('/api/documents/folders')
          if (docsRes.ok) {
            const docsData = await docsRes.json()
            const hasDocs = docsData.data?.length > 0 || Object.keys(docsData.data || {}).length > 0
            if (hasDocs) {
              // Existing user — mark as onboarded and skip wizard
              try { localStorage.setItem('ragbox-onboarding-done', '1') } catch { /* */ }
              apiFetch('/api/user/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: true }),
              }).catch(() => { /* best-effort */ })
              return
            }
          }
        } catch { /* fall through to show wizard */ }

        if (data.success && !data.onboardingCompleted) setShowOnboarding(true)
      })
      .catch(() => { /* silently skip — don't block dashboard */ })
  }, [])

  // Close mobile overlays when transitioning to tablet/desktop
  useEffect(() => {
    if (isTablet) {
      setMobileLeftOpen(false)
      setMobileRightOpen(false)
    }
  }, [isTablet])

  // On tablet (not desktop), force panels collapsed — icon-only rails
  useEffect(() => {
    if (isTablet && !isDesktop) {
      setLeftExpanded(false)
      setRightExpanded(false)
    }
  }, [isTablet, isDesktop])

  // Sync with vault store
  useEffect(() => {
    setLeftExpanded(!isVaultCollapsed)
  }, [isVaultCollapsed])

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

  useEffect(() => {
    fetchGapSummary()
  }, [fetchGapSummary])

  // Mobile bottom tab handler
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    setMobileActiveTab(tab)
    setMobileLeftOpen(false)
    setMobileRightOpen(false)

    switch (tab) {
      case 'chat':
        // Already the default view — close overlays
        break
      case 'vault':
        setLeftTab('vault')
        setMobileLeftOpen(true)
        break
      case 'mercury':
        setRightTab('mercury')
        setMobileRightOpen(true)
        break
      case 'tools':
        setRightTab('studio')
        setMobileRightOpen(true)
        break
    }
  }, [])

  // Handlers
  const handleLeftTabClick = useCallback((tab: LeftRailTab) => {
    // On tablet (not desktop), open as mobile overlay instead of inline expansion
    if (isTablet && !isDesktop) {
      setLeftTab(tab)
      setMobileLeftOpen(true)
      return
    }

    if (leftExpanded && leftTab === tab) {
      setLeftExpanded(false)
      setVaultCollapsed(true)
    } else {
      setLeftTab(tab)
      setLeftExpanded(true)
      setVaultCollapsed(false)
    }
  }, [isTablet, isDesktop, leftExpanded, leftTab, setVaultCollapsed])

  const handleRightTabClick = useCallback((tab: RightRailTab) => {
    // Mercury has its own dedicated panel on desktop — skip tool panel logic
    if (tab === 'mercury') {
      if (isTablet && !isDesktop) {
        setRightTab('mercury')
        setMobileRightOpen(true)
      }
      // On desktop, Mercury is handled by handleMercuryToggle
      return
    }

    // On tablet (not desktop), open as mobile overlay instead of inline expansion
    if (isTablet && !isDesktop) {
      setRightTab(tab)
      setMobileRightOpen(true)
      return
    }

    if (rightExpanded && rightTab === tab) {
      setRightExpanded(false)
    } else {
      setRightTab(tab)
      setRightExpanded(true)
    }
  }, [isTablet, isDesktop, rightExpanded, rightTab])


  const handleIngestionUpload = async (files: File[]) => {
    await uploadDocuments(files)
    setIsIngestionOpen(false)
  }

  const handleIngestionUrl = async (url: string) => {
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scrape failed' }))
        const { toast } = await import('sonner')
        toast.error(err.error || `Failed to scrape URL (${res.status})`)
        return
      }
      const data = await res.json()
      if (!data.content || data.content.length < 10) {
        const { toast } = await import('sonner')
        toast.error('No meaningful content found at that URL.')
        return
      }
      let domain = 'web-content'
      try { domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname } catch { /* */ }
      const blob = new Blob([data.content], { type: 'text/plain' })
      const file = new File([blob], `${domain}-${Date.now()}.txt`, { type: 'text/plain' })
      await uploadDocuments([file])
      setIsIngestionOpen(false)
    } catch {
      const { toast } = await import('sonner')
      toast.error('Failed to scrape URL. Please try again.')
    }
  }

  const handleIngestionText = async (text: string) => {
    const blob = new Blob([text], { type: 'text/plain' })
    const file = new File([blob], `pasted-text-${Date.now()}.txt`, { type: 'text/plain' })
    await uploadDocuments([file])
    setIsIngestionOpen(false)
  }

  // Sidebar navigation — maps sidebar item clicks to panel toggles
  const handleSidebarNavigate = useCallback((itemId: string) => {
    if (isMobile) {
      setMobileLeftOpen(false)
    }

    switch (itemId) {
      case 'box':
        handleLeftTabClick('vault')
        break
      case 'audit':
        if (isMobile) {
          setRightTab('audit')
          setMobileRightOpen(true)
        } else {
          handleRightTabClick('audit')
        }
        break
    }
  }, [isMobile, handleLeftTabClick, handleRightTabClick])

  // Active panel for Sidebar highlight
  const sidebarActivePanel = useMemo(() => {
    if (pathname?.startsWith('/dashboard/agents')) return null // agent uses pathname
    if (rightExpanded && rightTab === 'audit') return 'audit'
    return 'box'
  }, [pathname, rightExpanded, rightTab])

  // Auto-open panel from URL query param (e.g., /dashboard?panel=audit)
  const didAutoOpenPanel = useRef(false)
  useEffect(() => {
    if (didAutoOpenPanel.current) return
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel')
    if (panel) {
      didAutoOpenPanel.current = true
      if (panel === 'audit') handleRightTabClick('audit')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [handleRightTabClick])

  // Mercury toggle
  const handleMercuryToggle = useCallback(() => {
    setMercuryOpen((prev) => !prev)
  }, [])

  // Mercury resize drag handler
  const handleMercuryDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    mercuryDragRef.current = true
    const startX = e.clientX
    const startWidth = mercuryWidth
    const maxWidth = Math.floor(window.innerWidth * 0.5)

    const onMouseMove = (ev: MouseEvent) => {
      if (!mercuryDragRef.current) return
      // Dragging left edge: moving left increases width
      const delta = startX - ev.clientX
      const newWidth = Math.max(320, Math.min(startWidth + delta, maxWidth))
      setMercuryWidth(newWidth)
    }

    const onMouseUp = () => {
      mercuryDragRef.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist final width
      setMercuryWidth((w) => {
        localStorage.setItem('mercury-panel-width', String(w))
        return w
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [mercuryWidth])

  // Widths
  const RAIL_WIDTH = 64
  const LEFT_PANEL_WIDTH = 420
  const RIGHT_PANEL_WIDTH = 380
  const MERCURY_PANEL_WIDTH = mercuryWidth

  // Render left panel content based on tab
  const renderLeftContent = () => {
    switch (leftTab) {
      case 'vault':
        return <VaultPanel />
      case 'recent':
        return <RecentFilesPanel />
      case 'starred':
        return <StarredPanel />
      default:
        return null
    }
  }

  // Render right tool panel content (Studio/Audit/Export — overlays center)
  const renderToolContent = () => {
    switch (rightTab) {
      case 'studio':
        return <SovereignStudio />
      case 'audit':
        return <AuditPanel />
      case 'export':
        return <ExportPanel />
      default:
        return null
    }
  }

  // Explorer mode takes full width - The Sovereign Explorer
  if (isExplorerMode) {
    return (
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
        <GlobalHeader />
        <div className="flex-1 overflow-hidden">
          <SovereignExplorer onClose={() => useVaultStore.getState().exitExplorerMode()} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
      <GlobalHeader />

      {/* Mobile toolbar — hamburger + tools buttons (visible < 768px) */}
      {isMobile && (
        <MobileToolbar
          onLeftOpen={() => { setMobileActiveTab('vault'); setMobileLeftOpen(true) }}
          onRightOpen={() => { setMobileActiveTab('tools'); setMobileRightOpen(true) }}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ============================================ */}
        {/* LEFT SIDE: Sidebar + Vault Panel (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            <Sidebar
              onNavigate={handleSidebarNavigate}
              activePanelId={sidebarActivePanel}
            />
            {/* Expandable vault panel (desktop only) */}
            {isDesktop && (
              <motion.div
                initial={false}
                animate={{ width: leftExpanded ? LEFT_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-r border-[var(--border-subtle)]"
              >
                <div style={{ width: LEFT_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)]">
                  {renderLeftContent()}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* CENTER: Document Workspace + Tool Overlay */}
        {/* ============================================ */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <ChatErrorBoundary>
            <CenterChat />
          </ChatErrorBoundary>

          {/* Tool panel overlay (Studio/Audit/Export) slides over center */}
          {isDesktop && (
            <AnimatePresence>
              {rightExpanded && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute top-0 right-0 bottom-0 z-20 border-l border-[var(--border-subtle)]"
                  style={{ width: RIGHT_PANEL_WIDTH }}
                >
                  <div className="h-full bg-[var(--bg-secondary)]">
                    {renderToolContent()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* ============================================ */}
        {/* RIGHT SIDE: Mercury Panel + Rail (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            {/* Mercury — persistent right panel (desktop, paid feature) */}
            {isDesktop && mercuryEnabled && (
              <motion.div
                initial={false}
                animate={{ width: mercuryOpen ? MERCURY_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-l border-[var(--border-default)] relative"
              >
                {/* Drag handle — left edge resize grip */}
                {mercuryOpen && (
                  <div
                    onMouseDown={handleMercuryDragStart}
                    className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize group hover:bg-[var(--brand-blue)]/20 transition-colors"
                  >
                    <div className="absolute left-0.5 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-full bg-[var(--text-tertiary)] opacity-40 group-hover:opacity-80 transition-opacity" />
                  </div>
                )}
                <div style={{ width: MERCURY_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)] isolate">
                  {hasMercury ? <MercuryWindow /> : <MercuryUpgradeCard onUpgrade={() => { setMercuryOpen(false) }} />}
                </div>
              </motion.div>
            )}

            {/* Icon Rail */}
            <div style={{ width: RAIL_WIDTH }} className="shrink-0">
              <RightStealthRail
                isExpanded={isDesktop && rightExpanded}
                activeTab={isDesktop && rightExpanded ? rightTab : null}
                onTabClick={handleRightTabClick}
                onCollapse={() => setRightExpanded(false)}
                isMercuryOpen={mercuryEnabled && mercuryOpen}
                onMercuryToggle={mercuryEnabled ? handleMercuryToggle : undefined}
                mercuryEnabled={mercuryEnabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MOBILE OVERLAYS */}
      {/* ============================================ */}

      {/* Left overlay: navigation + panel content */}
      <MobileOverlay
        isOpen={mobileLeftOpen}
        onClose={() => setMobileLeftOpen(false)}
        side="left"
      >
        {isMobile ? (
          /* Mobile: show Sidebar + vault panel content */
          <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
            <div className="shrink-0 border-b border-[var(--border-subtle)]">
              <Sidebar
                onNavigate={handleSidebarNavigate}
                activePanelId={sidebarActivePanel}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {renderLeftContent()}
            </div>
          </div>
        ) : (
          /* Tablet: Sidebar is visible inline, show vault panel content */
          <div className="h-full bg-[var(--bg-secondary)]">
            {renderLeftContent()}
          </div>
        )}
      </MobileOverlay>

      {/* Right overlay: Mercury or tool panel (mobile/tablet) */}
      <MobileOverlay
        isOpen={mobileRightOpen}
        onClose={() => setMobileRightOpen(false)}
        side="right"
      >
        <div className="flex h-full">
          {/* Panel content — Mercury if mercury tab, else tool panel */}
          <div className="flex-1 min-w-0 bg-[var(--bg-secondary)]">
            {rightTab === 'mercury' && mercuryEnabled ? (hasMercury ? <MercuryWindow /> : <MercuryUpgradeCard onUpgrade={() => setMobileRightOpen(false)} />) : renderToolContent()}
          </div>

          {/* Rail icons */}
          <div style={{ width: RAIL_WIDTH }} className="shrink-0">
            <RightStealthRail
              isExpanded={true}
              activeTab={rightTab}
              onTabClick={(tab) => {
                setRightTab(tab)
              }}
              onCollapse={() => setMobileRightOpen(false)}
              isMercuryOpen={mercuryEnabled && rightTab === 'mercury'}
              onMercuryToggle={mercuryEnabled ? () => setRightTab('mercury') : undefined}
              mercuryEnabled={mercuryEnabled}
            />
          </div>
        </div>
      </MobileOverlay>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
        onUrlSubmit={handleIngestionUrl}
        onTextPaste={handleIngestionText}
      />

      {/* Onboarding Wizard — first-run only */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard onComplete={() => {
            setShowOnboarding(false)
            try { localStorage.setItem('ragbox-onboarding-done', '1') } catch { /* */ }
          }} />
        )}
      </AnimatePresence>

      {/* Post-checkout wizard — triggered by ?checkout=success */}
      <PostCheckoutWizard />

      {/* Mobile bottom tab navigation */}
      {isMobile && (
        <MobileBottomNav
          activeTab={mobileActiveTab}
          onTabChange={handleMobileTabChange}
        />
      )}

    </div>
  )
}
