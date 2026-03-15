import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0a0f",
          card: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.06)",
        },
        accent: {
          DEFAULT: "#635BFF",
          hover: "#7C75FF",
          muted: "rgba(99,91,255,0.15)",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.15)",
        },
        text: {
          primary: "#F8F8FC",
          secondary: "rgba(248,248,252,0.6)",
          muted: "rgba(248,248,252,0.35)",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        tier: {
          fast: "#10B981",
          balanced: "#F59E0B",
          premium: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backdropBlur: {
        glass: "16px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
