/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        border: "#E7E0D8",
        input: "#E7E0D8",
        ring: "#1A1A1A",

        background: "#FFFFFF",
        foreground: "#111111",

        primary: {
          DEFAULT: "#111111",
          foreground: "#FFFFFF",
        },

        secondary: {
          DEFAULT: "#F7F2EE",
          foreground: "#111111",
        },

        destructive: {
          DEFAULT: "#991B1B",
          foreground: "#FFFFFF",
        },

        muted: {
          DEFAULT: "#F8F5F2",
          foreground: "#5E5A57",
        },

        accent: {
          DEFAULT: "#B89E8A",
          foreground: "#111111",
        },

        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#111111",
        },

        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#111111",
        },

        blacksoft: "#111111",
        whitesoft: "#FFFFFF",
        nude: "#F7F2EE",
        mocha: "#B89E8A",
        darkbrown: "#3E2C23",

        gold: "#B89E8A",
        ivory: "#FFFFFF",
        champagne: "#F7F2EE",
        pearl: "#FFFCFA",
        charcoal: "#111111",
        graphite: "#5E5A57",
        midnight: "#2A2522",
      },

      fontFamily: {
        serif: ["Marcellus", "serif"],
        sans: ["Josefin Sans", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },

      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },

      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },

      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.05)",
        luxury: "0 18px 60px rgba(17,17,17,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};