import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ── Data Viz Palette ──────────────────────────────────────────────
        viz: {
          emerald: "var(--viz-emerald)",   // income, investments
          blue:    "var(--viz-blue)",      // cash, links
          violet:  "var(--viz-violet)",    // AI, feed
          purple:  "var(--viz-purple)",    // real-estate
          amber:   "var(--viz-amber)",     // warnings, crypto
          orange:  "var(--viz-orange)",    // expense
          red:     "var(--viz-red)",       // liabilities
          rose:    "var(--viz-rose)",      // credit card
          pink:    "var(--viz-pink)",      // STO alt
          sky:     "var(--viz-sky)",       // cash-light
          mint:    "var(--viz-mint)",      // investment-light
          gold:    "var(--viz-gold)",      // crypto-light
        },
      },
      borderRadius: {
        sm:   "var(--radius-sm)",    // 4px  — tag inner icons
        DEFAULT: "var(--radius)",    // 6px  — default rounded
        md:   "var(--radius)",       // 6px  — buttons, CTA
        lg:   "var(--radius-lg)",    // 8px  — dropdowns, icon containers
        xl:   "var(--radius-xl)",    // 12px — chips, inputs, avatars
        "2xl": "var(--radius-2xl)", // 16px — cards, drawers ⭐
        full: "var(--radius-full)",  // 9999px — pills, badges
      },
      boxShadow: {
        card:  "var(--shadow-card)",
        float: "var(--shadow-float)",
        "card-xl": "var(--shadow-xl)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-up":        "fade-up 0.55s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
