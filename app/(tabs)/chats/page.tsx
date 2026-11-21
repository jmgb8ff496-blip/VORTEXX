"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Msg = { chat_id: string; sender_id: string; body: string; created_at: string; deleted_at: string | null };
type Mem = { chat_id: string; last_read_at: string };
type Oth = { chat_id: string; profiles: { username: string; display_name: string } | null };
type Row = { id: string; name: string; last: string; ts: string; unread: number };
const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit" });
};

export default function ChatsPage() {
  const sb = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const mine = await sb.from("chat_members").select("chat_id,last_read_at").eq("user_id", user.id);
    if (mine.error) return setErr(mine.error.message);
    const mem = (mine.data ?? []) as Mem[];
    if (!mem.length) return setRows([]);
    const ids = mem.map((m) => m.chat_id);
    const [others, msgs] = await Promise.all([
      sb.from("chat_members").select("chat_id,profiles(username,display_name)").in("chat_id", ids).neq("user_id", user.id),
      sb.from("messages").select("chat_id,sender_id,body,created_at,deleted_at").in("chat_id", ids).order("created_at", { ascending: false }).limit(300),
    ]);
    if (others.error) return setErr(others.error.message);
    const read = new Map(mem.map((m) => [m.chat_id, new Date(m.last_read_at).getTime()]));
    const last = new Map<string, Msg>();
    const unread = new Map<string, number>();
    for (const m of (msgs.data ?? []) as Msg[]) {
      if (!last.has(m.chat_id)) last.set(m.chat_id, m);
      if (m.sender_id !== user.id && !m.deleted_at && new Date(m.created_at).getTime() > (read.get(m.chat_id) ?? 0))
        unread.set(m.chat_id, (unread.get(m.chat_id) ?? 0) + 1);
    }
    const list = ((others.data ?? []) as unknown as Oth[]).map((o) => {
      const l = last.get(o.chat_id);
      return {
        id: o.chat_id,
        name: o.profiles?.display_name ?? "Пользователь",
        last: l ? (l.deleted_at ? "Сообщение удалено" : (l.sender_id === user.id ? "Вы: " : "") + l.body) : "Нет сообщений",
        ts: l?.created_at ?? "",
        unread: unread.get(o.chat_id) ?? 0,
      };
    });
    list.sort((a, b) => (b.ts || "0").localeCompare(a.ts || "0"));
    setRows(list);
  }, []);

  useEffect(() => {
    load();
    const ch = sb.channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members" }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  const shown = (rows ?? []).filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">Чаты</h1>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-bg2 px-3 py-2.5">
        <Search size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по чатам" className="w-full bg-transparent text-base outline-none" />
      </div>
      {err && <p className="mt-4 text-sm text-err">Ошибка: {err}</p>}
      {rows === null && !err && <p className="mt-4 text-sm text-muted">Загрузка…</p>}
      {rows && rows.length === 0 && <p className="mt-6 text-sm text-muted">Чатов пока нет. Найдите человека во вкладке «Контакты» и напишите ему.</p>}
      <ul className="mt-3 divide-y divide-line">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/chat/${c.id}`} className="flex items-center gap-3 py-3 active:opacity-70">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-dgreen text-lg font-semibold">{c.name[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><span className="truncate font-medium">{c.name}</span><span className="text-xs text-muted">{c.ts && fmt(c.ts)}</span></div>
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm text-muted">{c.last}</span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-green px-1.5 text-xs font-semibold text-bg">{c.unread}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
