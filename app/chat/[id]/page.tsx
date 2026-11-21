"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Send, X, Check, CheckCheck, Reply, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Msg = { id: string; chat_id: string; sender_id: string; body: string; reply_to: string | null; created_at: string; edited_at: string | null; deleted_at: string | null };
type Re = { message_id: string; user_id: string; emoji: string };
type Prof = { display_name: string; username: string };
type MemRow = { user_id: string; last_read_at: string; profiles: Prof | null };
const EMOJI = ["👍", "❤️", "😂", "🔥"];
const hm = (iso: string) => new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sb = createClient();
  const [me, setMe] = useState("");
  const [other, setOther] = useState<Prof | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reacts, setReacts] = useState<Re[]>([]);
  const [otherRead, setOtherRead] = useState(0);
  const [text, setText] = useState("");
  const [sel, setSel] = useState<Msg | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const idsRef = useRef<Set<string>>(new Set());
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadReacts = useCallback(async () => {
    const ids = [...idsRef.current];
    if (!ids.length) return setReacts([]);
    const r = await sb.from("message_reactions").select("message_id,user_id,emoji").in("message_id", ids);
    if (r.data) setReacts(r.data as Re[]);
  }, []);

  useEffect(() => {
    let alive = true;
    let ch: RealtimeChannel | undefined;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      setMe(user.id);
      const mem = await sb.from("chat_members").select("user_id,last_read_at,profiles(display_name,username)").eq("chat_id", id);
      if (mem.error) return setErr(mem.error.message);
      const o = ((mem.data ?? []) as unknown as MemRow[]).find((m) => m.user_id !== user.id);
      if (!o || !o.profiles) return setErr("Чат не найден");
      setOther(o.profiles);
      setOtherRead(new Date(o.last_read_at).getTime());
      const ms = await sb.from("messages").select("*").eq("chat_id", id).order("created_at", { ascending: false }).limit(100);
      if (ms.error) return setErr(ms.error.message);
      const list = ((ms.data ?? []) as Msg[]).reverse();
      idsRef.current = new Set(list.map((m) => m.id));
      setMsgs(list);
      loadReacts();
      sb.rpc("mark_chat_read", { cid: id });
      ch = sb.channel("chat:" + id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, (p) => {
          const m = p.new as Msg;
          idsRef.current.add(m.id);
          setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
          if (m.sender_id !== user.id) sb.rpc("mark_chat_read", { cid: id });
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, (p) => {
          const m = p.new as Msg;
          setMsgs((x) => x.map((y) => (y.id === m.id ? m : y)));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members", filter: `chat_id=eq.${id}` }, (p) => {
          const r = p.new as { user_id: string; last_read_at: string };
          if (r.user_id !== user.id) setOtherRead(new Date(r.last_read_at).getTime());
        })
        .on("broadcast", { event: "react" }, () => loadReacts())
        .on("broadcast", { event: "typing" }, () => {
          setTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 3000);
        })
        .subscribe();
      chRef.current = ch;
      if (!alive) sb.removeChannel(ch);
    })();
    return () => { alive = false; if (ch) sb.removeChannel(ch); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, typing]);

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      chRef.current?.send({ type: "broadcast", event: "typing", payload: {} });
    }
  }
  async function send() {
    const body = text.trim();
    if (!body || !me) return;
    setErr(""); setText("");
    if (editing) {
      const m = editing; setEditing(null);
      const at = new Date().toISOString();
      const { error } = await sb.from("messages").update({ body, edited_at: at }).eq("id", m.id);
      if (error) { setErr("Не удалось изменить"); return; }
      setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, body, edited_at: at } : y)));
      return;
    }
    const { data, error } = await sb.from("messages").insert({ chat_id: id, sender_id: me, body, reply_to: replyTo?.id ?? null }).select().single();
    setReplyTo(null);
    if (error) { setErr("Не отправлено: " + error.message); setText(body); return; }
    const m = data as Msg;
    idsRef.current.add(m.id);
    setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
  }
  async function remove(m: Msg) {
    setSel(null);
    const at = new Date().toISOString();
    const { error } = await sb.from("messages").update({ body: "", deleted_at: at }).eq("id", m.id);
    if (error) return setErr("Не удалось удалить");
    setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, body: "", deleted_at: at } : y)));
  }
  async function react(m: Msg, emoji: string) {
    setSel(null);
    const has = reacts.some((r) => r.message_id === m.id && r.user_id === me && r.emoji === emoji);
    const { error } = has
      ? await sb.from("message_reactions").delete().match({ message_id: m.id, user_id: me, emoji })
      : await sb.from("message_reactions").insert({ message_id: m.id, user_id: me, emoji });
    if (error) return setErr("Не удалось поставить реакцию");
    await loadReacts();
    chRef.current?.send({ type: "broadcast", event: "react", payload: {} });
  }

  if (!other) return (
    <div className="mx-auto max-w-xl px-4 pt-8">
      <button onClick={() => router.push("/chats")} className="text-green">← Назад</button>
      <p className={`mt-4 ${err ? "text-err" : "text-muted"}`}>{err || "Загрузка…"}</p>
    </div>
  );
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-bg2 px-3 py-3">
        <button onClick={() => router.push("/chats")} aria-label="Назад" className="p-1 text-green"><ArrowLeft size={22} /></button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-dgreen font-semibold">{other.display_name[0]?.toUpperCase()}</div>
        <div className="min-w-0">
          <div className="truncate font-medium leading-tight">{other.display_name}</div>
          <div className={`text-xs ${typing ? "text-green" : "text-muted"}`}>{typing ? "печатает…" : "@" + other.username}</div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        {msgs.length === 0 && <p className="m-auto text-sm text-muted">Сообщений пока нет. Напишите первым.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          const rep = m.reply_to ? msgs.find((x) => x.id === m.reply_to) : undefined;
          const g: Record<string, { n: number; mine: boolean }> = {};
          reacts.filter((r) => r.message_id === m.id).forEach((r) => {
            g[r.emoji] = { n: (g[r.emoji]?.n ?? 0) + 1, mine: (g[r.emoji]?.mine ?? false) || r.user_id === me };
          });
          const isRead = new Date(m.created_at).getTime() <= otherRead;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <button onClick={() => !m.deleted_at && setSel(m)}
                className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-left text-[15px] break-words ${mine ? "bg-dgreen" : "border border-line bg-card"} ${m.deleted_at ? "italic text-muted" : ""}`}>
                {rep && <div className="mb-1 truncate border-l-2 border-green pl-2 text-xs text-muted">{rep.deleted_at ? "Сообщение удалено" : rep.body}</div>}
                <span className="whitespace-pre-wrap">{m.deleted_at ? "Сообщение удалено" : m.body}</span>
                <span className="ml-2 inline-flex items-center gap-1 align-bottom text-[11px] opacity-60">
                  {m.edited_at && !m.deleted_at && "изм."}{hm(m.created_at)}
                  {mine && !m.deleted_at && (isRead ? <CheckCheck size={14} className="text-green" /> : <Check size={14} />)}
                </span>
              </button>
              {Object.keys(g).length > 0 && (
                <div className="mt-1 flex gap-1">
                  {Object.entries(g).map(([e, v]) => (
                    <button key={e} onClick={() => react(m, e)} className={`rounded-full border px-2 py-0.5 text-xs ${v.mine ? "border-green" : "border-line"}`}>{e} {v.n}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {err && <p className="px-4 pb-1 text-sm text-err">{err}</p>}
      {sel && (
        <div className="border-t border-line bg-bg2 px-3 py-2">
          <div className="flex items-center gap-3">
            {EMOJI.map((e) => <button key={e} onClick={() => react(sel, e)} className="text-2xl">{e}</button>)}
            <button onClick={() => setSel(null)} aria-label="Закрыть" className="ml-auto text-muted"><X size={20} /></button>
          </div>
          <div className="mt-2 flex gap-5 text-sm">
            <button onClick={() => { setReplyTo(sel); setEditing(null); setSel(null); }} className="flex items-center gap-1 text-green"><Reply size={16} />Ответить</button>
            {sel.sender_id === me && <>
              <button onClick={() => { setEditing(sel); setReplyTo(null); setText(sel.body); setSel(null); }} className="flex items-center gap-1 text-green"><Pencil size={16} />Изменить</button>
              <button onClick={() => remove(sel)} className="flex items-center gap-1 text-err"><Trash2 size={16} />Удалить</button>
            </>}
          </div>
        </div>
      )}
      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-t border-line bg-bg2 px-3 py-2 text-xs text-muted">
          <span className="truncate">{editing ? "Редактирование: " + editing.body : "Ответ: " + replyTo?.body}</span>
          <button onClick={() => { setReplyTo(null); setEditing(null); setText(""); }} aria-label="Отмена" className="ml-auto"><X size={16} /></button>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line bg-bg2 px-3 pt-2 pb-safe">
        <input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={4000}
          placeholder="Сообщение" className="my-2 min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-base outline-none focus:border-green" />
        <button onClick={send} aria-label="Отправить" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg"><Send size={18} /></button>
      </div>
    </div>
  );
}
