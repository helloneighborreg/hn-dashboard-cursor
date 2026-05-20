/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBF5FA',
          100: '#D4EAF5',
          200: '#A8D4EB',
          300: '#7BBFDE',
          400: '#5BAECF',
          500: '#5B9AB8',   // primary — speech-bubble teal
          600: '#4A7D96',
          700: '#3A6278',
          800: '#2A4858',
          900: '#1A2F3A',
        },
        dark:    '#1F2937',
        surface: '#FFFFFF',
        muted:   '#6B7280',
        border:  '#E5E7EB',
        bg:      '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
};
