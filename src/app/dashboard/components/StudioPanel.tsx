"use client";

import React from 'react';
import type { Artifact, StudioMode, ComponentVariation, DrawerState } from '../types';
import { INITIAL_PLACEHOLDERS } from '../constants';
import {
  SparklesIcon,
  CodeIcon,
  LayoutIcon,
  ImageIcon,
  ChartIcon,
  VisionIcon,
  VideoIcon,
  Layout1Icon,
  Layout2Icon,
  Layout4Icon
} from './Icons';
import ArtifactCard from './ArtifactCard';

interface StudioPanelProps {
  artifacts: Artifact[];
  studioMode: StudioMode;
  gridColumns: 1 | 2 | 4;
  focusedArtifactIndex: number | null;
  isLoading: boolean;
  onStudioModeChange: (mode: StudioMode) => void;
  onGridColumnsChange: (cols: 1 | 2 | 4) => void;
  onArtifactClick: (index: number) => void;
  onGenerateVariations: (artifactId: string) => void;
  onShowCode: (content: string) => void;
  onSendDesignPrompt: (prompt: string) => void;
}

const StudioPanel: React.FC<StudioPanelProps> = ({
  artifacts,
  studioMode,
  gridColumns,
  focusedArtifactIndex,
  isLoading,
  onStudioModeChange,
  onGridColumnsChange,
  onArtifactClick,
  onGenerateVariations,
  onShowCode,
  onSendDesignPrompt
}) => {
  return (
    <div className="panel studio-panel">
      <div className="panel-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h3>Studio</h3>
          <div className="studio-mode-selector">
            <button
              className={`mode-btn ${studioMode === 'UI' ? 'active' : ''}`}
              onClick={() => onStudioModeChange('UI')}
              title="UI Code"
            >
              <LayoutIcon />
            </button>
            <button
              className={`mode-btn ${studioMode === 'ASSET' ? 'active' : ''}`}
              onClick={() => onStudioModeChange('ASSET')}
              title="Visual Asset"
            >
              <ImageIcon />
            </button>
            <button
              className={`mode-btn ${studioMode === 'CHART' ? 'active' : ''}`}
              onClick={() => onStudioModeChange('CHART')}
              title="Data Viz"
            >
              <ChartIcon />
            </button>
            <button
              className={`mode-btn ${studioMode === 'VISION' ? 'active' : ''}`}
              onClick={() => onStudioModeChange('VISION')}
              title="Vision-to-Code"
            >
              <VisionIcon />
            </button>
            <button
              className={`mode-btn ${studioMode === 'VIDEO' ? 'active' : ''}`}
              onClick={() => onStudioModeChange('VIDEO')}
              title="Motion/Video"
            >
              <VideoIcon />
            </button>
          </div>
        </div>
        <div className="panel-actions">
          <div className="grid-selector">
            <button
              className={`icon-btn ${gridColumns === 1 ? 'active' : ''}`}
              onClick={() => onGridColumnsChange(1)}
              title="1 Column"
            >
              <Layout1Icon />
            </button>
            <button
              className={`icon-btn ${gridColumns === 2 ? 'active' : ''}`}
              onClick={() => onGridColumnsChange(2)}
              title="2 Columns"
            >
              <Layout2Icon />
            </button>
            <button
              className={`icon-btn ${gridColumns === 4 ? 'active' : ''}`}
              onClick={() => onGridColumnsChange(4)}
              title="4 Columns"
            >
              <Layout4Icon />
            </button>
          </div>
        </div>
      </div>

      <div className="studio-content">
        {artifacts.length === 0 ? (
          <div className="studio-empty">
            <SparklesIcon />
            <p>Studio Ready</p>
            <span>Select a template to begin generation:</span>
            <div className="studio-options-grid">
              {INITIAL_PLACEHOLDERS.map((ph, idx) => (
                <button
                  key={idx}
                  className="studio-option-btn"
                  onClick={() => onSendDesignPrompt(ph)}
                  disabled={isLoading}
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`studio-grid cols-${gridColumns}`}>
            {artifacts.map((art, index) => (
              <div key={art.id} className="studio-item-wrapper">
                <ArtifactCard
                  artifact={art}
                  isFocused={focusedArtifactIndex === index}
                  onClick={() => {
                    onArtifactClick(index);
                    if (art.type === 'ui' || art.type === 'chart') {
                      onShowCode(art.content);
                    }
                  }}
                />
                <div className="studio-item-actions">
                  {art.type === 'ui' && (
                    <button
                      onClick={() => onGenerateVariations(art.id)}
                      className="studio-action-btn"
                    >
                      <SparklesIcon /> Var
                    </button>
                  )}
                  {(art.type === 'ui' || art.type === 'chart') && (
                    <button
                      onClick={() => onShowCode(art.content)}
                      className="studio-action-btn"
                    >
                      <CodeIcon /> Code
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioPanel;
