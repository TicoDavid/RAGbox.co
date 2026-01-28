"use client";

import React, { useRef, useState, useEffect } from 'react';

interface IngestionVortexProps {
  onFileDrop: (files: File[]) => void;
  theme?: 'dark' | 'light';
}

// Image URL for vault drop zone
const VAULT_IMAGE_URL = "https://storage.googleapis.com/connexusai-assets/RAGbox%20ICON_Chrome.png";

const IngestionVortex: React.FC<IngestionVortexProps> = ({ onFileDrop, theme = 'dark' }) => {
  const isLightMode = theme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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



      // Convert FileList to array and pass all files
      const filesArray = Array.from(e.dataTransfer.files);
      onFileDrop(filesArray);

      setTimeout(() => {
        setIsImploding(false);
      }, 1000);
    }
  };

  const handleClick = async () => {
    // Try modern File System Access API first (remembers last directory)
    if ('showOpenFilePicker' in window) {
      try {
        const fileHandles = await (window as Window & { showOpenFilePicker: (options?: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Documents',
              accept: {
                'application/pdf': ['.pdf'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'text/plain': ['.txt'],
                'text/csv': ['.csv'],
                'application/json': ['.json'],
              },
            },
          ],
          excludeAcceptAllOption: false, // Shows "All Files" option
        });

        if (fileHandles.length > 0) {
          setIsImploding(true);

          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.log("Audio play failed", err));
          }

          // Convert file handles to File objects
          const files = await Promise.all(fileHandles.map(handle => handle.getFile()));
          onFileDrop(files);

          setTimeout(() => {
            setIsImploding(false);
          }, 1000);
        }
        return;
      } catch (err) {
        // User cancelled or API not supported - fall back to input
        if ((err as Error).name === 'AbortError') return;
        console.log('File System Access API failed, using fallback', err);
      }
    }

    // Fallback: standard file input
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
      {/* Vault icon image */}
      <img
        src={VAULT_IMAGE_URL}
        alt="RAGbox Vault"
        className={`vortex-video-element ${isImploding ? 'imploding' : ''} ${isLightMode ? 'light-mode-video' : ''}`}
        draggable={false}
      />

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
