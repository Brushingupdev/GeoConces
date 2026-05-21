import type { Config } from "tailwindcss";

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
      colors: {
        /* Malaquita — color de mineral de cobre, identidad de marca */
        primary: {
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
        /* Cobre — acento mineral, CTAs secundarios, highlights */
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
        /* Tierra — fondos cálidos, secciones neutras */
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
  plugins: [],
};

export default config;
