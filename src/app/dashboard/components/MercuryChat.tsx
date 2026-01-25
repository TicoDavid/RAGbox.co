"use client";

import React, { useRef, useEffect, useMemo, useState } from 'react';
import type { ChatMessage, Vault, Source, SystemAuditEvent, ParsedInsight, InsightHandoffPayload, ArtifactType } from '../types';
import {
  PlusIcon,
  HistoryIcon,
  SaveIcon,
  TrashIcon,
  CopyIcon,
  MaximizeIcon,
  DownloadIcon,
  GlobeIcon,
  InsightTypeIcon,
  InsightActionIcon
} from './Icons';
import ContextBar from './ContextBar';
import { detectInsights, getActionsForInsight, getInsightColor, getInsightTypeName } from '../insight-detection';

interface MercuryChatProps {
  chatLog: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  vaults: Vault[];
  sources: Source[];
  auditEvents: SystemAuditEvent[];
  onInputChange: (value: string) => void;
  onSendMessage: (mode: 'chat' | 'design') => void;
  onNewSession: () => void;
  onShowHistory: () => void;
  onSaveToVault: () => void;
  onDeleteSession: () => void;
  onInsightAction?: (payload: InsightHandoffPayload) => void;
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

// Insight Block Component
interface InsightBlockProps {
  insight: ParsedInsight;
  onAction: (payload: InsightHandoffPayload) => void;
}

const InsightBlock: React.FC<InsightBlockProps> = ({ insight, onAction }) => {
  const actions = getActionsForInsight(insight.type);
  const color = getInsightColor(insight.type);
  const typeName = getInsightTypeName(insight.type);

  const handleAction = (actionId: string, artifactType: ArtifactType) => {
    const payload: InsightHandoffPayload = {
      source_insight_id: insight.id,
      artifact_type: artifactType,
      context_data: {
        title: insight.title,
        key_datapoints: insight.keyDatapoints,
        summary_text: insight.content,
        source_citations: insight.sourceCitations,
        insight_type: insight.type
      },
      requested_at: Date.now()
    };
    onAction(payload);
  };

  return (
    <div
      className="insight-block"
      data-insight-type={insight.type}
      style={{ '--insight-color': color } as React.CSSProperties}
    >
      <div className="insight-header">
        <div className="insight-type-badge" style={{ backgroundColor: `${color}20`, color }}>
          <InsightTypeIcon type={insight.type} />
          <span>{typeName}</span>
        </div>
        <span className="insight-title">{insight.title}</span>
      </div>
      <div className="insight-content">
        {renderTextWithCitations(insight.content)}
      </div>
      {insight.keyDatapoints && Object.keys(insight.keyDatapoints).length > 0 && (
        <div className="insight-datapoints">
          {Object.entries(insight.keyDatapoints).map(([key, value]) => (
            <span key={key} className="insight-datapoint">
              <strong>{key}:</strong> {value}
            </span>
          ))}
        </div>
      )}
      <div className="insight-action-bar">
        {actions.map(action => (
          <button
            key={action.id}
            className="insight-action-btn"
            onClick={() => handleAction(action.id, action.artifactType)}
          >
            <InsightActionIcon icon={action.icon} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Chat Message Component
interface ChatMessageItemProps {
  message: ChatMessage;
  onInsightAction?: (payload: InsightHandoffPayload) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onInsightAction }) => {
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

  // Detect insights from message text
  const insights = useMemo(() => detectInsights(message.id, message.text), [message.id, message.text]);

  const lines = message.text.split('\n');
  const sections: React.ReactNode[] = [];
  let currentSectionTitle: string | null = null;
  let currentSectionContent: React.ReactNode[] = [];

  const flushSection = () => {
    if (currentSectionTitle || currentSectionContent.length > 0) {
      const isFindings = currentSectionTitle?.toUpperCase() === 'AEGIS' || currentSectionTitle?.toUpperCase() === 'FINDINGS';
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
    if (trimmed.match(/^(Summary|Aegis|Sources|Findings)$/i)) {
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

  // Default handler for insights if no handler provided
  const handleInsightAction = (payload: InsightHandoffPayload) => {
    if (onInsightAction) {
      onInsightAction(payload);
    }
  };

  return (
    <div className="chat-message mercury">
      <span className="chat-label mercury">MERCURY</span>
      <div className="mercury-content">
        {sections}

        {/* Render detected insights */}
        {insights.length > 0 && onInsightAction && (
          <div className="insights-section">
            <div className="mercury-section-header insights-header">
              ACTIONABLE INSIGHTS
            </div>
            <div className="insights-grid">
              {insights.map(insight => (
                <InsightBlock
                  key={insight.id}
                  insight={insight}
                  onAction={handleInsightAction}
                />
              ))}
            </div>
          </div>
        )}

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
  auditEvents,
  onInputChange,
  onSendMessage,
  onNewSession,
  onShowHistory,
  onSaveToVault,
  onDeleteSession,
  onInsightAction
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice state for Google Realtime
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const handleVoiceToggle = () => {
    setIsVoiceActive(prev => !prev);
    // TODO: Integrate with Google Realtime Voice API
  };

  // Filter out system events from chat - only show user messages and AI responses
  const filteredChatLog = useMemo(() => {
    return chatLog.filter(msg => msg.type !== 'system_event');
  }, [chatLog]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [filteredChatLog]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      onSendMessage('chat');
    }
  };

  return (
    <div className="panel chat-panel">
      {/* Circuit board background pattern */}
      <div className="mercury-circuit-bg" aria-hidden="true" />
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

      <ContextBar vaults={vaults} sources={sources} auditEvents={auditEvents} />

      <div className="chat-area" ref={chatScrollRef}>
        {filteredChatLog.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} onInsightAction={onInsightAction} />
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
        <div className="chat-input-row">
          <div className="chat-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Request verified intelligence..."
              disabled={isLoading || isVoiceActive}
            />
          </div>

          {/* Standalone Realtime Voice Button */}
          <button
            className={`realtime-voice-btn ${isVoiceActive ? 'active' : ''}`}
            onClick={handleVoiceToggle}
            title="ENGAGE REALTIME SECURE VOICE"
          >
            <div className="voice-ripple" />
            <div className="voice-ripple delay-1" />
            <div className="voice-ripple delay-2" />
            <svg className="voice-waveform-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Microphone with waveform */}
              <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 10V11C5 14.866 8.13401 18 12 18C15.866 18 19 14.866 19 11V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              {/* Waveform lines */}
              <line x1="2" y1="12" x2="2" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="wave-line">
                <animate attributeName="y1" values="10;14;10" dur="0.5s" repeatCount="indefinite"/>
                <animate attributeName="y2" values="14;10;14" dur="0.5s" repeatCount="indefinite"/>
              </line>
              <line x1="22" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="wave-line">
                <animate attributeName="y1" values="14;10;14" dur="0.5s" repeatCount="indefinite"/>
                <animate attributeName="y2" values="10;14;10" dur="0.5s" repeatCount="indefinite"/>
              </line>
            </svg>
            {isVoiceActive && <span className="voice-status-text">LISTENING...</span>}
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
