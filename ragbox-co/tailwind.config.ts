import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Cyber-Noir Color Palette
      colors: {
        // Core Colors
        background: "#050505",
        foreground: "#FFFFFF",
        
        // Brand Colors
        primary: {
          DEFAULT: "#00F0FF",
          foreground: "#050505",
          50: "#E0FDFF",
          100: "#B3FAFF",
          200: "#80F5FF",
          300: "#4DF0FF",
          400: "#1AEBFF",
          500: "#00F0FF",
          600: "#00C0CC",
          700: "#009099",
          800: "#006066",
          900: "#003033",
        },
        
        // Warning (Amber) - Low Confidence
        warning: {
          DEFAULT: "#FFAB00",
          foreground: "#050505",
          50: "#FFF8E0",
          100: "#FFEDB3",
          200: "#FFE080",
          300: "#FFD34D",
          400: "#FFC61A",
          500: "#FFAB00",
          600: "#CC8900",
          700: "#996600",
          800: "#664400",
          900: "#332200",
        },
        
        // Danger (Red) - Privilege Mode
        danger: {
          DEFAULT: "#FF3D00",
          foreground: "#FFFFFF",
          50: "#FFE8E0",
          100: "#FFCDB3",
          200: "#FFAE80",
          300: "#FF8F4D",
          400: "#FF701A",
          500: "#FF3D00",
          600: "#CC3100",
          700: "#992500",
          800: "#661800",
          900: "#330C00",
        },
        
        // Neutral
        muted: {
          DEFAULT: "#888888",
          foreground: "#FFFFFF",
        },
        
        // Border
        border: "#333333",
        
        // Card
        card: {
          DEFAULT: "rgba(0, 0, 0, 0.5)",
          foreground: "#FFFFFF",
        },
      },
      
      // Typography
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      
      // Custom Animations
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "border-pulse": "border-pulse 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "constellation": "constellation 20s linear infinite",
        "glitch": "glitch 0.3s ease-in-out",
        "breathe": "breathe 4s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(0, 240, 255, 0.3)",
          },
          "50%": {
            boxShadow: "0 0 40px rgba(0, 240, 255, 0.6)",
          },
        },
        "border-pulse": {
          "0%, 100%": {
            borderColor: "rgba(255, 61, 0, 0.5)",
          },
          "50%": {
            borderColor: "rgba(255, 61, 0, 1)",
          },
        },
        "float": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },
        "constellation": {
          "0%": {
            transform: "rotate(0deg)",
          },
          "100%": {
            transform: "rotate(360deg)",
          },
        },
        "glitch": {
          "0%": {
            transform: "translate(0)",
          },
          "20%": {
            transform: "translate(-2px, 2px)",
          },
          "40%": {
            transform: "translate(-2px, -2px)",
          },
          "60%": {
            transform: "translate(2px, 2px)",
          },
          "80%": {
            transform: "translate(2px, -2px)",
          },
          "100%": {
            transform: "translate(0)",
          },
        },
        "breathe": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: "1",
          },
          "50%": {
            transform: "scale(1.02)",
            opacity: "0.9",
          },
        },
      },
      
      // Box Shadow (Glow Effects)
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0, 240, 255, 0.3)",
        "glow-cyan-lg": "0 0 40px rgba(0, 240, 255, 0.5)",
        "glow-amber": "0 0 20px rgba(255, 171, 0, 0.3)",
        "glow-red": "0 0 20px rgba(255, 61, 0, 0.3)",
        "glow-red-lg": "0 0 40px rgba(255, 61, 0, 0.5)",
      },
      
      // Backdrop Blur
      backdropBlur: {
        xs: "2px",
      },
      
      // Background Image (Gradient Mesh)
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mesh-gradient": "url('/mesh-gradient.svg')",
      },
    },
  },
  plugins: [],
};

export default config;
