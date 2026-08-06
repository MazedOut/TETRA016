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
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        "elev-1": "0 1px 3px rgba(27,36,48,0.10), 0 1px 2px rgba(27,36,48,0.06)",
        "elev-2": "0 4px 10px rgba(27,36,48,0.13), 0 2px 4px rgba(27,36,48,0.08)",
        "elev-3": "0 8px 20px rgba(27,36,48,0.16), 0 4px 8px rgba(27,36,48,0.10)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        slideIn: {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.18s ease-out",
        scaleIn: "scaleIn 0.15s ease-out",
        slideIn: "slideIn 0.22s ease-out",
        slideUp: "slideUp 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
