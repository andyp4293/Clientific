import type { Config } from "tailwindcss";

const colorVar = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

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
          DEFAULT: colorVar("--color-primary-600"),
          50: colorVar("--color-primary-50"),
          100: colorVar("--color-primary-100"),
          200: colorVar("--color-primary-200"),
          300: colorVar("--color-primary-300"),
          400: colorVar("--color-primary-400"),
          500: colorVar("--color-primary-500"),
          600: colorVar("--color-primary-600"),
          700: colorVar("--color-primary-700"),
          800: colorVar("--color-primary-800"),
          900: colorVar("--color-primary-900"),
          950: colorVar("--color-primary-950"),
        },
        gray: {
          50: colorVar("--color-gray-50"),
          100: colorVar("--color-gray-100"),
          200: colorVar("--color-gray-200"),
          300: colorVar("--color-gray-300"),
          400: colorVar("--color-gray-400"),
          500: colorVar("--color-gray-500"),
          600: colorVar("--color-gray-600"),
          700: colorVar("--color-gray-700"),
          800: colorVar("--color-gray-800"),
          900: colorVar("--color-gray-900"),
          950: colorVar("--color-gray-950"),
        },
        success: colorVar("--color-success"),
        warning: colorVar("--color-warning"),
        danger: colorVar("--color-danger"),
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
