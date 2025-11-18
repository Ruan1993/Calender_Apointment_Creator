module.exports = {
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {},
  },
  safelist: [
    // Colors used dynamically via SERVICE_COLORS map
    {
      pattern:
        /(bg|text|border)-(indigo|rose|emerald|amber|sky|violet|cyan|pink|red|orange|lime|teal|blue|purple)-(50|100|500|600|700)/,
    },
  ],
};