"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { Vault, Source, SystemAuditEvent } from '../types';
import { ChevronDownIcon } from './Icons';

interface ContextBarProps {
  vaults: Vault[];
  sources: Source[];
  auditEvents: SystemAuditEvent[];
}

// Format timestamp for audit log
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// Get category color class
const getCategoryClass = (category: SystemAuditEvent['category']): string => {
  switch (category) {
    case 'SECURITY': return 'audit-category-security';
    case 'VAULT': return 'audit-category-vault';
    case 'INGEST': return 'audit-category-ingest';
    case 'TRANSFER': return 'audit-category-transfer';
    default: return 'audit-category-system';
  }
};

// Info icon for the collapsed state
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const ContextBar: React.FC<ContextBarProps> = ({ vaults = [], sources = [], auditEvents = [] }) => {
  // Default to collapsed - executives don't need to see plumbing unless they ask
  const [isExpanded, setIsExpanded] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const openVaults = vaults.filter(v => v.status === 'open');
  const lockedVaults = vaults.filter(v => v.status !== 'open');
  const hasContext = openVaults.length > 0 || sources.length > 0;
  const hasEvents = auditEvents.length > 0;
  const totalAccessible = sources.length + openVaults.length;

  // Auto-scroll to latest event when expanded
  useEffect(() => {
    if (isExpanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isExpanded, auditEvents.length]);

  return (
    <div className={`context-bar audit-log-bar ${hasContext ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed Header */}
      <div
        className="context-header audit-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="audit-header-left">
          <InfoIcon />
          <span className="context-label">
            Mercury Context: {sources.length} in Drop, {openVaults.length} Vault{openVaults.length !== 1 ? 's' : ''} Open
            {lockedVaults.length > 0 && <span className="context-locked-info"> ({lockedVaults.length} locked)</span>}
          </span>
        </div>
        <div className="audit-header-right">
          {hasEvents && (
            <span className="audit-event-count">{auditEvents.length} event{auditEvents.length !== 1 ? 's' : ''}</span>
          )}
          <span className="audit-toggle-hint">{isExpanded ? 'Hide Log' : 'Show Log'}</span>
          <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </div>

      {/* Expanded Audit Log Drawer */}
      {isExpanded && (
        <div className="audit-log-drawer">
          <div className="audit-log-header">
            <span className="audit-log-title">SYSTEM AUDIT LOG</span>
            <span className="audit-log-subtitle">Technical events & transfers</span>
          </div>
          <div className="audit-log-content">
            {auditEvents.length === 0 ? (
              <div className="audit-log-empty">
                No system events recorded yet.
              </div>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className={`audit-log-entry ${getCategoryClass(event.category)}`}>
                  <span className="audit-timestamp">[{formatTime(event.timestamp)}]</span>
                  <span className="audit-category">{event.category}:</span>
                  <span className="audit-message">{event.message}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextBar;
