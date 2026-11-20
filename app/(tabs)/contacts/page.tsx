"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type R = { id: string; username: string; display_name: string };

export default function ContactsPage() {
  const sb = createClient();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<R[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = q.trim().replace(/^@/, "").toLowerCase().replace(/[\\%_]/g, "\\$&");
    if (t.length < 2) { setRes([]); setDone(false); return; }
    const h = setTimeout(async () => {
      const { data } = await sb.from("profiles").select("id,username,display_name").ilike("username", t + "%").limit(20);
      setRes(data ?? []); setDone(true);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">Контакты</h1>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg2 px-3 py-2.5">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по username" autoCapitalize="none" className="w-full bg-transparent text-base outline-none" />
      </div>
      <ul className="mt-3 divide-y divide-line">
        {res.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-dgreen font-semibold">{r.display_name[0]?.toUpperCase()}</div>
            <div><div className="font-medium">{r.display_name}</div><div className="text-sm text-muted">@{r.username}</div></div>
          </li>
        ))}
      </ul>
      {done && res.length === 0 && <p className="mt-4 text-sm text-muted">Никого не найдено</p>}
      <p className="mt-6 text-xs text-muted">Начать переписку из этого списка можно будет на этапе 3.</p>
    </div>
  );
}
