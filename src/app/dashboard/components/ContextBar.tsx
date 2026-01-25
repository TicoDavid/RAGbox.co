"use client";

import React, { useState } from 'react';
import type { Vault, Source } from '../types';
import { ChevronDownIcon } from './Icons';

interface ContextBarProps {
  vaults: Vault[];
  sources: Source[];
}

const ContextBar: React.FC<ContextBarProps> = ({ vaults, sources }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const openVaults = vaults.filter(v => v.status === 'open');
  const hasContext = openVaults.length > 0 || sources.length > 0;

  return (
    <div className={`context-bar ${hasContext ? 'active' : ''}`}>
      <div
        className="context-header"
        onClick={() => hasContext && setIsExpanded(!isExpanded)}
      >
        <span className="context-label">
          {hasContext ? 'Active Context' : 'Active Context: No verified sources selected'}
        </span>
        {hasContext && (
          <div className="context-summary">
            {openVaults.length > 0 && <span>{openVaults.length} Vaults</span>}
            {openVaults.length > 0 && sources.length > 0 && <span className="separator">•</span>}
            {sources.length > 0 && <span>{sources.length} Sources</span>}
            <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
              <ChevronDownIcon />
            </span>
          </div>
        )}
      </div>
      {hasContext && isExpanded && (
        <div className="context-details">
          {openVaults.map(v => (
            <div key={v.id} className="context-item vault">
              <span className="dot"></span> {v.name}
            </div>
          ))}
          {sources.map(s => (
            <div key={s.id} className="context-item source">
              <span className="dot"></span> {s.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContextBar;
