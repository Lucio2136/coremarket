import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        heading: ["Syne", "sans-serif"],
        body:    ["DM Sans", "sans-serif"],
      },
      fontSize: {
        micro:   "9.5px",
        caption: "11px",
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
          DEFAULT: "#2563EB",
          foreground: "hsl(var(--accent-foreground))",
          600: "#1D4ED8",
          50:  "#EFF6FF",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        neon: {
          gold:   "hsl(var(--neon-gold))",
          purple: "hsl(var(--neon-purple))",
          green:  "hsl(var(--neon-green))",
          red:    "hsl(var(--neon-red))",
        },
        surface: {
          elevated: "hsl(var(--surface-elevated))",
        },
        // ── Design system brand tokens ──────────────────────────────────
        ink: {
          DEFAULT: "#0D1117",
          soft:    "#1F2937",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          dim:     "#FAFAFA",
        },
        yes: {
          DEFAULT: "#10B981",
          700:     "#047857",
          50:      "#ECFDF5",
        },
        no: {
          DEFAULT: "#F43F5E",
          700:     "#BE123C",
          50:      "#FFF1F2",
        },
        cat: {
          politica:        "#3B82F6",
          deportes:        "#10B981",
          entretenimiento: "#8B5CF6",
          finanzas:        "#F59E0B",
          tech:            "#06B6D4",
          musica:          "#F43F5E",
          negocios:        "#6366F1",
          elecciones:      "#EF4444",
          redes:           "#0EA5E9",
          cultura:         "#F97316",
        },
      },
      borderRadius: {
        xs:   "6px",
        sm:   "8px",
        md:   "12px",
        lg:   "var(--radius)",
        xl:   "20px",
        "2xl":"24px",
      },
      boxShadow: {
        card:        "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover":"0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        modal:       "0 24px 60px rgba(0,0,0,0.18)",
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
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "count-up": "count-up 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
