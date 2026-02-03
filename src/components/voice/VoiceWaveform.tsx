'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface VoiceWaveformProps {
  audioLevel: number;
  isActive: boolean;
  color?: string;
  barCount?: number;
  width?: number;
  height?: number;
}

export function VoiceWaveform({
  audioLevel,
  isActive,
  color = '#2463EB',
  barCount = 24,
  width = 120,
  height = 32,
}: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / barCount) * 0.6;
    const gap = (width / barCount) * 0.4;
    const normalizedLevel = Math.min(audioLevel / 255, 1);

    timeRef.current += 0.05;

    for (let i = 0; i < barCount; i++) {
      let targetHeight: number;

      if (isActive) {
        // Active: bars respond to audio level with wave pattern
        const wave = Math.sin(timeRef.current * 3 + i * 0.5) * 0.3 + 0.7;
        const center = Math.abs(i - barCount / 2) / (barCount / 2);
        const centerBoost = 1 - center * 0.4;
        targetHeight = normalizedLevel * wave * centerBoost * (height * 0.85);
        targetHeight = Math.max(targetHeight, 2);
      } else {
        // Inactive: flat low bars
        targetHeight = 2;
      }

      // Smooth interpolation
      barsRef.current[i] += (targetHeight - barsRef.current[i]) * 0.15;
      const barHeight = barsRef.current[i];

      const x = i * (barWidth + gap) + gap / 2;
      const y = (height - barHeight) / 2;
      const radius = Math.min(barWidth / 2, barHeight / 2, 2);

      // Draw rounded rectangle
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight - radius);
      ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
      ctx.lineTo(x + radius, y + barHeight);
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();

      if (isActive) {
        const opacity = 0.4 + normalizedLevel * 0.6;
        ctx.fillStyle = color + Math.round(opacity * 255).toString(16).padStart(2, '0');
      } else {
        ctx.fillStyle = '#444444';
      }

      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [audioLevel, isActive, color, barCount, width, height]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="pointer-events-none"
    />
  );
}
