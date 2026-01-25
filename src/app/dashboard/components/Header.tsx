"use client";

import React from 'react';
import { SearchIcon, SettingsIcon, MoonIcon, SunIcon } from './Icons';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  userImage?: string | null;
  userName?: string | null;
}

// Sovereign Placeholder Avatar - Encrypted Identity Pattern
const SovereignPlaceholder = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="sovereign-avatar-placeholder"
  >
    {/* Background circle with brushed metal effect */}
    <circle cx="16" cy="16" r="15" fill="url(#brushedMetal)" stroke="rgba(0,0,255,0.3)" strokeWidth="1"/>

    {/* Hexagonal grid pattern forming head silhouette */}
    <defs>
      <linearGradient id="brushedMetal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1a1a1f"/>
        <stop offset="50%" stopColor="#252528"/>
        <stop offset="100%" stopColor="#1a1a1f"/>
      </linearGradient>
      <linearGradient id="glowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0000FF" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#0000FF" stopOpacity="0.2"/>
      </linearGradient>
    </defs>

    {/* Head silhouette made of hexagonal pattern */}
    <g opacity="0.8">
      {/* Top row - head */}
      <polygon points="16,6 18,7.5 18,10 16,11.5 14,10 14,7.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.7"/>

      {/* Second row */}
      <polygon points="13,9 15,10.5 15,13 13,14.5 11,13 11,10.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.6"/>
      <polygon points="19,9 21,10.5 21,13 19,14.5 17,13 17,10.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.6"/>

      {/* Third row - face area */}
      <polygon points="16,12 18,13.5 18,16 16,17.5 14,16 14,13.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.8"/>

      {/* Fourth row - neck/shoulders */}
      <polygon points="10,15 12,16.5 12,19 10,20.5 8,19 8,16.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.5"/>
      <polygon points="16,17 18,18.5 18,21 16,22.5 14,21 14,18.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.6"/>
      <polygon points="22,15 24,16.5 24,19 22,20.5 20,19 20,16.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.5"/>

      {/* Bottom row - shoulders */}
      <polygon points="13,20 15,21.5 15,24 13,25.5 11,24 11,21.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.4"/>
      <polygon points="19,20 21,21.5 21,24 19,25.5 17,24 17,21.5" fill="url(#glowGradient)" stroke="#0000FF" strokeWidth="0.5" opacity="0.4"/>
    </g>

    {/* Subtle scan line effect */}
    <line x1="4" y1="16" x2="28" y2="16" stroke="#0000FF" strokeWidth="0.5" opacity="0.3">
      <animate attributeName="y1" values="6;26;6" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="y2" values="6;26;6" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3s" repeatCount="indefinite"/>
    </line>
  </svg>
);

const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  searchTerm,
  onSearchChange,
  userImage,
  userName
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-container">
          <img
            src="https://storage.googleapis.com/connexusai-assets/Primary_RagBoxCo_Colored_Black.png"
            alt="RAGbox Logo"
            className="ragbox-logo"
          />
        </div>
        <div className="breadcrumb">
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-item">Secure Workspace</span>
        </div>
      </div>

      <div className="global-search-container">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search Vaults & Files..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="header-right">
        <button className="header-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="header-btn">
          <SettingsIcon /> Settings
        </button>

        {/* User Avatar with Sovereign Styling */}
        <div className={`user-avatar-container ${userImage ? 'authenticated' : 'placeholder'}`}>
          {userImage ? (
            <img
              src={userImage}
              alt={userName || 'User'}
              className="user-avatar-image"
            />
          ) : (
            <SovereignPlaceholder />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
