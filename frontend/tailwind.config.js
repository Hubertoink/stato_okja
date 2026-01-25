/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        viridian: '#5B6CFF',
        'cambridge-blue': '#7C8FFF',
        'mint-green': '#E8EBFF',
        'azure-web': '#F5F7FF',
        'mint-cream': '#FAFBFF',
        // Modern accent colors
        'accent-orange': '#FF9F43',
        'accent-green': '#28C76F',
        'accent-pink': '#EA5455',
        'accent-teal': '#00CFE8',
        'accent-purple': '#9F7AEA',
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'modern': '0 4px 24px rgba(91, 108, 255, 0.08)',
        'modern-lg': '0 8px 32px rgba(91, 108, 255, 0.12)',
        'glow': '0 0 20px rgba(91, 108, 255, 0.2)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #5B6CFF 0%, #7C8FFF 100%)',
        'gradient-accent': 'linear-gradient(135deg, #FF9F43 0%, #FFB976 100%)',
        'gradient-success': 'linear-gradient(135deg, #28C76F 0%, #48DA89 100%)',
        'gradient-purple': 'linear-gradient(135deg, #9F7AEA 0%, #B794F6 100%)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
