import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: {
          50: "#f8f7f3",
          100: "#efece4",
          900: "#101010"
        }
      }
    }
  },
  plugins: []
};

export default config;
