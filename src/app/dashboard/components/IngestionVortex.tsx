"use client";

import React, { useRef, useState, useEffect } from 'react';

interface IngestionVortexProps {
  onFileDrop: (file: File) => void;
}

const IngestionVortex: React.FC<IngestionVortexProps> = ({ onFileDrop }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isImploding, setIsImploding] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio("https://storage.googleapis.com/connexusai-assets/sub-bass-short-impact-davies-aguirre-1-00-00.mp3");
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

      onFileDrop(e.dataTransfer.files[0]);

      setTimeout(() => {
        setIsImploding(false);
      }, 1000);
    }
  };

  const handleClick = () => {
    // Open file picker on click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsImploding(true);

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(err => console.log("Audio play failed", err));
        }

        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(err => console.log("Video play failed", err));
        }

        onFileDrop(file);

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
      className={`ingestion-vortex-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        src="https://storage.googleapis.com/connexusai-assets/RAGbox%20Vault%20video.mp4"
        className={`vortex-video-element ${isImploding ? 'imploding' : ''}`}
        muted
        playsInline
      />

      <div className={`vortex-overlay ${isDragging ? 'active' : ''}`}>
        <div className="vortex-text">
          <span className="vortex-title">SECURELY UPLOAD</span>
          <span className="vortex-subtitle">Drag & Drop into the Vault</span>
        </div>
      </div>
    </div>
  );
};

export default IngestionVortex;
