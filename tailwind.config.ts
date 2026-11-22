import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      bg: "#080B09", bg2: "#101612", card: "#151D18", green: "rgb(var(--accent) / <alpha-value>)", dgreen: "rgb(var(--accent-dark) / <alpha-value>)",
      ink: "#F3F7F4", muted: "#89968D", line: "#25332A", err: "#FF5B64" },
    keyframes: {
      fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      slideUp: { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
      sheetIn: { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
      popIn: { from: { opacity: "0", transform: "scale(.92) translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      ring: { "0%,100%": { boxShadow: "0 0 0 0 rgb(var(--accent) / .45)" }, "50%": { boxShadow: "0 0 0 5px rgb(var(--accent) / 0)" } },
    },
    animation: {
      fade: "fadeIn .2s ease-out both",
      page: "slideUp .28s cubic-bezier(.2,.8,.2,1) both",
      sheet: "sheetIn .26s cubic-bezier(.2,.8,.2,1) both",
      pop: "popIn .22s cubic-bezier(.2,.8,.2,1) both",
      ring: "ring 2s ease-in-out infinite",
    },
  } },
  plugins: [],
} satisfies Config;
