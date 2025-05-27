/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './pages/**/*.{js,ts,jsx,tsx,mdx}',
      './components/**/*.{js,ts,jsx,tsx,mdx}',
      './widget/**/*.{js,ts,jsx,tsx}',
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
            foreground: "hsl(var(--secondary-foreground))"
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
          sidebar: {
            DEFAULT: "hsl(var(--sidebar-background))", 
            background: "hsl(var(--sidebar-background))", 
            foreground: "hsl(var(--sidebar-foreground))",
            border: "hsl(var(--sidebar-border))",
            ring: "hsl(var(--sidebar-ring))",
            hover: "hsl(var(--sidebar-hover))", 
            accent: { 
              DEFAULT: "hsl(var(--sidebar-accent))",
              foreground: "hsl(var(--sidebar-accent-foreground))",
            },
            primary: { 
              DEFAULT: "hsl(var(--sidebar-primary))",
              foreground: "hsl(var(--sidebar-primary-foreground))",
            },
            muted: { 
               DEFAULT: "hsl(var(--sidebar-muted))", 
               foreground: "hsl(var(--sidebar-muted-foreground))",
            }
          },
        },
        borderRadius: { 
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
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
          "fade-in": {
            "0%": { opacity: "0", transform: "translateY(20px)" },
            "100%": { opacity: "1", transform: "translateY(0)" },
          },
          "slide-up": {
            "0%": { opacity: "0", transform: "translateY(30px)" },
            "100%": { opacity: "1", transform: "translateY(0)" },
          },
          "scale-in": {
            "0%": { opacity: "0", transform: "scale(0.95)" },
            "100%": { opacity: "1", transform: "scale(1)" },
          },
          "float": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(-10px)" },
          },
          "glow": {
            "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
            "50%": { opacity: "0.8", transform: "scale(1.05)" },
          },
        },
        animation: { 
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "fade-in": "fade-in 0.8s ease-out forwards",
          "slide-up": "slide-up 0.6s ease-out forwards",
          "scale-in": "scale-in 0.5s ease-out forwards",
          "float": "float 3s ease-in-out infinite",
          "glow": "glow 2s ease-in-out infinite",
        },
        animationDelay: {
          '0': '0ms',
          '75': '75ms',
          '100': '100ms',
          '150': '150ms',
          '200': '200ms',
          '300': '300ms',
          '500': '500ms',
          '700': '700ms',
          '1000': '1000ms',
        },
        backdropBlur: {
          xs: '2px',
        },
      },
    },
    plugins: [],
}