/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Mapping our CSS variables to Tailwind colors if we want to use them as utilities
                // e.g., bg-panel
                panel: 'var(--bg-panel)',
                element: 'var(--bg-element)',
                primary: 'var(--primary)',
                danger: 'var(--danger)',
            },
            borderRadius: {
                DEFAULT: 'var(--radius)',
            }
        },
    },
    plugins: [],
}
