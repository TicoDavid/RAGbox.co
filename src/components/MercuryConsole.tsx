"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Types
interface Citation {
  id: number;
  text: string;
  source: string;
  page?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface MercuryConsoleProps {
  privilegeMode: boolean;
  onCitationClick?: (citation: Citation) => void;
}

// Confidence threshold for Silence Protocol
const CONFIDENCE_THRESHOLD = 0.85;

export default function MercuryConsole({ privilegeMode, onCitationClick }: MercuryConsoleProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'system-init',
      role: 'system',
      content: '> MERCURY CONSOLE v2.0 INITIALIZED\n> AWAITING INTERROGATION VECTOR...',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create placeholder for streaming response
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          privilegeMode,
        }),
      });

      if (!response.ok) throw new Error('Query failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let confidence = 0.95;
      let citations: Citation[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: fullContent }
                    : msg
                ));
              }
              if (parsed.confidence !== undefined) {
                confidence = parsed.confidence;
              }
              if (parsed.citations) {
                citations = parsed.citations;
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Finalize message
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: fullContent || 'No response generated.', isStreaming: false, confidence, citations }
          : msg
      ));

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: '> ERROR: INTERROGATION VECTOR FAILED\n> RETRY OR CONTACT SYSTEMS ADMIN', isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const renderConfidenceBadge = (confidence: number) => {
    const isLowConfidence = confidence < CONFIDENCE_THRESHOLD;
    return (
      <div className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider
        ${isLowConfidence
          ? 'bg-amber/20 text-amber border border-amber/30'
          : 'bg-emerald/20 text-emerald border border-emerald/30'
        }
      `}>
        {isLowConfidence ? (
          <>
            <AlertTriangle className="w-3 h-3" />
            <span>SILENCE PROTOCOL ({Math.round(confidence * 100)}%)</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3" />
            <span>VERIFIED ({Math.round(confidence * 100)}%)</span>
          </>
        )}
      </div>
    );
  };

  const renderCitations = (citations: Citation[]) => {
    if (!citations.length) return null;
    return (
      <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Sources</div>
        {citations.map(citation => (
          <button
            key={citation.id}
            onClick={() => onCitationClick?.(citation)}
            className="block w-full text-left px-2 py-1 rounded bg-steel/50 hover:bg-cyan/10 hover:border-cyan/30 border border-transparent transition-colors group"
          >
            <span className="text-cyan font-mono text-xs">[{citation.id}]</span>
            <span className="text-gray-400 text-xs ml-2 group-hover:text-cyan transition-colors">
              {citation.source}{citation.page ? ` (p.${citation.page})` : ''}
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800">
        {messages.map(message => (
          <div
            key={message.id}
            className={`
              ${message.role === 'user' ? 'ml-12' : 'mr-4'}
              ${message.role === 'system' ? 'text-center' : ''}
            `}
          >
            {message.role === 'system' ? (
              <div className="font-mono text-xs text-gray-600 whitespace-pre-wrap">
                {message.content}
              </div>
            ) : message.role === 'user' ? (
              <div className="bg-cyan/10 border border-cyan/20 rounded-lg p-3">
                <div className="text-xs font-mono text-cyan/60 mb-1">YOU</div>
                <div className="text-gray-200 text-sm whitespace-pre-wrap">{message.content}</div>
              </div>
            ) : (
              <div className={`
                bg-carbon border rounded-lg p-4
                ${privilegeMode ? 'border-privilege/30' : 'border-border'}
              `}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-mono text-gray-500">MERCURY</div>
                  {message.confidence !== undefined && !message.isStreaming && renderConfidenceBadge(message.confidence)}
                </div>
                <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-cyan ml-0.5 animate-pulse" />
                  )}
                </div>
                {message.citations && renderCitations(message.citations)}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-carbon/30 p-4">
        <div className={`
          flex items-end gap-3 bg-oled border rounded-lg p-3 transition-colors
          ${privilegeMode ? 'border-privilege/50' : 'border-border focus-within:border-cyan/50'}
        `}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={privilegeMode ? "PRIVILEGED INTERROGATION..." : "Enter interrogation vector..."}
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-gray-200 text-sm font-mono placeholder:text-gray-600 resize-none focus:outline-none disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={`
              p-2 rounded transition-all
              ${input.trim() && !isLoading
                ? 'bg-cyan text-black hover:shadow-cyan-glow'
                : 'bg-steel text-gray-600 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="mt-2 text-center">
          <span className="text-[10px] font-mono text-gray-700">
            SHIFT+ENTER FOR NEW LINE • ENTER TO SUBMIT
          </span>
        </div>
      </div>
    </div>
  );
}
