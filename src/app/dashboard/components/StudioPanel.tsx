"use client";

import React from 'react';
import type { Artifact, StudioMode, ForgeContext } from '../types';
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
import { getInsightTypeName } from '../insight-detection';

interface StudioPanelProps {
  artifacts: Artifact[];
  studioMode: StudioMode;
  gridColumns: 1 | 2 | 4;
  focusedArtifactIndex: number | null;
  isLoading: boolean;
  forgeContext?: ForgeContext;
  onStudioModeChange: (mode: StudioMode) => void;
  onGridColumnsChange: (cols: 1 | 2 | 4) => void;
  onArtifactClick: (index: number) => void;
  onGenerateVariations: (artifactId: string) => void;
  onShowCode: (content: string) => void;
  onSendDesignPrompt: (prompt: string) => void;
}

// Sovereign Forge Module Icons
const VideoLensIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="2"/>
    <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.6"/>
    <polygon points="22,20 22,28 28,24" fill="currentColor"/>
  </svg>
);

const DataVizIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 36 L16 28 L24 32 L32 18 L40 22" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="16" cy="28" r="3" fill="currentColor"/>
    <circle cx="24" cy="32" r="3" fill="currentColor"/>
    <circle cx="32" cy="18" r="3" fill="currentColor"/>
    <path d="M36 36 A12 12 0 0 1 36 12" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    <path d="M40 30 L40 24 L34 24" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const VisionCodeIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="24" rx="16" ry="10" stroke="currentColor" strokeWidth="2"/>
    <circle cx="24" cy="24" r="5" stroke="currentColor" strokeWidth="2"/>
    <circle cx="24" cy="24" r="2" fill="currentColor"/>
    <text x="10" y="42" fontSize="10" fill="currentColor" fontFamily="monospace">&lt;/&gt;</text>
  </svg>
);

const ImageStackIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="14" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <rect x="10" y="10" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    <rect x="14" y="6" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="22" cy="12" r="3" fill="currentColor" opacity="0.6"/>
    <path d="M14 22 L22 16 L30 22 L38 14" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const DashboardIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <rect x="26" y="6" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
    <rect x="6" y="22" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
    <rect x="26" y="28" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <line x1="10" y1="30" x2="18" y2="30" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    <line x1="10" y1="34" x2="16" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
  </svg>
);

const TerminalIcon = () => (
  <svg className="forge-module-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2"/>
    <line x1="6" y1="16" x2="42" y2="16" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <text x="12" y="30" fontSize="14" fill="currentColor" fontFamily="monospace">&gt;_</text>
    <rect x="26" y="24" width="10" height="2" fill="currentColor" opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite"/>
    </rect>
  </svg>
);

const CrucibleIcon = () => (
  <svg className="forge-crucible-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer ring */}
    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1" opacity="0.3"/>

    {/* Data streams */}
    <path d="M20 20 L40 40 L60 20" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
    <path d="M20 60 L40 40 L60 60" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
    <path d="M10 40 L40 40 L70 40" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>

    {/* Central hexagon */}
    <polygon
      points="40,18 54,29 54,51 40,62 26,51 26,29"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />

    {/* Inner core */}
    <circle cx="40" cy="40" r="10" stroke="currentColor" strokeWidth="2"/>
    <circle cx="40" cy="40" r="5" fill="currentColor" opacity="0.6">
      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite"/>
    </circle>

    {/* Connection nodes */}
    <circle cx="40" cy="18" r="3" fill="currentColor"/>
    <circle cx="54" cy="29" r="3" fill="currentColor"/>
    <circle cx="54" cy="51" r="3" fill="currentColor"/>
    <circle cx="40" cy="62" r="3" fill="currentColor"/>
    <circle cx="26" cy="51" r="3" fill="currentColor"/>
    <circle cx="26" cy="29" r="3" fill="currentColor"/>
  </svg>
);

// Intel Received Animation Component
interface IntelReceivedAnimationProps {
  title: string;
  progress: number;
  insightType?: string;
}

const getStatusText = (progress: number): string => {
  if (progress < 20) return 'Receiving intelligence data...';
  if (progress < 40) return 'Parsing insight context...';
  if (progress < 60) return 'Initializing artifact forge...';
  if (progress < 80) return 'Generating artifact...';
  if (progress < 100) return 'Finalizing output...';
  return 'Complete';
};

const IntelReceivedAnimation: React.FC<IntelReceivedAnimationProps> = ({ title, progress, insightType }) => {
  return (
    <div className="forge-intel-received">
      {/* Pulse ring effect */}
      <div className="intel-pulse-container">
        <div className="intel-pulse-ring" />
        <div className="intel-pulse-ring delay-1" />
        <div className="intel-pulse-ring delay-2" />
      </div>

      {/* Data streams */}
      <div className="intel-data-streams">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="intel-data-stream" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>

      {/* Main content */}
      <div className="intel-content">
        <h2 className="intel-headline">INTEL RECEIVED</h2>
        {insightType && (
          <div className="intel-source-badge">
            FROM: {getInsightTypeName(insightType as any).toUpperCase()}
          </div>
        )}
        <h3 className="intel-title">FORGING ARTIFACT: {title}</h3>
        <div className="intel-progress-bar">
          <div className="intel-progress-fill" style={{ width: `${progress}%` }} />
          <div className="intel-progress-shimmer" />
        </div>
        <p className="intel-status">{getStatusText(progress)}</p>
        <div className="intel-percentage">{Math.round(progress)}%</div>
      </div>
    </div>
  );
};

// Module definitions
const FORGE_MODULES = [
  {
    id: 'video',
    icon: VideoLensIcon,
    title: 'SECURE VIDEO BRIEFING',
    description: 'Generate executive summary videos from vault data.',
    prompt: 'Create a secure video briefing summarizing key insights'
  },
  {
    id: 'dataviz',
    icon: DataVizIcon,
    title: 'STRATEGIC DATA VISUALIZATION',
    description: 'Create interactive charts and trend analyses.',
    prompt: 'Generate a strategic data visualization chart'
  },
  {
    id: 'vision',
    icon: VisionCodeIcon,
    title: 'VISION-TO-SECURE CODE',
    description: 'Convert diagrams into compliance-ready UI components.',
    prompt: 'Convert the visual into secure, compliant code'
  },
  {
    id: 'assets',
    icon: ImageStackIcon,
    title: 'BRANDED VISUAL ASSETS',
    description: 'Generate secure infographics and presentation materials.',
    prompt: 'Create branded visual assets for presentation'
  },
  {
    id: 'dashboard',
    icon: DashboardIcon,
    title: 'COMPLIANCE DASHBOARD UI',
    description: 'Build secure, read-only reporting interfaces.',
    prompt: 'Build a compliance dashboard interface'
  },
  {
    id: 'custom',
    icon: TerminalIcon,
    title: 'CUSTOM SOVEREIGN QUERY',
    description: 'Execute complex, multi-modal Gemini operations.',
    prompt: 'Execute custom sovereign intelligence query'
  }
];

const StudioPanel: React.FC<StudioPanelProps> = ({
  artifacts,
  studioMode,
  gridColumns,
  focusedArtifactIndex,
  isLoading,
  forgeContext,
  onStudioModeChange,
  onGridColumnsChange,
  onArtifactClick,
  onGenerateVariations,
  onShowCode,
  onSendDesignPrompt
}) => {
  // Determine what to show based on forge state
  const showIntelAnimation = forgeContext && (forgeContext.state === 'receiving_intel' || forgeContext.state === 'forging');
  const showEmptyState = artifacts.length === 0 && !showIntelAnimation;
  const showArtifacts = artifacts.length > 0 && !showIntelAnimation;

  return (
    <div className="panel studio-panel sovereign-forge">
      {/* Circuit board background pattern */}
      <div className="forge-circuit-bg" aria-hidden="true" />

      <div className="panel-header forge-header">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h3 className="forge-title">FORGE</h3>
          <div className="studio-mode-selector forge-mode-selector">
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

      <div className="studio-content forge-content">
        {/* Intel Received Animation */}
        {showIntelAnimation && forgeContext && (
          <IntelReceivedAnimation
            title={forgeContext.animationTitle}
            progress={forgeContext.progress}
            insightType={forgeContext.incomingPayload?.context_data.insight_type}
          />
        )}

        {/* Empty State */}
        {showEmptyState && (
          <div className="forge-empty-state">
            {/* Hero Section */}
            <div className="forge-hero">
              <CrucibleIcon />
              <h2 className="forge-hero-title">SOVEREIGN ARTIFACT FORGE</h2>
              <p className="forge-hero-subtitle">
                Securely generate high-fidelity assets via Gemini API. Select a generation vector below.
              </p>
            </div>

            {/* Module Grid */}
            <div className="forge-module-grid">
              {FORGE_MODULES.map((module) => (
                <button
                  key={module.id}
                  className="forge-module-card"
                  onClick={() => onSendDesignPrompt(module.prompt)}
                  disabled={isLoading}
                >
                  <div className="forge-module-icon-wrapper">
                    <module.icon />
                  </div>
                  <h4 className="forge-module-title">{module.title}</h4>
                  <p className="forge-module-desc">{module.description}</p>
                  <div className="forge-module-glow" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Artifacts Grid */}
        {showArtifacts && (
          <div className={`studio-grid cols-${gridColumns}`}>
            {artifacts.map((art, index) => (
              <div key={art.id} className={`studio-item-wrapper ${art.sourceInsightId ? 'from-insight' : ''}`}>
                {art.sourceInsightId && (
                  <div className="artifact-source-badge">
                    <SparklesIcon /> Forged from Insight
                  </div>
                )}
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
