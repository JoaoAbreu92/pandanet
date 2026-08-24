/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-primary': '#10b981',      // Emerald 500 (more sophisticated/standard)
                'brand-primary-dark': '#059669', // Emerald 600
                'brand-secondary': '#F8FAFC',    // Slate 50 (clean background)
                'brand-surface': '#FFFFFF',      // White surface for cards
                'brand-border': '#E2E8F0',       // Slate 200 for thin borders
                'brand-text': '#0F172A',         // Slate 900 for high contrast text
                'brand-subtle-text': '#64748B',  // Slate 500 for secondary text
                'brand-accent': '#6366f1',       // Indigo 500
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-down': 'slideDown 0.5s ease-out forwards',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-100%)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },
    plugins: [],
}
