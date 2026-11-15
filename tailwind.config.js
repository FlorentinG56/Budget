/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fond: '#F2F4F7',
        bleu: { DEFAULT: '#2F6FED', fonce: '#1F55C4', pale: '#E6EEFD' },
        vert: { DEFAULT: '#1F9D63', pale: '#E3F5EC' },
        rouge: { DEFAULT: '#E0524D', pale: '#FCEAEA' },
        encre: { DEFAULT: '#1A2233', douce: '#5B6475', pale: '#98A0AE' },
        trait: '#E3E7ED',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { carte: '0 1px 2px rgba(16,24,40,.04), 0 4px 12px rgba(16,24,40,.05)' },
      borderRadius: { carte: '18px' },
    },
  },
  plugins: [],
}
