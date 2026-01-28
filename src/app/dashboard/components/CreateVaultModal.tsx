"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FolderIcon } from './Icons';

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

const CreateVaultModal: React.FC<CreateVaultModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [vaultName, setVaultName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVaultName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleCreate = () => {
    const trimmed = vaultName.trim();
    if (trimmed) {
      onCreate(trimmed);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="security-modal-overlay" onClick={onClose}>
      <div
        className="security-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '360px' }}
      >
        <div className="security-header">
          <img
            src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
            alt="RAGbox.co Logo"
            style={{ width: '120px', height: 'auto', marginBottom: '16px' }}
          />
          <h2>Create New Vault</h2>
          <p>Initialize a secure document container</p>
        </div>

        <div className="security-form">
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Enter Vault Name:
          </label>
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g., Legal Documents"
            className="security-input"
            value={vaultName}
            onChange={e => setVaultName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="security-button-group">
            <button
              className="security-action-btn security-btn-primary"
              onClick={handleCreate}
              disabled={!vaultName.trim()}
            >
              INITIALIZE CONTAINER
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

export default CreateVaultModal;
