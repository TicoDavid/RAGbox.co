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
        // OLED Void - Dark mode backgrounds
        void: {
          DEFAULT: '#050505',
          card: '#0A0A0A',
          elevated: '#111111',
        },
        // Premium Bond Paper - Light mode backgrounds
        paper: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          muted: '#F1F5F9',
        },
        // Trust indicators
        trust: {
          high: '#22c55e',
          medium: '#eab308',
          low: '#ef4444',
        },
      },
      fontFamily: {
        // System font stacks (Google Fonts unavailable in build environment)
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Consolas',
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
        'slide-toggle': 'slide-toggle 0.2s ease-out',
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
        'slide-toggle': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px rgba(37, 99, 235, 0.3)',
        'glow': '0 0 30px -5px rgba(37, 99, 235, 0.4)',
        'glow-lg': '0 0 50px -10px rgba(37, 99, 235, 0.5)',
        'glow-intense': '0 0 60px -5px rgba(37, 99, 235, 0.7)',
        'soft': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 10px 50px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
export default config
