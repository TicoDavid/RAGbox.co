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
        // Midnight Cobalt Background System
        void: {
          DEFAULT: '#0A192F',    // Midnight Cobalt - primary bg
          card: '#0F2240',       // Deep Cobalt - secondary bg
          elevated: '#142A4F',   // Steel Cobalt - tertiary bg
        },
        // Legacy aliases for void backgrounds
        oled: '#0A192F',
        carbon: '#0F2240',
        steel: '#142A4F',
        // Light mode surfaces (ceramic/paper)
        ceramic: {
          DEFAULT: '#FFFFFF',
          card: '#FAFAFA',
          muted: '#F5F5F5',
        },
        paper: {
          DEFAULT: '#FFFFFF',
          card: '#FAFAFA',
          muted: '#F5F5F5',
        },
        // Royal Cobalt Primary Accent
        cyan: {
          DEFAULT: '#2463EB',              // Royal Cobalt - primary action
          dim: 'rgba(36, 99, 235, 0.1)',   // Subtle highlights
          glow: 'rgba(36, 99, 235, 0.4)',  // Box-shadow glows
          light: '#60A5FA',                // Sky Cobalt - hover/active
        },
        // Electric Blue Scale (extended palette)
        electric: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',   // Sky Cobalt
          500: '#3b82f6',
          600: '#2463EB',   // Royal Cobalt (primary)
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0A192F',   // Midnight Cobalt
        },
        // Text Colors - Silver System
        frosted: '#E5E7EB',   // Primary text
        sterling: '#C0C0C0',  // Secondary text
        slate: '#8892A4',     // Muted text
        // Privilege Red - Attorney Client Privilege (LOCKED)
        privilege: {
          DEFAULT: '#FF3D00',   // AEGIS Red
          light: '#fef2f2',
          dark: '#450a0a',
        },
        // Semantic Colors (LOCKED)
        amber: '#FFAB00',       // Silence Protocol warnings
        emerald: '#10B981',     // Verified/success states
        // Trust indicators
        trust: {
          high: '#22c55e',
          medium: '#eab308',
          low: '#ef4444',
        },
        // UI Borders
        border: 'rgba(255, 255, 255, 0.1)',
      },
      fontFamily: {
        outfit: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        sans: [
          'var(--font-outfit)',
          'Outfit',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      animation: {
        'breathe': 'breathe 4s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'rgba(36, 99, 235, 0.4)' },
          '50%': { borderColor: 'rgba(36, 99, 235, 1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(36, 99, 235, 0.3)',
        'glow': '0 0 30px -5px rgba(36, 99, 235, 0.4)',
        'glow-lg': '0 0 50px -10px rgba(36, 99, 235, 0.5)',
        'glow-intense': '0 0 50px 0px rgba(36, 99, 235, 0.6)',
        'privilege': '0 0 20px -5px rgba(255, 61, 0, 0.5)',
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}
export default config
