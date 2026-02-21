"use client";

import React, { useState } from 'react';
import type { Vault } from '../types';
import { ArchiveIcon, FolderIcon, LockIcon, UnlockIcon } from './Icons';

interface SaveToVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaults: Vault[];
  onSave: (vaultId: string) => void;
}

const SaveToVaultModal: React.FC<SaveToVaultModalProps> = ({
  isOpen,
  onClose,
  vaults,
  onSave
}) => {
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="security-modal-overlay" onClick={onClose}>
      <div className="security-modal" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
        <div className="security-header">
          <div className="security-shield" style={{ color: 'var(--brand-blue)' }}><ArchiveIcon /></div>
          <h2>Save Session to Vault</h2>
          <p>Select an <strong>Open Vault</strong> to permit data ingress.</p>
        </div>

        <div className="vault-content" style={{
          maxHeight: '300px',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '8px',
          background: 'var(--bg-app)'
        }}>
          {vaults.map(vault => {
            const isLocked = vault.status !== 'open';
            return (
              <div
                key={vault.id}
                className={`vault-item ${selectedVaultId === vault.id ? 'drag-target' : ''}`}
                style={{
                  opacity: isLocked ? 0.5 : 1,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  marginBottom: '8px'
                }}
                onClick={() => !isLocked && setSelectedVaultId(vault.id)}
              >
                <div className="vault-info">
                  <div className="vault-icon"><FolderIcon /></div>
                  <div className="vault-name">{vault.name} {isLocked && "(LOCKED)"}</div>
                </div>
                <div className={`vault-status-icon ${vault.status}`}>
                  {isLocked ? <LockIcon /> : <UnlockIcon />}
                </div>
              </div>
            );
          })}
          {vaults.length === 0 && (
            <div style={{ padding: 10, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No vaults found. Create one first.
            </div>
          )}
        </div>

        <div className="security-form">
          <div className="security-button-group">
            <button
              className="security-action-btn security-btn-primary"
              disabled={!selectedVaultId}
              onClick={() => {
                if (selectedVaultId) {
                  onSave(selectedVaultId);
                  onClose();
                }
              }}
            >
              EXECUTE TRANSFER
            </button>
            <button
              className="security-action-btn security-btn-abort"
              onClick={onClose}
            >
              ABORT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveToVaultModal;
