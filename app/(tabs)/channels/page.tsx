"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mine = { role: string; chats: { id: string; title: string | null; type: string; description: string } | null };
type Found = { cid: string; ctitle: string; cslug: string; cdescr: string; cmembers: number };

export default function ChannelsPage() {
  const sb = createClient();
  const [mine, setMine] = useState<Mine[] | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const r = await sb.from("chat_members").select("role,chats(id,title,type,description)").eq("user_id", user.id);
      if (r.error) return setErr(r.error.message);
      setMine(((r.data ?? []) as unknown as Mine[]).filter((m) => m.chats?.type === "channel"));
    })();
  }, []);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setFound([]); return; }
    const h = setTimeout(async () => {
      const { data } = await sb.rpc("search_channels", { q: t });
      setFound((data ?? []) as Found[]);
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const Item = ({ href, title, sub }: { href: string; title: string; sub: string }) => (
    <li>
      <Link href={href} className="flex items-center gap-3 py-3 active:opacity-70">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-dgreen"><Megaphone size={20} /></div>
        <div className="min-w-0"><div className="truncate font-medium">{title}</div><div className="truncate text-sm text-muted">{sub}</div></div>
      </Link>
    </li>
  );
  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Каналы</h1>
        <Link href="/new?type=channel" aria-label="Создать канал" className="grid h-9 w-9 place-items-center rounded-full bg-card text-green"><Plus size={20} /></Link>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg2 px-3 py-2.5">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти публичный канал" autoCapitalize="none" className="w-full bg-transparent text-base outline-none" />
      </div>
      {err && <p className="mt-3 text-sm text-err">Ошибка: {err}</p>}
      {q.trim().length >= 2 ? (
        <ul className="mt-3 divide-y divide-line">
          {found.map((f) => <Item key={f.cid} href={"/c/" + f.cslug} title={f.ctitle} sub={`@${f.cslug} · ${f.cmembers} подписчиков`} />)}
          {found.length === 0 && <p className="py-3 text-sm text-muted">Ничего не найдено</p>}
        </ul>
      ) : (
        <>
          {mine === null && !err && <p className="mt-4 text-sm text-muted">Загрузка…</p>}
          {mine && mine.length === 0 && <p className="mt-6 text-sm text-muted">Вы пока не подписаны ни на один канал. Найдите публичный по названию или создайте свой.</p>}
          <ul className="mt-3 divide-y divide-line">
            {(mine ?? []).map((m) => m.chats && <Item key={m.chats.id} href={"/chat/" + m.chats.id} title={m.chats.title ?? "Канал"} sub={m.role === "owner" ? "Вы владелец" : m.role === "admin" ? "Вы администратор" : "Вы подписчик"} />)}
          </ul>
        </>
      )}
    </div>
  );
}
