/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        gold: {
          50:  '#FFFBEB',
          100: '#FEF5D3',
          200: '#FDEAA6',
          300: '#F8D76E',
          400: '#E8C84A',
          500: '#D4AF37',
          600: '#C9A84C',
          700: '#A07830',
          800: '#7A5C20',
          900: '#5C4400',
        },
        charcoal: {
          50:  '#F5F5F5',
          100: '#E8E8E8',
          200: '#D0D0D0',
          300: '#A8A8A8',
          400: '#808080',
          500: '#555555',
          600: '#3D3D3D',
          700: '#2E2E2E',
          800: '#1A1A1A',
          900: '#0F0F0F',
        },
      },
    },
  },
  plugins: [],
};
