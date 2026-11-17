import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#07142B", 900: "#0B1D3A", 800: "#13294D", 700: "#1C3863" },
        gold: { 400: "#F2C14E", 500: "#E0A82E" },
      },
    },
  },
  plugins: [],
};
export default config;
