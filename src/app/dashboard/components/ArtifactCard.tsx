"use client";

import React, { useEffect, useRef, memo } from 'react';
import type { Artifact } from '../types';

interface ArtifactCardProps {
  artifact: Artifact;
  isFocused: boolean;
  onClick: () => void;
}

const ArtifactCard = memo(({ artifact, isFocused, onClick }: ArtifactCardProps) => {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [artifact.content]);

  const isBlurring = artifact.status === 'streaming' || artifact.status === 'generating';

  const renderContent = () => {
    if (artifact.type === 'image') {
      if (artifact.status === 'generating') {
        return (
          <div className="media-placeholder">
            <div className="pulse-circle"></div>
            <span>Fabricating Asset...</span>
          </div>
        );
      }
      return (
        <img
          src={artifact.content.startsWith('data:') ? artifact.content : `data:image/png;base64,${artifact.content}`}
          alt={artifact.title}
          className="artifact-media"
        />
      );
    }

    if (artifact.type === 'video') {
      if (artifact.status === 'generating') {
        return (
          <div className="media-placeholder">
            <div className="pulse-circle cyan"></div>
            <span>Rendering Motion...</span>
          </div>
        );
      }
      return (
        <video
          src={artifact.content}
          controls
          loop
          autoPlay
          muted
          className="artifact-media"
        />
      );
    }

    // Default: HTML/UI/Chart (iframe)
    return (
      <>
        {isBlurring && artifact.status === 'streaming' && (
          <div className="generating-overlay">
            <pre ref={codeRef} className="code-stream-preview">
              {artifact.content}
            </pre>
          </div>
        )}
        <iframe
          srcDoc={artifact.content}
          title={artifact.id}
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
          className="artifact-iframe"
        />
      </>
    );
  };

  return (
    <div
      className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''}`}
      onClick={onClick}
    >
      <div className="artifact-header">
        <span className="artifact-style-tag">{artifact.styleName}</span>
        <span className="artifact-type-badge">{artifact.type.toUpperCase()}</span>
      </div>
      <div className="artifact-card-inner">
        {renderContent()}
      </div>
    </div>
  );
});

ArtifactCard.displayName = 'ArtifactCard';

export default ArtifactCard;
