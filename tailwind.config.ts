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
        // CYBER-NOIR PALETTE
        // Backgrounds
        oled: '#050505',      // The Void (Primary BG)
        carbon: '#0A0A0A',    // Secondary surfaces
        steel: '#121212',     // Tertiary / Borders

        // Accents
        cyan: {
          DEFAULT: '#00F0FF', // "Electric Cyan" - Primary Action/Focus
          dim: 'rgba(0, 240, 255, 0.1)',
          glow: 'rgba(0, 240, 255, 0.5)',
        },

        // Semantic Status
        privilege: '#FF3D00', // "Aegis Red" - Attorney Client Privilege
        amber: '#FFAB00',     // "Silence Protocol" - Low Confidence
        emerald: '#10B981',   // Verified / Safe

        // UI Borders
        border: 'rgba(255, 255, 255, 0.1)',
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
      },
      animation: {
        'pulse-intense': 'pulse-intense 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
export default config
