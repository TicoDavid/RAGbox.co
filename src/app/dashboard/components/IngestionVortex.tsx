"use client";

import React, { useRef, useState, useEffect } from 'react';

interface IngestionVortexProps {
  onFileDrop: (files: File[]) => void;
  theme?: 'dark' | 'light';
}

// Clay Render Document Stack - Light Mode Asset
const ClayRenderStack: React.FC<{ isDragging: boolean; isImploding: boolean }> = ({ isDragging, isImploding }) => (
  <div className={`clay-render-stack ${isDragging ? 'hover' : ''} ${isImploding ? 'imploding' : ''}`}>
    {/* Stacked paper layers with clay/3D effect */}
    <div className="clay-paper clay-paper-back" />
    <div className="clay-paper clay-paper-mid" />
    <div className="clay-paper clay-paper-front">
      {/* Document icon */}
      <svg className="clay-doc-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5"/>
        <path d="M14 2v6h6" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5"/>
        <line x1="8" y1="13" x2="16" y2="13" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="17" x2="13" y2="17" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
    {/* Upload arrow */}
    <div className="clay-upload-indicator">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  </div>
);

const IngestionVortex: React.FC<IngestionVortexProps> = ({ onFileDrop, theme = 'dark' }) => {
  const isLightMode = theme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isImploding, setIsImploding] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio("https://storage.googleapis.com/connexusai-assets/trailer-transition-double-crushing-impact-epic-stock-media-1-00-09.mp3");
    audioRef.current.volume = 0.5;
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsImploding(true);

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.log("Audio play failed (interaction policy)", err));
      }

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => console.log("Video play failed", err));
      }

      // Convert FileList to array and pass all files
      const filesArray = Array.from(e.dataTransfer.files);
      onFileDrop(filesArray);

      setTimeout(() => {
        setIsImploding(false);
      }, 1000);
    }
  };

  const handleClick = () => {
    // Open file picker on click with multiple selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        setIsImploding(true);

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.log("Audio play failed", err));
        }

        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(err => console.log("Video play failed", err));
        }

        // Convert FileList to array and pass all files
        const filesArray = Array.from(files);
        onFileDrop(filesArray);

        setTimeout(() => {
          setIsImploding(false);
        }, 1000);
      }
    };
    input.click();
  };

  return (
    <div
      ref={containerRef}
      className={`ingestion-vortex-container ${isDragging ? 'dragging' : ''} ${isLightMode ? 'light-mode' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {/* Theme-aware asset switching */}
      {isLightMode ? (
        <ClayRenderStack isDragging={isDragging} isImploding={isImploding} />
      ) : (
        <video
          ref={videoRef}
          src="https://storage.googleapis.com/connexusai-assets/RAGbox%20Vault%20video.mp4"
          className={`vortex-video-element ${isImploding ? 'imploding' : ''}`}
          muted
          playsInline
        />
      )}

      <div className={`vortex-overlay ${isDragging ? 'active' : ''}`}>
        {/* Frosted glass pill for text readability in light mode */}
        <div className={`vortex-text ${isLightMode ? 'frosted-pill' : ''}`}>
          <span className="vortex-title">SECURELY UPLOAD</span>
          <span className="vortex-subtitle">Drag & Drop into the Vault</span>
        </div>
      </div>
    </div>
  );
};

export default IngestionVortex;
