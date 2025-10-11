/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        viridian: '#6b9080',
        'cambridge-blue': '#a4c3b2',
        'mint-green': '#cce3de',
        'azure-web': '#eaf4f4',
        'mint-cream': '#f6fff8',
      },
    },
  },
  plugins: [],
}
