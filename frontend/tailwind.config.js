/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1B2430",
          800: "#232E3D",
          700: "#2C3A4C",
          600: "#3C4C61",
        },
        paper: {
          DEFAULT: "#F6F1E4",
          dim: "#EAE2CD",
        },
        stamp: {
          red: "#B23A2E",
          green: "#2F6F62",
          amber: "#C8922A",
        },
      },
      fontFamily: {
        display: ['"IBM Plex Serif"', "Georgia", "serif"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
