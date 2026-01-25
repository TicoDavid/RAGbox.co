/**
 * Contextual Help Tooltips for RAGbox Dashboard
 * Whispered guidance for business users
 */

export const TOOLTIPS = {
  // ============================================
  // SECURE VAULTS (Left Panel)
  // ============================================
  initializeVault: 'Create a new secure container to organize documents',
  vaultLock: 'Lock vault to exclude from Mercury queries (AEGIS protection)',
  vaultUnlock: 'Unlock vault to include in Mercury queries',
  vaultName: 'Click to rename this vault',
  vaultDelete: 'Remove vault and all its contents',
  vaultStatus: 'Current vault security status',
  vaultOpen: 'Vault is OPEN - documents included in queries',
  vaultSecure: 'Vault is SECURE - documents protected from queries',
  vaultClosed: 'Vault is CLOSED - archived, not queryable',

  // ============================================
  // SECURITY DROP (Second Column)
  // ============================================
  securityDrop: 'Drop files here to ingest into RAGbox',
  securityDropEmpty: 'Drag and drop files to begin document analysis',
  fileItem: 'Drag to a vault to organize, or leave here for immediate access',
  fileTypeIcon: 'Document type indicator',
  fileRemove: 'Remove file from Security Drop',
  fileDragToVault: 'Drag this file to a vault to organize it',
  contextCount: 'Number of documents available for Mercury queries',

  // ============================================
  // MERCURY (Center Panel)
  // ============================================
  mercuryInput: 'Ask questions about your documents in natural language',
  mercuryInputEmpty: 'Type your question or use voice input',
  voiceButton: 'Click to speak your query (releases to process)',
  voiceButtonActive: 'Listening... Release to process your query',
  sovereignBadge: 'All queries processed in your sovereign environment',
  confidenceScore: 'AI certainty level - below 85% triggers Silence Protocol',
  silenceProtocol: 'Response withheld due to low confidence - add more context',
  citation: 'Click to view source document passage',
  showLog: 'View technical audit trail of all operations',
  hideLog: 'Hide the system audit log',
  sendMessage: 'Send your query to Mercury',
  clearChat: 'Clear conversation history',
  mercuryContext: 'Documents currently available for queries',

  // ============================================
  // INSIGHT BLOCKS (In Mercury responses)
  // ============================================
  insightTrend: 'Data trend detected - click to visualize',
  insightRisk: 'Risk assessment identified - click for detailed report',
  insightClause: 'Key clause found - click to highlight in source',
  insightRecommendation: 'Actionable recommendation detected',
  insightAction: 'Send this insight to the Forge for artifact generation',

  // ============================================
  // FORGE (Right Panel)
  // ============================================
  forgePanel: 'Generate artifacts from your document insights',
  forgeEmpty: 'Click a module below or send an insight from Mercury',
  secureVideoBriefing: 'Create executive video summary from vault data',
  strategicDataViz: 'Generate charts and visual analytics from your data',
  visionToCode: 'Convert diagrams and mockups to compliance-ready components',
  brandedAssets: 'Generate secure branded materials and documents',
  complianceDashboard: 'Build audit-ready reporting interfaces',
  customQuery: 'Execute complex multi-modal Gemini operations',
  artifactCard: 'Generated artifact - click to expand',
  artifactDelete: 'Remove this artifact',
  artifactExport: 'Export artifact as file',

  // ============================================
  // HEADER
  // ============================================
  protocolSwitcher: 'Change response mode: Standard, Legal, or Executive',
  protocolStandard: 'Balanced analysis with clear citations',
  protocolLegal: 'Risk-averse legal analysis with statute references',
  protocolExecutive: 'Brief, bottom-line-up-front executive summaries',
  protocolAnalyst: 'Deep research with multiple perspectives',
  settings: 'Configure RAGbox preferences and integrations',
  helpToggle: 'Show/hide instructional tooltips',
  helpEnabled: 'Tooltips are ON - hover for guidance',
  helpDisabled: 'Tooltips are OFF - click to enable',
  themeToggle: 'Switch between dark and light mode',
  userAvatar: 'Your account settings and sign out',
  globalSearch: 'Search across all vaults and documents',

  // ============================================
  // ACTIONS (Response buttons)
  // ============================================
  copyResponse: 'Copy response text to clipboard',
  expandResponse: 'View full response in expanded mode',
  exportResponse: 'Export response as PDF or DOCX',
  regenerateResponse: 'Ask Mercury to regenerate this response',

  // ============================================
  // AUDIT LOG
  // ============================================
  auditLog: 'Immutable record of all system operations',
  auditTimestamp: 'When this operation occurred',
  auditEvent: 'Type of operation performed',
  auditCollapse: 'Collapse audit log to save space',
  auditExpand: 'Expand audit log to view details',

  // ============================================
  // MODALS & DIALOGS
  // ============================================
  modalClose: 'Close this dialog',
  confirmAction: 'Confirm this action',
  cancelAction: 'Cancel and go back',
} as const;

export type TooltipKey = keyof typeof TOOLTIPS;

/**
 * Get tooltip content by key with fallback
 */
export function getTooltip(key: TooltipKey): string {
  return TOOLTIPS[key] || '';
}
