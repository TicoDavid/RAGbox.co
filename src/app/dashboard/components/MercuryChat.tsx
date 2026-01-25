"use client";

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
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
import { useVoiceChat, GeminiVoice } from '../hooks/useVoiceChat';

// Custom markdown components for styled rendering
const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="mercury-table-wrapper">
      <table className="mercury-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="mercury-thead">{children}</thead>,
  tbody: ({ children }) => <tbody className="mercury-tbody">{children}</tbody>,
  tr: ({ children }) => <tr className="mercury-tr">{children}</tr>,
  th: ({ children }) => <th className="mercury-th">{children}</th>,
  td: ({ children }) => <td className="mercury-td">{children}</td>,
  ul: ({ children }) => <ul className="mercury-ul">{children}</ul>,
  ol: ({ children }) => <ol className="mercury-ol">{children}</ol>,
  li: ({ children }) => <li className="mercury-li">{children}</li>,
  h1: ({ children }) => <h1 className="mercury-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="mercury-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="mercury-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="mercury-h4">{children}</h4>,
  p: ({ children }) => <p className="mercury-paragraph">{children}</p>,
  strong: ({ children }) => <strong className="mercury-strong">{children}</strong>,
  em: ({ children }) => <em className="mercury-em">{children}</em>,
  code: ({ children, className }) => {
    const isInline = !className;
    return isInline
      ? <code className="mercury-code-inline">{children}</code>
      : <code className={`mercury-code-block ${className || ''}`}>{children}</code>;
  },
  pre: ({ children }) => <pre className="mercury-pre">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="mercury-blockquote">{children}</blockquote>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mercury-link">
      {children}
    </a>
  ),
};

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  onVoiceTranscript?: (userText: string, aiText: string) => void;
  getDocumentContext?: () => string[];  // Document context for voice chat
  getChatHistory?: () => ChatHistoryMessage[];  // Chat history for voice context
  getSystemPrompt?: () => string;  // Current protocol system prompt
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

  // Clean up the message text - remove "MERCURY" prefix if present
  const cleanedText = message.text.replace(/^MERCURY\s*/i, '').trim();

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
        {/* Render markdown content */}
        <div className="mercury-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {cleanedText}
          </ReactMarkdown>
        </div>

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
  onInsightAction,
  onVoiceTranscript,
  getDocumentContext,
  getChatHistory,
  getSystemPrompt
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice chat hook - Manual Toggle Mode
  // Click mic to START recording, click again to STOP (or wait 2s silence)
  const voiceChat = useVoiceChat(
    useCallback((userText: string, aiResponse: string) => {
      if (onVoiceTranscript) {
        onVoiceTranscript(userText, aiResponse);
      }
    }, [onVoiceTranscript]),
    {
      getContext: getDocumentContext,
      getChatHistory: getChatHistory,
      getSystemPrompt: getSystemPrompt,
    }
  );

  // Voice button click handler - context-aware
  const handleVoiceClick = useCallback(async () => {
    if (!voiceChat.isConnected) {
      // Not in voice mode - start session
      await voiceChat.startVoiceChat();
    } else if (voiceChat.isSpeaking) {
      // AI is speaking - interrupt
      voiceChat.interrupt();
    } else {
      // In voice mode - toggle recording
      voiceChat.toggleRecording();
    }
  }, [voiceChat]);

  // Long press to end voice session
  const handleVoiceLongPress = useCallback(() => {
    if (voiceChat.isConnected) {
      voiceChat.stopVoiceChat();
    }
  }, [voiceChat]);

  // Filter out system events from chat - only show user messages and AI responses
  const filteredChatLog = useMemo(() => {
    return chatLog.filter(msg => msg.type !== 'system_event');
  }, [chatLog]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [filteredChatLog]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends message, Shift+Enter adds new line
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      onSendMessage('chat');
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Auto-resize textarea as user types
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight, capped at max-height (200px)
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    onInputChange(textarea.value);
  };

  return (
    <div className="panel chat-panel">
      {/* Circuit board background pattern */}
      <div className="mercury-circuit-bg" aria-hidden="true" />
      <div className="panel-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h3 className="panel-title">MERCURY</h3>
          <div className="sovereign-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>SOVEREIGN ENVIRONMENT</span>
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
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                voiceChat.transcript ? `🎤 ${voiceChat.transcript}` :
                voiceChat.isRecording ? "🎤 Recording... click mic to stop" :
                voiceChat.isConnected ? "🎤 Voice mode active - click mic to record" :
                "Request verified intelligence..."
              }
              disabled={isLoading}
              rows={1}
              className="mercury-textarea"
            />
          </div>

          {/* Voice Button - Manual Toggle Mode */}
          {/* Click: Start session / Toggle recording / Interrupt speech */}
          {/* Long press: End session */}
          <button
            className={`realtime-voice-btn ${voiceChat.isConnected ? 'active' : ''} ${voiceChat.isRecording ? 'recording' : ''} ${voiceChat.isSpeaking ? 'speaking' : ''}`}
            onClick={handleVoiceClick}
            onContextMenu={(e) => { e.preventDefault(); handleVoiceLongPress(); }}
            title={
              !voiceChat.isConnected ? 'START VOICE MODE' :
              voiceChat.isRecording ? 'STOP RECORDING' :
              voiceChat.isSpeaking ? 'INTERRUPT' :
              'START RECORDING (right-click to exit)'
            }
            disabled={isLoading}
          >
            {/* Pulse rings for recording state */}
            {voiceChat.isRecording && (
              <>
                <div className="voice-ripple recording" />
                <div className="voice-ripple recording delay-1" />
                <div className="voice-ripple recording delay-2" />
              </>
            )}
            {voiceChat.isSpeaking && (
              <>
                <div className="voice-ripple speaking" />
                <div className="voice-ripple speaking delay-1" />
              </>
            )}
            <svg className="voice-waveform-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Microphone */}
              <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M5 10V11C5 14.866 8.13401 18 12 18C15.866 18 19 14.866 19 11V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              {/* Recording indicator - pulsing dot */}
              {voiceChat.isRecording && (
                <circle cx="12" cy="7" r="2" fill="#FF3D00">
                  <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>
                </circle>
              )}
            </svg>
            {voiceChat.isConnected && (
              <span className="voice-status-text">
                {voiceChat.isSpeaking ? 'SPEAKING...' :
                 voiceChat.isRecording ? 'RECORDING...' :
                 'READY'}
              </span>
            )}
            {voiceChat.error && (
              <span className="voice-error-text">{voiceChat.error}</span>
            )}
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
