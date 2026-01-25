"use client";

import React, { useRef, useEffect } from 'react';
import type { ChatMessage, Vault, Source } from '../types';
import {
  PlusIcon,
  HistoryIcon,
  SaveIcon,
  TrashIcon,
  DesignGenIcon,
  CopyIcon,
  MaximizeIcon,
  DownloadIcon,
  GlobeIcon
} from './Icons';
import ContextBar from './ContextBar';

interface MercuryChatProps {
  chatLog: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  vaults: Vault[];
  sources: Source[];
  onInputChange: (value: string) => void;
  onSendMessage: (mode: 'chat' | 'design') => void;
  onNewSession: () => void;
  onShowHistory: () => void;
  onSaveToVault: () => void;
  onDeleteSession: () => void;
}

// Helper to highlight citations in text
const renderTextWithCitations = (text: string) => {
  const parts = text.split(/(\[Document:.*?\])/g);
  return parts.map((part, index) => {
    if (part.startsWith('[Document:') && part.endsWith(']')) {
      return <span key={index} className="citation-badge">{part}</span>;
    }
    return part;
  });
};

// Chat Message Component
const ChatMessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.isUser) {
    return (
      <div className="chat-message user">
        <span className="chat-label user">YOU</span>
        <div className="chat-text">{message.text}</div>
      </div>
    );
  }

  // Check for "Withheld" state
  const isWithheld = message.text.includes("We cannot verify a response from the selected sources");
  if (isWithheld) {
    return (
      <div className="chat-message mercury">
        <span className="chat-label mercury">MERCURY</span>
        <div className="mercury-withheld">
          {message.text.replace('MERCURY', '').trim()}
        </div>
      </div>
    );
  }

  const lines = message.text.split('\n');
  const sections: React.ReactNode[] = [];
  let currentSectionTitle: string | null = null;
  let currentSectionContent: React.ReactNode[] = [];

  const flushSection = () => {
    if (currentSectionTitle || currentSectionContent.length > 0) {
      const isFindings = currentSectionTitle?.toUpperCase() === 'FINDINGS';
      sections.push(
        <div key={sections.length} className="mercury-section">
          {currentSectionTitle && (
            <div className={`mercury-section-header ${isFindings ? 'green-mode' : ''}`}>
              {currentSectionTitle}
            </div>
          )}
          <div className="mercury-section-content">{currentSectionContent}</div>
        </div>
      );
    }
    currentSectionTitle = null;
    currentSectionContent = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed === 'MERCURY') return;
    if (trimmed.match(/^(Summary|Findings|Sources)$/i)) {
      flushSection();
      currentSectionTitle = trimmed.toUpperCase();
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      currentSectionContent.push(
        <div key={i} className="mercury-list-item">
          {renderTextWithCitations(trimmed.substring(1).trim())}
        </div>
      );
    } else {
      currentSectionContent.push(
        <p key={i} className="mercury-paragraph">
          {renderTextWithCitations(trimmed)}
        </p>
      );
    }
  });
  flushSection();

  // Grounding Sources (Google Search)
  let groundingSources = null;
  if (message.groundingMetadata?.groundingChunks) {
    groundingSources = (
      <div className="grounding-sources">
        <div className="mercury-section-header"><GlobeIcon /> Verified Web Sources</div>
        <div className="grounding-chips">
          {message.groundingMetadata.groundingChunks.map((chunk, i) => {
            if (chunk.web) {
              return (
                <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="grounding-chip">
                  {chunk.web.title || "Web Source"}
                </a>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-message mercury">
      <span className="chat-label mercury">MERCURY</span>
      <div className="mercury-content">
        {sections}
        {groundingSources}
        <div className="response-actions">
          <button className="response-action-btn" title="Copy to Studio"><CopyIcon /> Copy to Studio</button>
          <button className="response-action-btn" title="Expand Analysis"><MaximizeIcon /> Expand</button>
          <button className="response-action-btn" title="Export Findings"><DownloadIcon /> Export</button>
        </div>
      </div>
    </div>
  );
};

const MercuryChat: React.FC<MercuryChatProps> = ({
  chatLog,
  inputValue,
  isLoading,
  vaults,
  sources,
  onInputChange,
  onSendMessage,
  onNewSession,
  onShowHistory,
  onSaveToVault,
  onDeleteSession
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      onSendMessage('chat');
    }
  };

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h3 className="mercury-logo-text">Mercury</h3>
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Verified Intelligence</span>
          </div>
        </div>
        <div className="grid-selector">
          <button className="icon-btn" title="New Chat" onClick={onNewSession}>
            <PlusIcon />
          </button>
          <button className="icon-btn" title="History" onClick={onShowHistory}>
            <HistoryIcon />
          </button>
          <button className="icon-btn" title="Save to Vault" onClick={onSaveToVault}>
            <SaveIcon />
          </button>
          <button className="icon-btn" title="Clear Session" onClick={onDeleteSession}>
            <TrashIcon />
          </button>
        </div>
      </div>

      <ContextBar vaults={vaults} sources={sources} />

      <div className="chat-area" ref={chatScrollRef}>
        {chatLog.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="chat-message mercury">
            <span className="chat-label mercury">MERCURY</span>
            <div className="analyzing-indicator">
              Analyzing sources...
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Request verified intelligence or Search URL..."
            disabled={isLoading}
          />
          <button className="voice-btn" title="Voice Mode">
            <img
              src="https://storage.googleapis.com/connexusai-assets/ICON_RAGbox2.png"
              className="voice-icon-image"
              alt="Voice"
            />
          </button>
          <button
            className="send-btn design-btn"
            title="Generate Design + Chat"
            onClick={() => onSendMessage('design')}
            disabled={isLoading || !inputValue.trim()}
          >
            <DesignGenIcon />
          </button>
        </div>
        <div className="chat-footer-info">
          Responses are citation-backed. Unverifiable outputs are withheld.
        </div>
      </div>
    </div>
  );
};

export default MercuryChat;
