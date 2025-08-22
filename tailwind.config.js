// tailwind.config.js  (CommonJS)
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        phone: "480px",  // large phones
        pad:   "768px",  // tablets
        lap:   "1024px", // laptops
        desk:  "1440px", // large desktops
      },
    },
  },
  // (variants is legacy in Tailwind v3+, but leaving it won't break)
  variants: {
    extend: {
      display: ["group-hover"],
    },
  },
  plugins: [],
};

