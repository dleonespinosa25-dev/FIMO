/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#06111F",
          900: "#0B1F33",
          800: "#12304A",
          700: "#1B4668",
        },
        mint: {
          400: "#2EE6C6",
          500: "#12C8A8",
          600: "#0AA58B",
        },
        club: {
          orange: "#F15A24",
          deep: "#E04812",
          cream: "#FFF6EE",
          sand: "#F7E7D8",
          fuchsia: "#E31C79",
          ink: "#3A1F14",
        },
      },
      boxShadow: {
        card: "0 12px 40px rgba(6, 17, 31, 0.12)",
      },
    },
  },
  plugins: [],
};
