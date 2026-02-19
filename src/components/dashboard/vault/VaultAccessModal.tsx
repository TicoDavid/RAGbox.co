'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Clock,
  UserPlus,
  ChevronDown,
  Trash2,
  AlertTriangle,
  FileText,
  MessageSquare,
  Settings,
  Link2,
  Lock,
  Globe,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ClearanceLevel = 'analyst' | 'blind_agent' | 'custodian';

export interface VaultMember {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  clearance: ClearanceLevel;
  addedAt: Date;
  addedBy: string;
}

export interface VaultAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultName: string;
  vaultId: string;
  currentMembers: VaultMember[];
  onGrantAccess: (email: string, clearance: ClearanceLevel) => Promise<void>;
  onRevokeClearance: (memberId: string) => Promise<void>;
  onUpdateClearance: (memberId: string, newClearance: ClearanceLevel) => Promise<void>;
  onGenerateLink: (expiration: LinkExpiration) => Promise<string>;
}

export type LinkExpiration = '1h' | '24h' | '7d' | 'burn';
export type LinkVisibility = 'restricted' | 'public';

// =============================================================================
// CLEARANCE DEFINITIONS
// =============================================================================

const CLEARANCE_LEVELS: Record<ClearanceLevel, {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  analyst: {
    label: 'Analyst',
    description: 'Chat + View Source Documents',
    icon: <Eye className="w-4 h-4" />,
    color: 'text-[var(--success)]',
    bgColor: 'bg-[var(--success)]/10',
    borderColor: 'border-[var(--success)]/30',
  },
  blind_agent: {
    label: 'Blind Agent',
    description: 'Chat ONLY — Sources Redacted',
    icon: <EyeOff className="w-4 h-4" />,
    color: 'text-[var(--warning)]',
    bgColor: 'bg-[var(--warning)]/10',
    borderColor: 'border-[var(--warning)]/30',
  },
  custodian: {
    label: 'Custodian',
    description: 'Full Edit/Delete Rights',
    icon: <Shield className="w-4 h-4" />,
    color: 'text-[var(--brand-blue)]',
    bgColor: 'bg-[var(--brand-blue)]/10',
    borderColor: 'border-[var(--brand-blue)]/30',
  },
};

const EXPIRATION_OPTIONS: Record<LinkExpiration, { label: string; description: string }> = {
  '1h': { label: '1 Hour', description: 'Self-destructs in 60 minutes' },
  '24h': { label: '24 Hours', description: 'Active until tomorrow' },
  '7d': { label: '7 Days', description: 'One week access window' },
  'burn': { label: 'Burn on Read', description: 'One-time view only' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VaultAccessModal({
  isOpen,
  onClose,
  vaultName,
  currentMembers,
  onGrantAccess,
  onRevokeClearance,
  onUpdateClearance,
  onGenerateLink,
}: VaultAccessModalProps) {
  // State
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedClearance, setSelectedClearance] = useState<ClearanceLevel>('analyst');
  const [isGranting, setIsGranting] = useState(false);
  const [showClearanceDropdown, setShowClearanceDropdown] = useState(false);

  // Security Controls
  const [enforceAudit, setEnforceAudit] = useState(true);
  const [allowExport, setAllowExport] = useState(false);

  // Link Settings
  const [linkVisibility, setLinkVisibility] = useState<LinkVisibility>('restricted');
  const [linkExpiration, setLinkExpiration] = useState<LinkExpiration>('24h');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Member being edited
  const [editingMember, setEditingMember] = useState<string | null>(null);

  // Handlers
  const handleGrantAccess = async () => {
    if (!inviteEmail.trim()) return;
    setIsGranting(true);
    try {
      await onGrantAccess(inviteEmail, selectedClearance);
      setInviteEmail('');
    } finally {
      setIsGranting(false);
    }
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const link = await onGenerateLink(linkExpiration);
      setGeneratedLink(link);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleRevoke = async (memberId: string) => {
    await onRevokeClearance(memberId);
  };

  const handleUpdateClearance = async (memberId: string, newClearance: ClearanceLevel) => {
    await onUpdateClearance(memberId, newClearance);
    setEditingMember(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl
                     bg-[var(--bg-primary)]/95 backdrop-blur-xl
                     border border-[var(--border-default)] border-t-[var(--border-strong)]
                     shadow-[0_0_60px_-10px_rgba(0,100,255,0.3)]"
        >
          {/* ================================================================= */}
          {/* HEADER */}
          {/* ================================================================= */}
          <div className="px-6 py-5 border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--brand-blue)]/5 to-transparent">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-blue)]/20 border border-[var(--brand-blue)]/30
                               flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[var(--brand-blue)]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                    Grant Vault Clearance
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    Configure access permissions for <span className="text-[var(--brand-blue)] font-medium">{vaultName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--bg-elevated)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* ================================================================= */}
            {/* USER INPUT SECTION */}
            {/* ================================================================= */}
            <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Issue New Clearance
              </label>

              <div className="flex gap-2">
                {/* Email Input */}
                <div className="flex-1 relative">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Add Secure ID or Email..."
                    className="w-full h-11 px-4 rounded-xl
                             bg-black/40 border border-[var(--border-default)]
                             text-[var(--text-primary)] placeholder-[var(--text-placeholder)]
                             focus:outline-none focus:border-[var(--brand-blue)]/50 focus:ring-1 focus:ring-[var(--brand-blue)]/30
                             transition-all"
                  />
                </div>

                {/* Clearance Level Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowClearanceDropdown(!showClearanceDropdown)}
                    className={`h-11 px-4 rounded-xl flex items-center gap-2
                              ${CLEARANCE_LEVELS[selectedClearance].bgColor}
                              ${CLEARANCE_LEVELS[selectedClearance].borderColor}
                              border ${CLEARANCE_LEVELS[selectedClearance].color}
                              hover:bg-opacity-20 transition-all min-w-[160px]`}
                  >
                    {CLEARANCE_LEVELS[selectedClearance].icon}
                    <span className="font-medium">{CLEARANCE_LEVELS[selectedClearance].label}</span>
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  </button>

                  <AnimatePresence>
                    {showClearanceDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full mt-2 right-0 w-72 rounded-xl
                                 bg-[var(--bg-primary)] border border-[var(--border-default)]
                                 shadow-xl z-50 overflow-hidden"
                      >
                        {(Object.entries(CLEARANCE_LEVELS) as [ClearanceLevel, typeof CLEARANCE_LEVELS[ClearanceLevel]][]).map(([key, level]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedClearance(key);
                              setShowClearanceDropdown(false);
                            }}
                            className={`w-full px-4 py-3 flex items-start gap-3 text-left
                                      hover:bg-[var(--bg-elevated)]/50 transition-colors
                                      ${selectedClearance === key ? 'bg-[var(--bg-elevated)]/30' : ''}`}
                          >
                            <div className={`mt-0.5 ${level.color}`}>
                              {level.icon}
                            </div>
                            <div>
                              <div className={`font-medium ${level.color} flex items-center gap-2`}>
                                {level.label}
                                {key === 'blind_agent' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--warning)]/20 text-[var(--warning)] font-bold uppercase">
                                    Featured
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                {level.description}
                              </div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Grant Button */}
                <button
                  onClick={handleGrantAccess}
                  disabled={!inviteEmail.trim() || isGranting}
                  className="h-11 px-5 rounded-xl bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)]
                           text-[var(--text-primary)] font-medium flex items-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Grant
                </button>
              </div>

              {/* Blind Agent Callout */}
              {selectedClearance === 'blind_agent' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20"
                >
                  <div className="flex items-start gap-2">
                    <EyeOff className="w-4 h-4 text-[var(--warning)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-[var(--warning)] font-medium">Blind Agent Mode</p>
                      <p className="text-xs text-[var(--warning)]/70 mt-1">
                        This user can query the AI and receive answers, but all source document citations
                        will display as <span className="font-mono text-[var(--warning)]">[REDACTED]</span>.
                        Perfect for consultants who need insights without file access.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ================================================================= */}
            {/* CHAIN OF CUSTODY */}
            {/* ================================================================= */}
            <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Chain of Custody
                </label>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {currentMembers.length} cleared personnel
                </span>
              </div>

              <div className="space-y-2">
                {currentMembers.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No external clearances granted</p>
                    <p className="text-xs mt-1">Only you have access to this vault</p>
                  </div>
                ) : (
                  currentMembers.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isEditing={editingMember === member.id}
                      onEdit={() => setEditingMember(member.id)}
                      onCancelEdit={() => setEditingMember(null)}
                      onUpdateClearance={(newClearance) => handleUpdateClearance(member.id, newClearance)}
                      onRevoke={() => handleRevoke(member.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* SECURITY CONTROLS */}
            {/* ================================================================= */}
            <div className="px-6 py-5 border-b border-[var(--border-subtle)]">
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Compliance & Restrictions
              </label>

              <div className="space-y-3">
                {/* Audit Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[var(--brand-blue)]" />
                    <div>
                      <p className="text-sm text-[var(--text-primary)] font-medium">Enforce Audit Logging</p>
                      <p className="text-xs text-[var(--text-tertiary)]">All user actions are tracked and timestamped</p>
                    </div>
                  </div>
                  <ToggleSwitch checked={enforceAudit} onChange={setEnforceAudit} />
                </div>

                {/* Export Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 ${allowExport ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'}`} />
                    <div>
                      <p className="text-sm text-[var(--text-primary)] font-medium">Allow File Export</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {allowExport
                          ? <span className="text-[var(--danger)]">Warning: Users can download source files</span>
                          : 'Users cannot download original documents'
                        }
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch checked={allowExport} onChange={setAllowExport} variant={allowExport ? 'danger' : 'default'} />
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* LINK SETTINGS */}
            {/* ================================================================= */}
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Secure Link Protocol
              </label>

              <div className="space-y-4">
                {/* Visibility Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setLinkVisibility('restricted')}
                    className={`flex-1 p-3 rounded-xl border transition-all flex items-center gap-3
                              ${linkVisibility === 'restricted'
                                ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 text-[var(--brand-blue)]'
                                : 'bg-black/20 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                              }`}
                  >
                    <Lock className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Restricted</p>
                      <p className="text-xs opacity-70">Cleared personnel only</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setLinkVisibility('public')}
                    className={`flex-1 p-3 rounded-xl border transition-all flex items-center gap-3
                              ${linkVisibility === 'public'
                                ? 'bg-[var(--warning)]/10 border-[var(--warning)]/30 text-[var(--warning)]'
                                : 'bg-black/20 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
                              }`}
                  >
                    <Globe className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Public Link</p>
                      <p className="text-xs opacity-70">Anyone with link</p>
                    </div>
                  </button>
                </div>

                {/* Time Bomb Selector (only for public links) */}
                <AnimatePresence>
                  {linkVisibility === 'public' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-4 h-4 text-[var(--warning)]" />
                          <span className="text-sm font-medium text-[var(--warning)]">Expiration Protocol</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(Object.entries(EXPIRATION_OPTIONS) as [LinkExpiration, typeof EXPIRATION_OPTIONS[LinkExpiration]][]).map(([key, option]) => (
                            <button
                              key={key}
                              onClick={() => setLinkExpiration(key)}
                              className={`p-2 rounded-lg border text-left transition-all
                                        ${linkExpiration === key
                                          ? 'bg-[var(--warning)]/20 border-[var(--warning)]/40 text-[var(--warning)]'
                                          : 'bg-black/20 border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--warning)]/20'
                                        }`}
                            >
                              <p className="text-sm font-medium">{option.label}</p>
                              <p className="text-xs opacity-70">{option.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generate / Copy Link */}
                {linkVisibility === 'public' && (
                  <div className="flex gap-2">
                    {generatedLink ? (
                      <>
                        <input
                          type="text"
                          value={generatedLink}
                          readOnly
                          className="flex-1 h-11 px-4 rounded-xl bg-black/40 border border-[var(--border-default)]
                                   text-[var(--text-secondary)] font-mono text-sm"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="h-11 px-5 rounded-xl bg-[var(--success)] hover:bg-[var(--success)]
                                   text-[var(--text-primary)] font-medium flex items-center gap-2 transition-colors"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Secure Key
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleGenerateLink}
                        disabled={isGeneratingLink}
                        className="w-full h-11 px-5 rounded-xl bg-[var(--warning)] hover:bg-[var(--warning)]
                                 text-[var(--text-primary)] font-medium flex items-center justify-center gap-2
                                 disabled:opacity-50 transition-colors"
                      >
                        <Link2 className="w-4 h-4" />
                        {isGeneratingLink ? 'Generating...' : 'Generate Secure Key'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* FOOTER */}
          {/* ================================================================= */}
          <div className="px-6 py-4 border-t border-[var(--border-default)] bg-black/20 flex items-center justify-between">
            <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              All access changes are logged to the audit trail
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]
                       text-[var(--text-primary)] font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MemberRowProps {
  member: VaultMember;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdateClearance: (clearance: ClearanceLevel) => void;
  onRevoke: () => void;
}

function MemberAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const initial = name.charAt(0).toUpperCase();

  if (avatar && !imgFailed) {
    return (
      <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] font-medium overflow-hidden">
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] font-medium">
      {initial}
    </div>
  );
}

function MemberRow({ member, isEditing, onEdit, onCancelEdit, onUpdateClearance, onRevoke }: MemberRowProps) {
  const level = CLEARANCE_LEVELS[member.clearance];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
      {/* Avatar with fallback to initials */}
      <MemberAvatar name={member.name} avatar={member.avatar} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{member.name}</p>
        <p className="text-xs text-[var(--text-tertiary)] truncate">{member.email}</p>
      </div>

      {/* Clearance Badge / Editor */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          {(Object.entries(CLEARANCE_LEVELS) as [ClearanceLevel, typeof CLEARANCE_LEVELS[ClearanceLevel]][]).map(([key, lvl]) => (
            <button
              key={key}
              onClick={() => onUpdateClearance(key)}
              className={`p-2 rounded-lg border transition-all
                        ${member.clearance === key
                          ? `${lvl.bgColor} ${lvl.borderColor} ${lvl.color}`
                          : 'bg-black/20 border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--border-default)]'
                        }`}
              title={lvl.label}
            >
              {lvl.icon}
            </button>
          ))}
          <button
            onClick={onCancelEdit}
            className="p-2 rounded-lg bg-black/20 border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5
                      ${level.bgColor} ${level.borderColor} ${level.color} border
                      hover:opacity-80 transition-opacity`}
          >
            {level.icon}
            {level.label}
          </button>

          <button
            onClick={onRevoke}
            className="p-2 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
            title="Revoke Clearance"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'default' | 'danger';
}

function ToggleSwitch({ checked, onChange, variant = 'default' }: ToggleSwitchProps) {
  const activeColor = variant === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--brand-blue)]';

  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors
                ${checked ? activeColor : 'bg-[var(--bg-elevated)]'}`}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
        animate={{ left: checked ? '28px' : '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

export default VaultAccessModal;
