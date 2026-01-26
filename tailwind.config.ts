import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Premium Dark UI - Brand Colors
        brand: {
          primary: '#FF0099',      // Hot pink - main CTAs, key actions
          secondary: '#00ABFF',    // Electric blue - secondary actions
          accent: '#FFD700',       // Gold - achievements, stars
          success: '#00D68F',      // Mint green - progress, success states
          warning: '#FF6B35',      // Warm orange - alerts, warnings
        },
        // Surface Colors (Dark Theme)
        surface: {
          0: '#0a0a0f',            // Deepest background
          1: '#121217',            // Main background
          2: '#1a1a22',            // Card backgrounds
          3: '#24242e',            // Elevated elements
          4: '#2e2e3a',            // Hover states
        },
        // Text Colors
        text: {
          primary: '#FFFFFF',      // Main text
          secondary: '#A0A0B0',    // Muted text
          tertiary: '#6B6B7B',     // Subtle text
          inverse: '#0a0a0f',      // Text on light backgrounds
        },
        // Border Colors
        border: {
          subtle: '#2a2a35',       // Subtle borders
          default: '#3a3a48',      // Default borders
          strong: '#4a4a58',       // Emphasized borders
        },
        // Legacy colors for backward compatibility
        primary: {
          50: '#fff0f7',
          100: '#ffe0ef',
          200: '#ffc0df',
          300: '#ff8fc7',
          400: '#ff4da6',
          500: '#FF0099',
          600: '#e6008a',
          700: '#cc007a',
          800: '#a60064',
          900: '#800050',
        },
        secondary: {
          50: '#f0faff',
          100: '#e0f5ff',
          200: '#b8e8ff',
          300: '#7ad6ff',
          400: '#33c0ff',
          500: '#00ABFF',
          600: '#0099e6',
          700: '#0080bf',
          800: '#006699',
          900: '#004d73',
        },
        accent: {
          50: '#fffef0',
          100: '#fffbd6',
          200: '#fff5a3',
          300: '#ffed66',
          400: '#ffe433',
          500: '#FFD700',
          600: '#e6c200',
          700: '#b89900',
          800: '#8a7300',
          900: '#5c4d00',
        },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        reading: ['Lexend', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(255, 0, 153, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 171, 255, 0.3)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'reading': '0 4px 24px rgba(0, 0, 0, 0.5)',
        'elevated': '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 0, 153, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 0, 153, 0.4)' },
        },
      },
      minHeight: {
        'touch': '44px',          // Minimum touch target size
      },
      minWidth: {
        'touch': '44px',          // Minimum touch target size
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'input': '8px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-premium': 'linear-gradient(135deg, #FF0099 0%, #00ABFF 100%)',
        'gradient-gold': 'linear-gradient(135deg, #FFD700 0%, #FF6B35 100%)',
        'gradient-dark': 'linear-gradient(180deg, #121217 0%, #0a0a0f 100%)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};

export default config;
