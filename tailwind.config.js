/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bengali: ['"Galada"', '"Noto Sans Bengali"', 'cursive', 'sans-serif'],
        tagline: ['"Poppins"', '"DM Serif Display"', 'sans-serif'],
      },
      keyframes: {
        blink: {
          '50%': { opacity: '0' },
        },
        'online-pulse': {
          '0%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.4)' },
          '100%': { opacity: '0.55', transform: 'scale(1)' },
        },
        'overlay-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'overlay-scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'bg-fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-start infinite',
        'online-pulse': 'online-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'overlay-fade-in': 'overlay-fade-in 0.25s ease-out forwards',
        'overlay-scale-in': 'overlay-scale-in 0.25s ease-out forwards',
        'bg-fade-out': 'bg-fade-out 1.5s ease-in-out forwards',
      },
    },
  },
  plugins: [],
}
