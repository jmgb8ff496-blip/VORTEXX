export const ACCENTS = ["#39E879", "#4DA3FF", "#B472FF", "#FF7A59", "#FFC83D", "#FF5FA2"];
export const BGS: Record<string, { label: string; css: string }> = {
  default: { label: "Обычный", css: "" },
  aurora: { label: "Аврора", css: "linear-gradient(135deg, rgb(var(--accent-dark)) 0%, #101612 75%)" },
  night: { label: "Ночь", css: "linear-gradient(160deg, #1b2a22 0%, #080B09 85%)" },
  sunset: { label: "Закат", css: "linear-gradient(135deg, #7a2e2e 0%, #2b1a3a 60%, #101612 100%)" },
  ocean: { label: "Океан", css: "linear-gradient(135deg, #124a6b 0%, #0b1f2b 75%)" },
};
export function applyAccent(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const s = document.documentElement.style;
  s.setProperty("--accent", `${r} ${g} ${b}`);
  s.setProperty("--accent-dark", `${Math.round(r * 0.55)} ${Math.round(g * 0.55)} ${Math.round(b * 0.55)}`);
}
export const avatarSrc = (path?: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : null;
