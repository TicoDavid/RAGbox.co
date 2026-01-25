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
        <div className="user-avatar-placeholder">
          {userImage ? (
            <img
              src={userImage}
              alt={userName || 'User'}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
