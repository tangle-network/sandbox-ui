/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
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
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",
        info: "hsl(var(--info))",
        // MD3 surface hierarchy (Stitch design system)
        "surface": "var(--md3-surface)",
        "surface-dim": "var(--md3-surface-dim)",
        "surface-bright": "var(--md3-surface-bright)",
        "surface-container-lowest": "var(--md3-surface-container-lowest)",
        "surface-container-low": "var(--md3-surface-container-low)",
        "surface-container": "var(--md3-surface-container)",
        "surface-container-high": "var(--md3-surface-container-high)",
        "surface-container-highest": "var(--md3-surface-container-highest)",
        "surface-variant": "var(--md3-surface-variant)",
        "on-surface": "var(--md3-on-surface)",
        "on-surface-variant": "var(--md3-on-surface-variant)",
        // MD3 primary tokens
        "md3-primary": "var(--md3-primary)",
        "primary-container": "var(--md3-primary-container)",
        "on-primary": "var(--md3-on-primary)",
        "on-primary-container": "var(--md3-on-primary-container)",
        "primary-fixed": "var(--md3-primary-fixed)",
        "primary-fixed-dim": "var(--md3-primary-fixed-dim)",
        // MD3 secondary tokens
        "md3-secondary": "var(--md3-secondary)",
        "secondary-container": "var(--md3-secondary-container)",
        "on-secondary": "var(--md3-on-secondary)",
        "on-secondary-container": "var(--md3-on-secondary-container)",
        "secondary-fixed": "var(--md3-secondary-fixed)",
        "secondary-fixed-dim": "var(--md3-secondary-fixed-dim)",
        // MD3 tertiary tokens
        "md3-tertiary": "var(--md3-tertiary)",
        "tertiary-container": "var(--md3-tertiary-container)",
        // MD3 outline tokens
        "outline": "var(--md3-outline)",
        "outline-variant": "var(--md3-outline-variant)",
        // MD3 error tokens
        "md3-error": "var(--md3-error)",
        "error-container": "var(--md3-error-container)",
        "on-error": "var(--md3-on-error)",
        // MD3 inverse tokens
        "inverse-surface": "var(--md3-inverse-surface)",
        "inverse-primary": "var(--md3-inverse-primary)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
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
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
