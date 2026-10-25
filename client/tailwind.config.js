/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdcff',
          300: '#8ec8ff',
          400: '#59a9ff',
          500: '#2f86f6',
          600: '#1a6bea',
          700: '#1856d6',
          800: '#1a47ad',
          900: '#1b3f88',
          950: '#142a57',
        },
        accent: {
          50: '#effcfb',
          100: '#c9f7f2',
          200: '#95eee7',
          300: '#58ded7',
          400: '#28c5c1',
          500: '#12a8a7',
          600: '#0b878a',
          700: '#0d6b6e',
          800: '#105659',
          900: '#12484b',
          950: '#042f32',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        sand: {
          50: '#f6f8fb',
          100: '#eef3f9',
          200: '#e0e9f3',
          300: '#cbd8e8',
          400: '#a9bcd4',
          500: '#879cb8',
          600: '#6f839e',
          700: '#5a6c85',
          800: '#4a5a70',
          900: '#3c495c',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px -24px rgba(20, 42, 87, 0.28)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px -22px rgba(20, 42, 87, 0.22)',
        lift: '0 22px 55px -30px rgba(20, 42, 87, 0.35)',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(circle at 12% 15%, rgba(47, 134, 246, 0.16), transparent 42%), radial-gradient(circle at 88% 10%, rgba(18, 168, 167, 0.14), transparent 38%)',
        'brand-gradient': 'linear-gradient(120deg, #1856d6 0%, #1a6bea 45%, #12a8a7 100%)',
        'soft-grid':
          'linear-gradient(rgba(47, 134, 246, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(47, 134, 246, 0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '28px 28px',
      },
    },
  },
  plugins: [],
};
