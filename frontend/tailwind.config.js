/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          blue: '#0a2e73',
          'blue-light': '#1c6fb8',
          red: '#f2d335',
          white: '#ffffff',
          surface: '#eef7ff',
        },
      },
    },
  },
  plugins: [],
};
