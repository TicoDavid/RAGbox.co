'use client'

import React from 'react'

// Base props for all icons
interface IconProps {
  className?: string
  size?: number
  color?: string
}

const defaultProps = {
  size: 20,
  color: 'var(--text-tertiary)', // Sterling Silver (theme-aware)
}

// CEO - Crown/Apex (Authority)
export function CrownIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Apex triangle with crown points */}
      <path
        d="M12 3L15 8L20 6L18 12H6L4 6L9 8L12 3Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crown base */}
      <path
        d="M6 12H18V15C18 16.1046 17.1046 17 16 17H8C6.89543 17 6 16.1046 6 15V12Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Authority node at apex */}
      <circle cx="12" cy="3" r="1.5" fill={color} />
      {/* Side gems */}
      <circle cx="4" cy="6" r="1" fill={color} />
      <circle cx="20" cy="6" r="1" fill={color} />
    </svg>
  )
}

// CFO - Diamond Vault (Financial Security)
export function VaultDiamondIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Diamond shape */}
      <path
        d="M12 2L22 12L12 22L2 12L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner vault lines */}
      <path
        d="M12 6L18 12L12 18L6 12L12 6Z"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* Central lock */}
      <circle cx="12" cy="12" r="2" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="10" x2="12" y2="8" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// COO - Network System (Operations)
export function NetworkSystemIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Central hub */}
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
      {/* Outer nodes */}
      <circle cx="12" cy="4" r="2" stroke={color} strokeWidth="1.5" />
      <circle cx="5" cy="18" r="2" stroke={color} strokeWidth="1.5" />
      <circle cx="19" cy="18" r="2" stroke={color} strokeWidth="1.5" />
      {/* Connection lines */}
      <line x1="12" y1="9" x2="12" y2="6" stroke={color} strokeWidth="1.5" />
      <line x1="9.5" y1="14" x2="6.5" y2="16.5" stroke={color} strokeWidth="1.5" />
      <line x1="14.5" y1="14" x2="17.5" y2="16.5" stroke={color} strokeWidth="1.5" />
      {/* Inner rotation indicator */}
      <path
        d="M10 12C10 10.8954 10.8954 10 12 10"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

// CPO - Precision Scope (Focus)
export function ScopeIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.5" />
      {/* Crosshairs */}
      <line x1="12" y1="2" x2="12" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="7" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="2" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="0.5" fill={color} />
    </svg>
  )
}

// CMO - Broadcast Signal (Reach)
export function BroadcastIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Signal source */}
      <circle cx="12" cy="18" r="2" stroke={color} strokeWidth="1.5" />
      {/* Concentric arcs */}
      <path
        d="M8 14C9.10457 12.8954 10.4477 12 12 12C13.5523 12 14.8954 12.8954 16 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 11C7.20914 8.79086 9.45304 7 12 7C14.547 7 16.7909 8.79086 19 11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M2 8C5.31371 4.68629 8.44772 3 12 3C15.5523 3 18.6863 4.68629 22 8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// CTO - Circuit Node (Technology)
export function CircuitNodeIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Hexagonal core */}
      <path
        d="M12 4L18 8V16L12 20L6 16V8L12 4Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner circuit lines */}
      <path
        d="M12 8L15 10V14L12 16L9 14V10L12 8Z"
        stroke={color}
        strokeWidth="1"
        opacity="0.6"
      />
      {/* Center processor */}
      <circle cx="12" cy="12" r="2" fill={color} opacity="0.8" />
      {/* Connection nodes */}
      <circle cx="12" cy="4" r="1" fill={color} />
      <circle cx="18" cy="8" r="1" fill={color} />
      <circle cx="18" cy="16" r="1" fill={color} />
      <circle cx="12" cy="20" r="1" fill={color} />
      <circle cx="6" cy="16" r="1" fill={color} />
      <circle cx="6" cy="8" r="1" fill={color} />
    </svg>
  )
}

// Legal - Balance Scale (Justice)
export function ScaleIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Central pillar */}
      <line x1="12" y1="3" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Balance beam */}
      <line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Left pan */}
      <path
        d="M4 7L2 13H8L6 7"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 13C2 14.5 3.5 15 5 15C6.5 15 8 14.5 8 13" stroke={color} strokeWidth="1.5" />
      {/* Right pan */}
      <path
        d="M18 7L16 13H22L20 7"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 13C16 14.5 17.5 15 19 15C20.5 15 22 14.5 22 13" stroke={color} strokeWidth="1.5" />
      {/* Top ornament */}
      <circle cx="12" cy="3" r="1.5" fill={color} />
      {/* Base */}
      <path d="M8 21H16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// Compliance - Clipboard Check (Adherence)
export function ComplianceIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Clipboard body */}
      <path
        d="M16 4H18C19.1046 4 20 4.89543 20 6V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V6C4 4.89543 4.89543 4 6 4H8"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Clip top */}
      <path
        d="M8 4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V5H8V4Z"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Check mark */}
      <path
        d="M8 13L11 16L16 10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Auditor - Magnifying Analysis (Investigation)
export function AuditorIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Magnifying glass */}
      <circle cx="10" cy="10" r="6" stroke={color} strokeWidth="1.5" />
      <line x1="14.5" y1="14.5" x2="20" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Analysis lines inside */}
      <line x1="7" y1="8" x2="13" y2="8" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <line x1="7" y1="10" x2="11" y2="10" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <line x1="7" y1="12" x2="12" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

// Whistleblower - Lantern/Searchlight (Forensic)
export function LanternIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Lantern body */}
      <path
        d="M8 8H16V18C16 19.1046 15.1046 20 14 20H10C8.89543 20 8 19.1046 8 18V8Z"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Lantern top */}
      <path
        d="M10 8V6C10 4.89543 10.8954 4 12 4C13.1046 4 14 4.89543 14 6V8"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Handle */}
      <path
        d="M9 4H15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="12" y1="2" x2="12" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Light rays */}
      <path d="M12 12L8 16" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M12 12L16 16" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M12 12V17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* Flame/light */}
      <ellipse cx="12" cy="11" rx="2" ry="1.5" fill={color} opacity="0.6" />
    </svg>
  )
}

// Privilege - Shield with Lightning (Override)
export function PrivilegeKeyIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Shield outline */}
      <path
        d="M12 2L4 6V11C4 16.5 7.5 21 12 22C16.5 21 20 16.5 20 11V6L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lightning bolt */}
      <path
        d="M13 7L10 12H14L11 17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Profile/Identity icon
export function IdentityIcon({ className, size = defaultProps.size, color = defaultProps.color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* Hexagonal frame */}
      <path
        d="M12 2L20 7V17L12 22L4 17V7L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* User silhouette */}
      <circle cx="12" cy="9" r="3" stroke={color} strokeWidth="1.5" />
      <path
        d="M7 18C7 15.2386 9.23858 13 12 13C14.7614 13 17 15.2386 17 18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

