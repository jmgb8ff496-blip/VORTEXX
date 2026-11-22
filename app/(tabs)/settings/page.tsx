"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-green" : "bg-line"}`}>
    <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-ink shadow transition-transform duration-300 ${on ? "translate-x-5" : ""}`} />
  </button>
);

export default function SettingsPage() {
  const sb = createClient();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [online, setOnline] = useState(true);
  const [aud, setAud] = useState<"everyone" | "chats">("chats");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setUid(user.id);
      const r = await sb.from("user_settings").select("show_online,story_audience").eq("user_id", user.id).maybeSingle();
      const d = r.data as { show_online: boolean; story_audience: "everyone" | "chats" } | null;
      if (d) { setOnline(d.show_online); setAud(d.story_audience); }
    })();
  }, []);

  async function save(o: boolean, a: "everyone" | "chats") {
    setErr("");
    const { error } = await sb.from("user_settings").upsert({ user_id: uid, show_online: o, story_audience: a, updated_at: new Date().toISOString() });
    if (error) return setErr("Не удалось сохранить: " + error.message);
    sb.rpc("touch_presence").then(() => {});
  }
  async function logout() {
    await sb.auth.signOut();
    localStorage.removeItem("vx-accent");
    router.replace("/login"); router.refresh();
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/profile" aria-label="Назад" className="text-green"><ArrowLeft size={22} /></Link>
        <h1 className="text-2xl font-semibold">Настройки</h1>
      </div>
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between gap-4 p-4">
          <div><div className="font-medium">Показывать статус «в сети»</div><div className="text-sm text-muted">Если выключить, вы тоже не будете видеть чужой статус</div></div>
          <Toggle on={online} onChange={(v) => { setOnline(v); save(v, aud); }} />
        </div>
        <div className="p-4">
          <div className="font-medium">Кто видит мои истории по умолчанию</div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg2 p-1 text-sm">
            {(["chats", "everyone"] as const).map((k) => (
              <button key={k} onClick={() => { setAud(k); save(online, k); }} className={`rounded-lg py-2 transition-colors ${aud === k ? "bg-card text-green" : "text-muted"}`}>
                {k === "chats" ? "Мои собеседники" : "Все"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Сквозное шифрование в VORTEX не реализовано: сообщения хранятся на сервере в базе данных.</p>
      <button onClick={logout} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-err"><LogOut size={18} />Выйти</button>
    </div>
  );
}
