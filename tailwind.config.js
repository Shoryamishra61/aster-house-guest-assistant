/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hotel: {
          bg: "#F7F5F0",
          surface: "#FFFFFF",
          "surface-subtle": "#F0EEE8",
          text: "#1E2328",
          "text-muted": "#66707A",
          border: "#D8D5CE",
          accent: "#1F5A5A",
          "accent-hover": "#174747",
          danger: "#9A3412",
          "danger-subtle": "#FDF2EC",
          success: "#326A45",
          "success-subtle": "#EDF5F0",
          focus: "#0B66C3",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        control: "6px",
        panel: "10px",
      },
    },
  },
  plugins: [],
};
