import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        ring: "hsl(var(--ring))",
        // Identidade do Instituto Kunumi (desafio Ideias em Rede).
        // O coral da marca substitui a escala "orange" usada nos destaques.
        orange: {
          50: "#fff1f0", 100: "#ffdfdc", 200: "#ffc4bf", 300: "#ff9d95", 400: "#ff6e63",
          500: "#ff4b3e", 600: "#ec3226", 700: "#c7251b", 800: "#a4231b", 900: "#87241d",
        },
        ink: "#1c2127",
        paper: "#f0f0f0",
        night: "#060902",
        kunumi: { orange: "#f54d20", plum: "#8a3d50", blue: "#344b7f" },
      },
      fontFamily: {
        sans: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
