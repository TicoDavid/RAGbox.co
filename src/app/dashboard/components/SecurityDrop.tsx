"use client";

import React, { useState } from 'react';
import type { Source } from '../types';
import { MenuIcon, PhotoIcon, FileTextIcon } from './Icons';
import IngestionVortex from './IngestionVortex';

interface SecurityDropProps {
  sources: Source[];
  onFileDrop: (files: File[]) => void;
  theme?: 'dark' | 'light';
}

const SecurityDrop: React.FC<SecurityDropProps> = ({ sources, onFileDrop, theme = 'dark' }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleDragStart = (e: React.DragEvent, source: Source) => {
    let itemsToDrag: Source[] = [];

    if (selectedIds.has(source.id)) {
      itemsToDrag = sources.filter(s => selectedIds.has(s.id));
    } else {
      itemsToDrag = [source];
    }

    e.dataTransfer.setData("application/json", JSON.stringify(itemsToDrag));
  };

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="panel sources-panel">
      <div className="panel-header">
        <h3 className="panel-title">SECURITY DROP</h3>
        <button className="icon-btn"><MenuIcon /></button>
      </div>
      <IngestionVortex onFileDrop={onFileDrop} theme={theme} />
      <div className="sources-content">
        {sources.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
            No active sources. Drop files above.
          </div>
        )}
        <div className="sources-list">
          {sources.map(source => {
            const isSelected = selectedIds.has(source.id);
            return (
              <div
                key={source.id}
                className={`source-card-new ${source.isNew ? 'glow' : ''} ${isSelected ? 'selected' : ''}`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, source)}
                onClick={() => toggleSelection(source.id)}
              >
                <div className="source-card-icon">
                  {source.type === 'image' ? <PhotoIcon /> : <FileTextIcon />}
                </div>
                <div className="source-card-details">
                  <div className="source-card-title">{source.title}</div>
                  <div className="source-card-time">{source.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SecurityDrop;
