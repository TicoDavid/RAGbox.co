"use client";

import React, { useState } from 'react';
import type { Vault, VaultStatus } from '../types';
import { LockIcon, UnlockIcon, MenuIcon, PlusIcon } from './Icons';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTooltips } from '../context/TooltipContext';
import { TOOLTIPS } from '../constants/tooltips';
import TierBadge from '@/components/ui/TierBadge';

// Import Icon
const ImportIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

interface VaultPanelProps {
  vaults: Vault[];
  onVaultClick: (id: string) => void;
  onSourceDrop: (vaultId: string, sourceIds: number[]) => void;
  onCreateVault: () => void;
  onImportClick?: () => void;
}

// Traffic Light Protocol Colors
const STATUS_COLORS: Record<VaultStatus, string> = {
  secure: '#DC2626',  // Crimson Red - Armed, Fortified, No Entry
  open: '#0000FF',    // Electric Blue - Online, Ready, Working
  closed: '#71717A',  // Zinc Grey - Offline, Cold Storage, Inactive
};

// Sovereign Vault Door Icon
const VaultDoorIcon: React.FC<{ status: VaultStatus }> = ({ status }) => {
  const color = STATUS_COLORS[status];
  const isActive = status === 'open';
  // Disable animation for closed vaults (cold storage)
  const showAnimation = status !== 'closed';

  return (
    <svg
      className={`vault-door-icon ${isActive ? 'active' : 'inactive'}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vault door frame */}
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Inner vault door */}
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="1"
        stroke={color}
        strokeWidth="1"
        fill={`${color}15`}
      />
      {/* Central lock mechanism */}
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth="1.5"
        fill={`${color}20`}
      />
      {/* Lock handle/spokes */}
      <line x1="12" y1="9" x2="12" y2="6" stroke={color} strokeWidth="1" />
      <line x1="12" y1="18" x2="12" y2="15" stroke={color} strokeWidth="1" />
      <line x1="9" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1" />
      <line x1="18" y1="12" x2="15" y2="12" stroke={color} strokeWidth="1" />
      {/* Glow effect - disabled for closed (cold storage) vaults */}
      <circle cx="12" cy="12" r="2" fill={color} opacity={showAnimation ? 0.6 : 0.3}>
        {showAnimation && (
          <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
};

// Empty State Vault Icon
const EmptyVaultIcon = () => (
  <svg
    className="empty-vault-icon"
    width="80"
    height="80"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer frame */}
    <rect x="10" y="10" width="60" height="60" rx="8" stroke="#0000FF" strokeWidth="2" fill="none" opacity="0.3" />
    {/* Inner door */}
    <rect x="18" y="18" width="44" height="44" rx="4" stroke="#0000FF" strokeWidth="1.5" fill="rgba(0,0,255,0.05)" />
    {/* Lock mechanism */}
    <circle cx="40" cy="40" r="12" stroke="#0000FF" strokeWidth="2" fill="rgba(0,0,255,0.1)">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
    </circle>
    {/* Lock spokes */}
    <line x1="40" y1="28" x2="40" y2="18" stroke="#0000FF" strokeWidth="1.5" opacity="0.5" />
    <line x1="40" y1="62" x2="40" y2="52" stroke="#0000FF" strokeWidth="1.5" opacity="0.5" />
    <line x1="28" y1="40" x2="18" y2="40" stroke="#0000FF" strokeWidth="1.5" opacity="0.5" />
    <line x1="62" y1="40" x2="52" y2="40" stroke="#0000FF" strokeWidth="1.5" opacity="0.5" />
    {/* Central keyhole */}
    <circle cx="40" cy="40" r="5" fill="#0000FF" opacity="0.6">
      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

// Lock Status Icon - Traffic Light Protocol
const LockStatusIcon: React.FC<{ status: VaultStatus; isAnimating?: boolean }> = ({ status, isAnimating }) => {
  const color = STATUS_COLORS[status];
  const isLocked = status !== 'open';
  const fillOpacity = status === 'secure' ? '0.15' : status === 'closed' ? '0.1' : '0.1';

  return (
    <div className={`lock-status-container status-${status} ${isAnimating ? 'animating' : ''}`}>
      {!isLocked ? (
        <svg className="lock-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Unlocked padlock */}
          <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}${fillOpacity}`} />
          <path d="M8 11V7a4 4 0 0 1 8 0" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.5" fill={color} />
        </svg>
      ) : (
        <svg className="lock-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Locked padlock */}
          <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}${fillOpacity}`} />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="16" r="1.5" fill={color} />
        </svg>
      )}
    </div>
  );
};

const VaultPanel: React.FC<VaultPanelProps> = ({
  vaults,
  onVaultClick,
  onSourceDrop,
  onCreateVault,
  onImportClick
}) => {
  const { tooltipsEnabled } = useTooltips();
  const [dragOverVaultId, setDragOverVaultId] = useState<string | null>(null);
  const [clickedVaultId, setClickedVaultId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, vault: Vault) => {
    e.preventDefault();
    if (vault.status === 'open') {
      setDragOverVaultId(vault.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverVaultId(null);
  };

  const handleDrop = (e: React.DragEvent, vault: Vault) => {
    e.preventDefault();
    setDragOverVaultId(null);
    if (vault.status === 'open') {
      try {
        const data = e.dataTransfer.getData("application/json");
        if (data) {
          const sources = JSON.parse(data);
          if (Array.isArray(sources) && sources.length > 0) {
            const ids = sources.map((s: { id: number }) => s.id);
            onSourceDrop(vault.id, ids);
          }
        }
      } catch (err) {
        // ignored
      }
    }
  };

  const handleVaultClick = (vaultId: string) => {
    setClickedVaultId(vaultId);
    // Reset animation state after animation completes
    setTimeout(() => setClickedVaultId(null), 600);
    onVaultClick(vaultId);
  };

  return (
    <div className="panel vault-panel sovereign-vault-panel">
      {/* Circuit board background */}
      <div className="vault-circuit-bg" aria-hidden="true" />

      <div className="panel-header vault-header">
        <h3 className="panel-title">The Vault</h3>
        <div className="vault-header-actions">
          {onImportClick && (
            <Tooltip content="Import files to vault" enabled={tooltipsEnabled} position="left">
              <button
                className="icon-btn import-btn"
                onClick={onImportClick}
                aria-label="Import files"
              >
                <ImportIcon />
              </button>
            </Tooltip>
          )}
          <button className="icon-btn" aria-label="Vault menu"><MenuIcon /></button>
        </div>
      </div>

      <div className="vault-content">
        {/* Master Key Button */}
        <Tooltip content={TOOLTIPS.initializeVault} enabled={tooltipsEnabled} position="right">
          <button className="create-vault-btn" onClick={onCreateVault} aria-label="Initialize new vault">
            <div className="create-vault-glow" aria-hidden="true" />
            <PlusIcon />
            <span>Initialize Vault</span>
            <div className="create-vault-shine" aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Vault Items */}
        <div className="vault-items-container">
          {/* Legal Starter Vault — Premium Card */}
          <div
            className="vault-module open legal-starter-vault"
            onClick={() => {
              const starter = vaults.find(v => v.name.toLowerCase().includes('legal') || v.name.toLowerCase().includes('starter'))
              if (starter) onVaultClick(starter.id)
            }}
            role="button"
            tabIndex={0}
            aria-label="Explore Legal Starter Vault — 8 sample documents, pre-configured for legal professionals"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                const starter = vaults.find(v => v.name.toLowerCase().includes('legal') || v.name.toLowerCase().includes('starter'))
                if (starter) onVaultClick(starter.id)
              }
            }}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Gold "LEGAL" badge */}
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              zIndex: 2,
            }}>
              LEGAL
            </div>

            {/* Shield icon as status indicator */}
            <div className="vault-status-indicator">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Vault info */}
            <div className="vault-module-info">
              <div className="vault-module-name" style={{ color: 'var(--text-primary)' }}>Legal Starter Vault</div>
              <div className="vault-module-meta">
                <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                  Pre-configured for legal professionals. 8 sample documents included.
                </span>
              </div>
              {/* Prompt suggestion chips */}
              <div style={{
                display: 'flex',
                gap: '6px',
                marginTop: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
              }}>
                {[
                  'Termination conditions',
                  'Payment terms',
                  'Governing jurisdiction',
                  'Indemnification clauses',
                  'Confidentiality obligations',
                ].map((prompt) => (
                  <span
                    key={prompt}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      color: '#d4a041',
                      fontSize: '10px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {prompt}
                  </span>
                ))}
              </div>
            </div>

            {/* Metallic highlight */}
            <div className="vault-module-shine" aria-hidden="true" />
          </div>

          {vaults.map(vault => (
            <div
              key={vault.id}
              className={`vault-module ${vault.status} ${dragOverVaultId === vault.id ? 'drag-target' : ''} ${clickedVaultId === vault.id ? 'clicked' : ''}`}
              onClick={() => handleVaultClick(vault.id)}
              onDragOver={(e) => handleDragOver(e, vault)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, vault)}
              role="button"
              tabIndex={0}
              aria-label={`Open vault: ${vault.name}, ${vault.documentCount} documents, status: ${vault.status}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVaultClick(vault.id) } }}
            >
              {/* Left status indicator */}
              <div className="vault-status-indicator">
                <VaultDoorIcon status={vault.status} />
              </div>

              {/* Vault info */}
              <div className="vault-module-info">
                <div className="vault-module-name">{vault.name}</div>
                <div className="vault-module-meta">
                  <span>{vault.documentCount} {vault.documentCount === 1 ? 'document' : 'documents'}</span>
                  <TierBadge
                    tier={vault.status === 'secure' ? 3 : vault.status === 'closed' ? 2 : 1}
                    size="sm"
                  />
                </div>
              </div>

              {/* Right lock icon */}
              <LockStatusIcon status={vault.status} isAnimating={clickedVaultId === vault.id} />

              {/* Metallic highlight */}
              <div className="vault-module-shine" aria-hidden="true" />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {vaults.length === 0 && (
          <div className="vault-empty-state">
            <EmptyVaultIcon />
            <h4 className="vault-empty-title">NO VAULT INITIALIZED</h4>
            <p className="vault-empty-subtitle">
              Initialize a new sovereign container above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultPanel;
