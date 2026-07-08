import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: 'hsl(43 74% 49%)',
          50: 'hsl(43 74% 97%)',
          100: 'hsl(43 74% 92%)',
          200: 'hsl(43 74% 82%)',
          300: 'hsl(43 74% 72%)',
          400: 'hsl(43 74% 60%)',
          500: 'hsl(43 74% 49%)',
          600: 'hsl(43 74% 42%)',
          700: 'hsl(43 74% 35%)',
          800: 'hsl(43 74% 28%)',
          900: 'hsl(43 74% 20%)',
        },
        luxury: {
          white: 'hsl(40 33% 98%)',
          cream: 'hsl(40 25% 96%)',
          charcoal: 'hsl(220 15% 18%)',
          slate: 'hsl(220 10% 40%)',
          border: 'hsl(40 20% 90%)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 4px 24px -4px hsl(43 74% 49% / 0.12)',
        card: '0 1px 3px hsl(220 15% 18% / 0.06), 0 8px 24px -8px hsl(220 15% 18% / 0.08)',
        'gold-glow': '0 0 40px -8px hsl(43 74% 49% / 0.35)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, hsl(43 74% 55%) 0%, hsl(43 74% 42%) 100%)',
        'luxury-gradient': 'linear-gradient(180deg, hsl(40 33% 99%) 0%, hsl(40 25% 96%) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
