/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: {
          light: "#f7f5ef",
          dark: "#181a1f"
        },
        accent: {
          DEFAULT: "#2563eb",
          muted: "#dbeafe"
        }
      },
      boxShadow: {
        panel: "0 12px 40px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["'Manrope'", "ui-sans-serif", "system-ui"],
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};
