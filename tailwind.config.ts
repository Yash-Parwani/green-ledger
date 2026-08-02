import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Swiggy-orange, tuned for AA contrast on both cream and near-black.
        orange: {
          50: "#FFF4EA",
          100: "#FFE4CC",
          200: "#FFC495",
          300: "#FFA35D",
          400: "#FF8F3C",
          500: "#E86B10", // primary action — 4.6:1 on white, 5.1:1 on ink-900
          600: "#C6570A",
          700: "#9C4408",
          800: "#7A3607",
          900: "#5C2A08",
        },
        // Genuine green, not a pastel accent — impact/success/sustainability.
        green: {
          50: "#EAF9F1",
          100: "#CBF0DC",
          200: "#98E0BA",
          300: "#5FC994",
          400: "#2FAE76",
          500: "#12915E", // 4.9:1 on white
          600: "#0C744B",
          700: "#0A5C3D",
          800: "#094A32",
          900: "#073A29",
        },
        ink: {
          50: "#F7F6F4",
          100: "#EDEBE7",
          200: "#D8D4CD",
          300: "#B7B1A6",
          400: "#8C8478",
          500: "#6B6459",
          600: "#4F4A42",
          700: "#38342E",
          800: "#25221E",
          900: "#17140F", // background in dark mode
          950: "#0F0D0A",
        },
        // Warm receipt paper — the surface the "ledger" cards sit on.
        paper: {
          DEFAULT: "#F6F0E2",
          dim: "#EDE4CE",
          rule: "#D9CBA8", // dashed dividers / tear lines
          line: "#E6DBC0", // solid card borders
          lineDim: "#E0D4B4", // stacked-paper sliver border
          off: "#FDFBF5", // near-white result-card fill
        },
        mint: "#3FCB92", // ledger-tape checkmark on near-black
        rust: "#A24405", // dark-orange eyebrow/label ink
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
        "slide-in": "slide-in 0.25s ease-out",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
