"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Camera, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { ACCENTS, BGS, applyAccent } from "@/lib/accent";

type P = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; accent: string; bg_style: string };
const input = "w-full rounded-xl border border-line bg-bg2 px-4 py-3 text-base outline-none focus:border-green";

async function squareJpeg(file: File, size = 384): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
}

export default function ProfilePage() {
  const sb = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<P | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return setErr("Нет сессии. Выйдите и войдите заново.");
      let { data, error } = await sb.from("profiles").select("id,username,display_name,bio,avatar_url,accent,bg_style").eq("id", user.id).maybeSingle();
      if (error) return setErr("Ошибка базы: " + error.message);
      if (!data) {
        const m = user.user_metadata ?? {};
        const u = String(m.username || "user_" + user.id.replace(/-/g, "").slice(0, 8)).toLowerCase();
        const ins = await sb.from("profiles").insert({ id: user.id, username: u, display_name: m.display_name || u })
          .select("id,username,display_name,bio,avatar_url,accent,bg_style").single();
        if (ins.error) return setErr("Не удалось создать профиль: " + ins.error.message);
        data = ins.data;
      }
      if (data) { setP(data as P); setName(data.display_name); setBio(data.bio); }
    })();
  }, []);

  async function save() {
    if (!p) return;
    const n = name.trim();
    if (!n || n.length > 40) return setMsg("Имя: от 1 до 40 символов");
    setBusy(true); setMsg("");
    const { error } = await sb.from("profiles").update({ display_name: n, bio: bio.trim() }).eq("id", p.id);
    setMsg(error ? "Не удалось сохранить" : "Сохранено");
    setBusy(false);
  }
  async function setAccent(hex: string) {
    if (!p) return;
    applyAccent(hex); localStorage.setItem("vx-accent", hex);
    setP({ ...p, accent: hex });
    await sb.from("profiles").update({ accent: hex }).eq("id", p.id);
  }
  async function setBg(k: string) {
    if (!p) return;
    setP({ ...p, bg_style: k });
    await sb.from("profiles").update({ bg_style: k }).eq("id", p.id);
  }
  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !p) return;
    setErr(""); setBusy(true);
    try {
      const blob = await squareJpeg(f);
      const path = `${p.id}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      const { error } = await sb.from("profiles").update({ avatar_url: path }).eq("id", p.id);
      if (error) throw new Error(error.message);
      if (p.avatar_url) sb.storage.from("avatars").remove([p.avatar_url]);
      setP({ ...p, avatar_url: path });
    } catch (x) { setErr("Не удалось загрузить фото: " + (x as Error).message); }
    setBusy(false);
  }
  async function logout() {
    await sb.auth.signOut();
    localStorage.removeItem("vx-accent");
    router.replace("/login"); router.refresh();
  }

  if (err && !p) return (
    <div className="px-4 pt-8"><p className="text-err">{err}</p>
      <button onClick={logout} className="mt-4 rounded-xl border border-line px-4 py-2">Выйти</button></div>
  );
  if (!p) return <div className="px-4 pt-6"><div className="skeleton h-56 w-full" /></div>;
  const bg = BGS[p.bg_style]?.css;
  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <Link href="/settings" aria-label="Настройки" className="grid h-9 w-9 place-items-center rounded-full bg-card text-green"><Settings size={20} /></Link>
      </div>
      <div className="mt-4 flex flex-col items-center rounded-2xl border border-line bg-card p-6 transition-all duration-500" style={bg ? { background: bg } : undefined}>
        <button onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Сменить фото" className="relative">
          <div className="rounded-full p-[3px]" style={{ boxShadow: "0 0 0 3px rgb(var(--accent))" }}><Avatar path={p.avatar_url} name={p.display_name} size={96} /></div>
          <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-green text-bg"><Camera size={16} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
        <h2 className="mt-3 text-xl font-semibold">{p.display_name}</h2>
        <p className="text-sm text-muted">@{p.username}</p>
        {p.bio && <p className="mt-2 text-center text-sm">{p.bio}</p>}
      </div>
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
        <textarea className={input} rows={3} value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} placeholder="О себе" />
        {msg && <p className="animate-fade text-sm text-muted">{msg}</p>}
        <button onClick={save} disabled={busy} className="rounded-xl bg-green py-3 font-semibold text-bg disabled:opacity-60">Сохранить</button>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm text-muted">Цветовой акцент</h3>
        <div className="mt-3 flex gap-3">
          {ACCENTS.map((c) => (
            <button key={c} onClick={() => setAccent(c)} aria-label={c} style={{ background: c }}
              className={`h-9 w-9 rounded-full transition-transform duration-200 ${p.accent.toLowerCase() === c.toLowerCase() ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-card" : ""}`} />
          ))}
        </div>
        <h3 className="mt-5 text-sm text-muted">Фон профиля</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Object.entries(BGS).map(([k, v]) => (
            <button key={k} onClick={() => setBg(k)} className="flex flex-col items-center gap-1 text-[11px] text-muted">
              <span className={`h-12 w-full rounded-xl border transition-colors ${p.bg_style === k ? "border-green" : "border-line"}`} style={{ background: v.css || "#101612" }} />{v.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-err"><LogOut size={18} />Выйти</button>
    </div>
  );
}
