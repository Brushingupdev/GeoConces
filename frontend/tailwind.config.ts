import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        /* ── shadcn/ui tokens ── */
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",

        /* ── Brand colors ── */
        primary: {
          DEFAULT:    "hsl(var(--primary))",        /* #145a55 */
          foreground: "hsl(var(--primary-foreground))",
          50:  "#eef8f7",
          100: "#d6efeb",
          200: "#b5e0db",
          300: "#7eccc6",
          400: "#48b5ae",
          500: "#1e8b81",
          600: "#166f68",
          700: "#145a55",
          800: "#134947",
          900: "#123c3a",
          950: "#0b2826",
        },
        copper: {
          50:  "#fdf6ed",
          100: "#f9e8d0",
          200: "#f2ce9d",
          300: "#e9ad62",
          400: "#df8d32",
          500: "#c97520",
          600: "#a85c18",
          700: "#874716",
          800: "#6e3917",
          900: "#5a3016",
          950: "#321809",
        },
        earth: {
          50:  "#faf7f2",
          100: "#f2ede4",
          200: "#e4d9c8",
          300: "#d0bea0",
          400: "#b89c74",
          500: "#a48258",
          600: "#8a6a44",
          700: "#6f5437",
          800: "#5a4430",
          900: "#49382a",
          950: "#271e16",
        },
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
