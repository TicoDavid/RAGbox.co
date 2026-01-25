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
        // Grok-style: Pure OLED Black / Ceramic White
        void: {
          DEFAULT: '#000000',
          card: '#0A0A0A',
          elevated: '#111111',
        },
        ceramic: {
          DEFAULT: '#FFFFFF',
          card: '#FAFAFA',
          muted: '#F5F5F5',
        },
        // Light mode paper colors (aliases for ceramic)
        paper: {
          DEFAULT: '#FFFFFF',
          card: '#FAFAFA',
          muted: '#F5F5F5',
        },
        // RAGbox Electric Blue - primary brand color
        electric: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0044ff',
        },
        // Privilege Red - Attorney Client Privilege
        privilege: {
          DEFAULT: '#dc2626',
          light: '#fef2f2',
          dark: '#450a0a',
        },
        // Trust indicators
        trust: {
          high: '#22c55e',
          medium: '#eab308',
          low: '#ef4444',
        },
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
          '0%, 100%': { borderColor: 'rgba(37, 99, 235, 0.4)' },
          '50%': { borderColor: 'rgba(37, 99, 235, 1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(37, 99, 235, 0.3)',
        'glow': '0 0 30px -5px rgba(37, 99, 235, 0.4)',
        'glow-lg': '0 0 50px -10px rgba(37, 99, 235, 0.5)',
        'glow-intense': '0 0 50px 0px rgba(37, 99, 235, 0.6)',
        'privilege': '0 0 20px -5px rgba(220, 38, 38, 0.5)',
      },
    },
  },
  plugins: [],
}
export default config
