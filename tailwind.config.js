/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        paper: "oklch(var(--paper) / <alpha-value>)",
        "paper-deep": "oklch(var(--paper-deep) / <alpha-value>)",
        "ink-soft": "oklch(var(--ink-soft) / <alpha-value>)",
        forest: {
          DEFAULT: "oklch(var(--forest) / <alpha-value>)",
          foreground: "oklch(var(--forest-foreground) / <alpha-value>)",
        },
        rule: "oklch(var(--rule) / <alpha-value>)",
        book: {
          parchment: "#FDFBF7",
          cream: "#F8F5EE",
          sand: "#EFECE3",
          border: "#E2DDD2",
          ink: "#1C1917",
          charcoal: "#292524",
          muted: "#78716C",
          terracotta: "#A34825",
          leather: "#45241C",
          gold: "#B48332",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        poppins: ["var(--font-poppins)", "Poppins", "system-ui", "sans-serif"],
        devanagari: ["var(--font-devanagari)", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      },
      boxShadow: {
        page: "var(--shadow-page)",
        lift: "var(--shadow-lift)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 3px)",
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
}
