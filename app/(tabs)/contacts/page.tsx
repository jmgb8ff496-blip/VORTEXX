"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type R = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function ContactsPage() {
  const sb = createClient();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<R[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = q.trim().replace(/^@/, "").toLowerCase().replace(/[\\%_]/g, "\\$&");
    if (t.length < 2) { setRes([]); setDone(false); return; }
    const h = setTimeout(async () => {
      const { data: { user } } = await sb.auth.getUser();
      const { data } = await sb.from("profiles").select("id,username,display_name,avatar_url").ilike("username", t + "%").limit(20);
      setRes(((data ?? []) as R[]).filter((r) => r.id !== user?.id)); setDone(true);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  async function start(uid: string) {
    setBusy(uid); setErr("");
    const { data, error } = await sb.rpc("start_direct_chat", { other: uid });
    setBusy("");
    if (error || !data) return setErr("Не удалось открыть чат: " + (error?.message ?? ""));
    router.push("/chat/" + data);
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">Контакты</h1>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg2 px-3 py-2.5">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по username" autoCapitalize="none" className="w-full bg-transparent text-base outline-none" />
      </div>
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <ul className="mt-3 divide-y divide-line">
        {res.map((r) => (
          <li key={r.id} className="animate-page">
            <button onClick={() => start(r.id)} disabled={busy === r.id} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
              <Avatar path={r.avatar_url} name={r.display_name} size={44} />
              <div><div className="font-medium">{r.display_name}</div><div className="text-sm text-muted">@{r.username}</div></div>
            </button>
          </li>
        ))}
      </ul>
      {done && res.length === 0 && <p className="mt-4 text-sm text-muted">Никого не найдено</p>}
    </div>
  );
}
