"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type P = { id: string; username: string; display_name: string; bio: string };
const input = "w-full rounded-xl border border-line bg-bg2 px-4 py-3 text-base outline-none focus:border-green";

export default function ProfilePage() {
  const sb = createClient();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profiles").select("id,username,display_name,bio").eq("id", user.id).single();
      if (data) { setP(data); setName(data.display_name); setBio(data.bio); }
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
  async function logout() {
    await sb.auth.signOut();
    router.replace("/login"); router.refresh();
  }

  if (!p) return <div className="px-4 pt-8 text-muted">Загрузка…</div>;
  return (
    <div className="px-4 pt-6">
      <div className="flex flex-col items-center rounded-2xl border border-line bg-card p-6">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-dgreen text-4xl font-semibold">{p.display_name[0]?.toUpperCase()}</div>
        <h1 className="mt-3 text-xl font-semibold">{p.display_name}</h1>
        <p className="text-sm text-muted">@{p.username}</p>
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
        <textarea className={input} rows={3} value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} placeholder="О себе" />
        {msg && <p className="text-sm text-muted">{msg}</p>}
        <button onClick={save} disabled={busy} className="rounded-xl bg-green py-3 font-semibold text-bg disabled:opacity-60">Сохранить</button>
      </div>
      <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-err"><LogOut size={18} />Выйти</button>
    </div>
  );
}
