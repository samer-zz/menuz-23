import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#030B1A",
          900: "#040E21",
          800: "#071A38",
          700: "#0B2D5B",
          600: "#123F7A",
          500: "#1B559E",
        },
        brand: {
          orange: "#FF7A00",
          amber: "#FF9E2C",
          ember: "#E66400",
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans Arabic"',
          '"Tajawal"',
          "system-ui",
          "sans-serif",
        ],
        display: [
          '"Tajawal"',
          '"IBM Plex Sans Arabic"',
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        "orange-glow": "0 10px 40px -10px rgba(255, 122, 0, 0.45)",
        "navy-card": "0 20px 50px -15px rgba(3, 11, 26, 0.65)",
        glass: "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
      animation: {
        "marquee-rtl": "marqueeRtl 26s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        marqueeRtl: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
