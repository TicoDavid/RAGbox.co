'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import type { VoiceState, ConnectionState } from '@/lib/voice/types';

interface VoiceButtonProps {
  voiceState: VoiceState;
  connectionState: ConnectionState;
  audioLevel: number;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceButton({
  voiceState,
  connectionState,
  audioLevel,
  onToggle,
  disabled = false,
}: VoiceButtonProps) {
  const isActive = voiceState === 'listening' || voiceState === 'speaking';
  const isSpeaking = voiceState === 'speaking';
  const isError = voiceState === 'error' || connectionState === 'error';
  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  const normalizedLevel = Math.min(audioLevel / 255, 1);
  const scale = isActive ? 1 + normalizedLevel * 0.15 : 1;

  return (
    <motion.button
      onClick={onToggle}
      disabled={disabled || isConnecting}
      className={`
        relative flex items-center justify-center
        w-12 h-12 rounded-full
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050505]
        ${isError
          ? 'bg-red-600/20 text-red-500 focus:ring-red-500'
          : isActive
            ? 'bg-cyan-500/20 text-cyan-400 focus:ring-cyan-500'
            : 'bg-gray-800 text-gray-400 hover:text-gray-200 focus:ring-gray-500'
        }
        ${disabled || isConnecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      animate={{ scale }}
      transition={{ duration: 0.1 }}
      title={
        isError ? 'Voice error - click to retry' :
        isConnecting ? 'Connecting...' :
        isActive ? 'Click to stop' :
        'Click to speak (V)'
      }
    >
      {isActive && (
        <motion.div
          className={`absolute inset-0 rounded-full ${isSpeaking ? 'bg-cyan-400' : 'bg-cyan-500'}`}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {isSpeaking ? (
        <Volume2 className="w-5 h-5 relative z-10" />
      ) : isError ? (
        <MicOff className="w-5 h-5 relative z-10" />
      ) : (
        <Mic className="w-5 h-5 relative z-10" />
      )}

      {voiceState !== 'idle' && (
        <span
          className={`
            absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#050505]
            ${connectionState === 'connected' ? 'bg-green-500' :
              connectionState === 'connecting' || connectionState === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
              connectionState === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }
          `}
        />
      )}
    </motion.button>
  );
}
