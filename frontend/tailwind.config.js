/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0284c7',
          600: '#0284c7',
          900: '#0c4a6e',
        },
        dark: {
          base: '#0B0F17',
          surface: '#111827',
          border: '#1F2937',
          highlight: '#374151'
        }
      },
    },
  },
  plugins: [],
};
