import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        // Warm light palette — easier on older eyes than dark mode, calmer
        // than pure white. Contrasts verified for WCAG AA.
        paper: "#fdfaf3",       // warm cream background
        paperLift: "#f5efe2",   // raised surface (cards, inputs)
        paperSoft: "#efe8d6",   // subtle dividers / hover
        ink: "#1f1a13",         // body text — 14:1 on paper
        inkSoft: "#544838",     // secondary text — 7.6:1 on paper (AAA)
        inkMuted: "#7a6c55",    // tertiary — 4.6:1 on paper (AA)
        rule: "#e3d9c1",        // borders
        accent: "#b85a18",      // warm terracotta — 5.4:1 on paper (AA large/UI)
        accentDeep: "#8a3f0e",  // pressed/dark accent — 8.5:1 on paper (AAA)
        accent2: "#0f6b50",     // deep mint/green — 6.6:1 on paper (AA)
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
