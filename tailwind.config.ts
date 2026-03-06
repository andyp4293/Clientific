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
        primary: {
          DEFAULT: "#7B22D4",
          50: "#F4EBFD",
          100: "#E9D7FB",
          200: "#D3AFF7",
          300: "#BC87F3",
          400: "#A65FEF",
          500: "#9037EB",
          600: "#7B22D4",
          700: "#6419B3",
          800: "#4E1192",
          900: "#380B70",
        },
        gray: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
          950: "#09090B",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
