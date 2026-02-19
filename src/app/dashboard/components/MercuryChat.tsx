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
import { useVoiceChat } from '../hooks/useVoiceChat';
import type { PageContext } from '../hooks/useVoiceChat';
import ForgeButton from '@/components/forge/ForgeButton';
import ReasoningPanel from '@/components/mercury/ReasoningPanel';
import CitationChip from '@/components/mercury/CitationChip';
import ConfidenceBadge from '@/components/mercury/ConfidenceBadge';

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
  p: ({ children }) => {
    // Check if this paragraph contains confidence or sources metadata
    const childText = String(children);
    if (childText.includes('📊 Confidence:') || childText.includes('📚 Sources:')) {
      return <p className="mercury-metadata">{children}</p>;
    }
    return <p className="mercury-paragraph">{children}</p>;
  },
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
  getPageContext?: () => PageContext;  // Page awareness for voice chat
  onExpand?: () => void;  // Expand Mercury window
  isExpanded?: boolean;  // Whether Mercury is currently expanded
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
  // Hooks must be called unconditionally (before any early returns)
  const insights = useMemo(() => detectInsights(message.id, message.text), [message.id, message.text]);

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
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.text.replace('MERCURY', '').trim()}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

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

        {/* Confidence Badge */}
        {message.confidence !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <ConfidenceBadge confidence={message.confidence} />
          </div>
        )}

        {/* Structured Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] text-[var(--text-tertiary)] mb-1">Sources</div>
            <div className="flex flex-wrap gap-1">
              {message.citations.map(citation => (
                <CitationChip
                  key={citation.citationIndex}
                  index={citation.citationIndex}
                  documentName={citation.documentName}
                  excerpt={citation.excerpt}
                  relevanceScore={citation.relevanceScore}
                  securityTier={citation.securityTier}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reasoning Trace */}
        {message.reasoningTrace && (
          <ReasoningPanel trace={message.reasoningTrace} />
        )}

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
          <ForgeButton responseText={cleanedText} />
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
  getSystemPrompt,
  getPageContext,
  onExpand,
  isExpanded
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice chat hook — Three-state: OFF / ON / MUTE
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
      getPageContext: getPageContext,
    }
  );

  // Long-press detection (600ms)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const handlePointerDown = useCallback(() => {
    didLongPressRef.current = false;
    if (voiceChat.mode === 'on' || voiceChat.mode === 'mute') {
      longPressTimerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        voiceChat.turnOff();
      }, 600);
    }
  }, [voiceChat]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Voice button click handler: OFF->ON, ON->MUTE, MUTE->ON, speaking->interrupt
  const handleVoiceClick = useCallback(async () => {
    // If long-press already fired, skip the click
    if (didLongPressRef.current) return;

    if (voiceChat.isSpeaking) {
      voiceChat.interrupt();
    } else if (voiceChat.mode === 'off') {
      await voiceChat.turnOn();
    } else {
      // ON -> MUTE or MUTE -> ON
      voiceChat.toggleMute();
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

    // Shift+Enter: continue bullet point if on a bullet line
    if (e.key === 'Enter' && e.shiftKey && textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const value = textarea.value;

      // Find the current line
      const beforeCursor = value.substring(0, cursorPos);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = beforeCursor.substring(lineStart);

      // Check if current line starts with a bullet point
      const bulletMatch = currentLine.match(/^(\s*)• /);
      if (bulletMatch) {
        e.preventDefault();
        const leadingSpaces = bulletMatch[1];
        const afterCursor = value.substring(cursorPos);
        const newValue = beforeCursor + '\n' + leadingSpaces + '• ' + afterCursor;

        onInputChange(newValue);

        // Set cursor position after the new bullet
        setTimeout(() => {
          const newCursorPos = cursorPos + 1 + leadingSpaces.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          // Trigger resize
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }, 0);
      }
    }
  };

  // Auto-resize textarea as user types
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    let value = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Check if user typed "-" at start of line (convert to bullet point)
    // Match "-" at the very beginning or after a newline
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);

    // Check if the character just before cursor is "-" and it's at line start
    if (beforeCursor.endsWith('-')) {
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const lineContent = beforeCursor.substring(lineStart);

      // If the line only contains "-" (possibly with leading spaces), convert to bullet
      if (lineContent.trim() === '-') {
        const leadingSpaces = lineContent.match(/^\s*/)?.[0] || '';
        value = beforeCursor.substring(0, lineStart) + leadingSpaces + '• ' + afterCursor;

        // Update textarea and restore cursor position after bullet
        textarea.value = value;
        const newCursorPos = lineStart + leadingSpaces.length + 2; // "• " is 2 chars
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight, capped at max-height (200px)
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    onInputChange(value);
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
            <span>Veritas Audit Log</span>
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
          {onExpand && (
            <button className="icon-btn" title={isExpanded ? "Collapse" : "Expand"} onClick={onExpand}>
              <MaximizeIcon />
            </button>
          )}
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
                voiceChat.transcript ? voiceChat.transcript :
                voiceChat.isSpeaking ? "Mercury is speaking..." :
                voiceChat.isProcessing ? "Mercury is thinking..." :
                voiceChat.mode === 'on' ? "Listening... speak or type here" :
                voiceChat.mode === 'mute' ? "Voice paused \u2014 click mic to resume" :
                "Request verified intelligence..."
              }
              disabled={isLoading}
              rows={1}
              className="mercury-textarea"
            />
          </div>

          {/* Voice Button — Three-state: OFF / ON / MUTE */}
          {/* Click: OFF->ON, ON->MUTE, MUTE->ON, speaking->interrupt */}
          {/* Long-press (600ms): ON->OFF, MUTE->OFF */}
          <button
            className={`realtime-voice-btn ${voiceChat.mode === 'on' ? 'voice-on' : ''} ${voiceChat.mode === 'mute' ? 'voice-mute' : ''} ${voiceChat.isSpeaking ? 'speaking' : ''} ${voiceChat.isProcessing ? 'processing' : ''}`}
            onClick={handleVoiceClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onContextMenu={(e) => e.preventDefault()}
            title={
              voiceChat.isSpeaking ? 'INTERRUPT' :
              voiceChat.isProcessing ? 'THINKING...' :
              voiceChat.mode === 'off' ? 'START VOICE MODE' :
              voiceChat.mode === 'on' ? 'MUTE (long-press to turn off)' :
              'UNMUTE (long-press to turn off)'
            }
            disabled={isLoading}
          >
            {/* Pulse rings for ON state */}
            {voiceChat.mode === 'on' && !voiceChat.isSpeaking && !voiceChat.isProcessing && (
              <>
                <div className="voice-ripple on" />
                <div className="voice-ripple on delay-1" />
                <div className="voice-ripple on delay-2" />
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
              {/* Mute slash indicator */}
              {voiceChat.mode === 'mute' && (
                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              )}
            </svg>
            {voiceChat.mode !== 'off' && (
              <span className="voice-status-text">
                {voiceChat.isSpeaking ? 'SPEAKING...' :
                 voiceChat.isProcessing ? 'THINKING...' :
                 voiceChat.mode === 'on' ? 'LISTENING' :
                 'MUTED'}
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
