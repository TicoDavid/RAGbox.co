"use client";

import React, { useState, useEffect } from 'react';
import type { VaultStatus } from '../types';
import { ShieldCheckIcon } from './Icons';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultName: string;
  currentStatus: VaultStatus;
  onUpdateStatus: (status: VaultStatus) => void;
}

const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  vaultName,
  currentStatus,
  onUpdateStatus
}) => {
  const [selectedStatus, setSelectedStatus] = useState<VaultStatus>(currentStatus);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
      setPassword('');
      setError('');
    }
  }, [isOpen, currentStatus]);

  const handleAuthenticate = () => {
    // For demo: allow any access (no password required)
    onUpdateStatus(selectedStatus);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="security-modal-overlay" onClick={onClose}>
      <div className="security-modal" onClick={e => e.stopPropagation()}>
        <div className="security-header">
          <div className="security-shield"><ShieldCheckIcon /></div>
          <h2>Vault Access Control</h2>
          <p>Manage security protocol for <strong>{vaultName}</strong></p>
        </div>

        <div className="status-selector">
          <button
            className={`status-btn ${selectedStatus === 'secure' ? 'active secure' : ''}`}
            onClick={() => setSelectedStatus('secure')}
          >
            SECURE
          </button>
          <button
            className={`status-btn ${selectedStatus === 'open' ? 'active open' : ''}`}
            onClick={() => setSelectedStatus('open')}
          >
            OPEN
          </button>
          <button
            className={`status-btn ${selectedStatus === 'closed' ? 'active closed' : ''}`}
            onClick={() => setSelectedStatus('closed')}
          >
            CLOSE
          </button>
        </div>

        <div className="security-form">
          <input
            type="password"
            placeholder="Set Session Password (Optional)"
            className={`security-input ${error ? 'error' : ''}`}
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
          />
          {error && <div className="security-error-msg">{error}</div>}
          <button
            className={`security-action-btn action-${selectedStatus}`}
            onClick={handleAuthenticate}
          >
            Authenticate & Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityModal;
