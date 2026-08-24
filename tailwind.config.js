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
                'brand-primary': '#00d68f',      // More clear/vibrant Emerald
                'brand-primary-dark': '#00b87a', // Darker shade for hover
                'brand-secondary': '#F3F4F6',    // slightly cooler gray
                'brand-text': '#111827',         // gray-900 (darker text)
                'brand-subtle-text': '#6B7280',  // gray-500
                'brand-accent': '#6366f1',       // Indigo-500 for fresh accents
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },
    plugins: [],
}
