import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    bg: "#080B09", bg2: "#101612", card: "#151D18", green: "#39E879", dgreen: "#147A40",
    ink: "#F3F7F4", muted: "#89968D", line: "#25332A", err: "#FF5B64" } } },
  plugins: [],
} satisfies Config;
