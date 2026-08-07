/**
 * Keeps Tailwind's semantic palette connected to the active CSS theme.
 * Full-color utilities remain CSS2-compatible for exports; opacity variants
 * use color-mix because the theme tokens are hexadecimal CSS custom properties.
 */
const themedColor = (token) => ({ opacityValue, opacityVariable }) => {
  if (opacityVariable) return `var(--${token})`;
  if (opacityValue) return `color-mix(in srgb, var(--${token}) calc(${opacityValue} * 100%), transparent)`;
  return `var(--${token})`;
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        viridian: themedColor('viridian'),
        'cambridge-blue': themedColor('cambridge-blue'),
        'mint-green': themedColor('mint-green'),
        'azure-web': themedColor('azure-web'),
        'mint-cream': themedColor('mint-cream'),
        'accent-orange': themedColor('accent-orange'),
        'accent-green': themedColor('accent-green'),
        'accent-pink': themedColor('accent-pink'),
        'accent-teal': themedColor('accent-teal'),
        'accent-purple': themedColor('accent-purple'),
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
