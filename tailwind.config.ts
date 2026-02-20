import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // MIDNIGHT COBALT PALETTE - Sovereign Tier
        // Backgrounds
        midnight: '#0A192F',    // Primary BG - Midnight Cobalt
        navy: '#112240',        // Secondary surfaces - Deep Navy
        cobalt: '#1B2D4B',      // Tertiary / Inputs - Lighter Navy
        elevated: '#233554',    // Hover states / Dropdowns

        // Accents
        royal: {
          DEFAULT: '#2463EB',   // Royal Cobalt - Primary Action
          hover: '#60A5FA',     // Sky Cobalt - Hover
          dim: 'rgba(36, 99, 235, 0.1)',
          glow: 'rgba(36, 99, 235, 0.5)',
        },

        // Semantic Status
        privilege: '#f59e0b',   // Amber - Attorney Client Privilege
        amber: '#f59e0b',       // Amber - Warning
        emerald: '#10B981',     // Verified / Safe
        danger: '#ef4444',      // Red - Error

        // Text
        frosted: '#E5E7EB',     // Frosted Silver - Primary text
        sterling: '#C0C0C0',    // Sterling Silver - Secondary text

        // UI Borders
        border: {
          DEFAULT: '#233554',   // Deep Cobalt Border
          subtle: '#162C4E',
          strong: '#2D4A6F',
        },

        // Theme-aware aliases (use CSS variables)
        theme: {
          bg: 'var(--bg-primary)',
          'bg-secondary': 'var(--bg-secondary)',
          'bg-elevated': 'var(--bg-elevated)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          accent: 'var(--brand-blue)',
          border: 'var(--border-default)',
        },
      },
      fontFamily: {
        // The Typography Trinity
        header: ['var(--font-space)', 'sans-serif'], // Space Grotesk (Authority)
        sans: ['var(--font-inter)', 'sans-serif'],   // Inter (Readability)
        mono: ['var(--font-jetbrains)', 'monospace'], // JetBrains Mono (Truth/Logs)
        jakarta: ['var(--font-jakarta)', 'sans-serif'], // Plus Jakarta Sans (Dashboard v2)
      },
      boxShadow: {
        'cyan-glow': '0 0 10px rgba(0, 240, 255, 0.3)',
        'red-pulse': '0 0 15px rgba(255, 61, 0, 0.4)',
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
      },
      keyframes: {
        'pulse-intense': {
          '0%, 100%': {
            opacity: '0.6',
            transform: 'scale(1.25)',
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.4)',
          },
        },
        orbPulse: {
          '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' },
          '50%': { transform: 'translate(-50%, -50%) scale(1.05)' },
        },
      },
      animation: {
        'pulse-intense': 'pulse-intense 1s ease-in-out infinite',
        'orb-pulse': 'orbPulse 4s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
export default config
