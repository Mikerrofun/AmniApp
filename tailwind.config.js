/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#141416',
        card: '#1C1C1F',
        accent: {
          DEFAULT: '#C63B3B',
          soft: '#A02F2F',
        },
        'text-primary': '#EDEDEF',
        'text-muted': '#8A8A90',
      },
    },
  },
  plugins: [],
};
