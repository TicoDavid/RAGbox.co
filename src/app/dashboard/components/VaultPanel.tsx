"use client";

import React, { useState } from 'react';
import type { Vault, VaultStatus } from '../types';
import { FolderIcon, LockIcon, UnlockIcon, MenuIcon, PlusIcon } from './Icons';

interface VaultPanelProps {
  vaults: Vault[];
  onVaultClick: (id: string) => void;
  onSourceDrop: (vaultId: string, sourceIds: number[]) => void;
  onCreateVault: () => void;
}

const VaultPanel: React.FC<VaultPanelProps> = ({
  vaults,
  onVaultClick,
  onSourceDrop,
  onCreateVault
}) => {
  const [dragOverVaultId, setDragOverVaultId] = useState<string | null>(null);

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
        console.error("Drop failed", err);
      }
    }
  };

  const getStatusIcon = (status: VaultStatus) => {
    switch (status) {
      case 'open':
        return <UnlockIcon />;
      case 'secure':
      case 'closed':
      default:
        return <LockIcon />;
    }
  };

  return (
    <div className="panel vault-panel">
      <div className="panel-header">
        <h3>Vault Console</h3>
        <button className="icon-btn"><MenuIcon /></button>
      </div>
      <div className="vault-content">
        <button className="add-source-btn" onClick={onCreateVault}>
          <PlusIcon /> Create Vault
        </button>
        {vaults.map(vault => (
          <div
            key={vault.id}
            className={`vault-item ${dragOverVaultId === vault.id ? 'drag-target' : ''}`}
            onClick={() => onVaultClick(vault.id)}
            onDragOver={(e) => handleDragOver(e, vault)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, vault)}
          >
            <div className="vault-info">
              <div className="vault-icon"><FolderIcon /></div>
              <div className="vault-name">{vault.name}</div>
            </div>
            <div className={`vault-status-icon ${vault.status}`}>
              {getStatusIcon(vault.status)}
            </div>
          </div>
        ))}
        {vaults.length === 0 && (
          <div className="empty-filter">System Empty. Initialize new vault.</div>
        )}
      </div>
    </div>
  );
};

export default VaultPanel;
