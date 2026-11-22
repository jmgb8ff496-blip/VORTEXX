"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Send, X, Check, CheckCheck, Reply, Pencil, Trash2, Paperclip, Mic, Image as ImageIcon, FileText, Pause, Square, Info, Pin, PinOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import VoicePlayer from "@/components/VoicePlayer";
import ChatInfo from "@/components/ChatInfo";
import Avatar from "@/components/Avatar";

type Msg = { id: string; chat_id: string; sender_id: string; body: string; reply_to: string | null; created_at: string; edited_at: string | null; deleted_at: string | null };
type Re = { message_id: string; user_id: string; emoji: string };
type Att = { id: string; message_id: string; chat_id: string; path: string; kind: "image" | "file" | "voice"; mime: string; name: string; size: number; duration_ms: number | null };
type Prof = { display_name: string; username: string; avatar_url: string | null; last_seen: string | null };
type MemRow = { user_id: string; role: string; last_read_at: string; profiles: Prof | null };
type Chat = { id: string; type: "direct" | "group" | "channel"; title: string | null; description: string; slug: string | null; only_admins_post: boolean; pinned_message_id: string | null };
const EMOJI = ["👍", "❤️", "😂", "🔥"];
const MAX = 10 * 1024 * 1024;
const IMG_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const FILE_OK = ["application/pdf", "text/plain", "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const hm = (iso: string) => new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
const fmtT = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " МБ" : Math.max(1, Math.round(n / 1024)) + " КБ");

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sb = createClient();
  const [me, setMe] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<MemRow[]>([]);
  const [info, setInfo] = useState(false);
  const [count, setCount] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reacts, setReacts] = useState<Re[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reads, setReads] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [sel, setSel] = useState<Msg | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [typing, setTyping] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [busyUp, setBusyUp] = useState(false);
  const [rec, setRec] = useState<"idle" | "rec" | "paused" | "preview">("idle");
  const [recMs, setRecMs] = useState(0);
  const [voice, setVoice] = useState<{ blob: Blob; url: string; ms: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const idsRef = useRef<Set<string>>(new Set());
  const urlsRef = useRef<Record<string, string>>({});
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval>>();
  const msRef = useRef(0);
  const cancelRef = useRef(false);

  const loadReacts = useCallback(async () => {
    const ids = [...idsRef.current];
    if (!ids.length) return setReacts([]);
    const r = await sb.from("message_reactions").select("message_id,user_id,emoji").in("message_id", ids);
    if (r.data) setReacts(r.data as Re[]);
  }, []);

  const loadMembers = useCallback(async () => {
    const mem = await sb.from("chat_members").select("user_id,role,last_read_at,profiles(display_name,username,avatar_url,last_seen)").eq("chat_id", id);
    const rows = (mem.data ?? []) as unknown as MemRow[];
    setMembers(rows);
    setReads(Object.fromEntries(rows.map((r) => [r.user_id, new Date(r.last_read_at).getTime()])));
    return rows;
  }, [id]);

  const sign = useCallback(async (list: Att[]) => {
    const need = list.map((a) => a.path).filter((p) => !urlsRef.current[p]);
    if (!need.length) return;
    const { data } = await sb.storage.from("attachments").createSignedUrls(need, 21600);
    if (!data) return;
    const add: Record<string, string> = {};
    data.forEach((d) => { if (d.path && d.signedUrl) add[d.path] = d.signedUrl; });
    urlsRef.current = { ...urlsRef.current, ...add };
    setUrls((u) => ({ ...u, ...add }));
  }, []);

  const addAtt = useCallback((a: Att) => {
    setAtts((x) => (x.some((y) => y.id === a.id) ? x : [...x, a]));
    sign([a]);
  }, []);

  useEffect(() => {
    let alive = true;
    let ch: RealtimeChannel | undefined;
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || !alive) return;
      setMe(user.id);
      const cr = await sb.from("chats").select("id,type,title,description,slug,only_admins_post,pinned_message_id").eq("id", id).maybeSingle();
      if (cr.error || !cr.data) return setErr(cr.error?.message ?? "Чат не найден");
      const c = cr.data as Chat;
      setChat(c);
      const rows = await loadMembers();
      if (c.type === "direct" && !rows.some((r) => r.user_id !== user.id)) return setErr("Чат не найден");
      if (c.type === "channel") { const n = await sb.rpc("member_count", { cid: id }); setCount(Number(n.data ?? 0)); }
      const ms = await sb.from("messages").select("*").eq("chat_id", id).order("created_at", { ascending: false }).limit(100);
      if (ms.error) return setErr(ms.error.message);
      const list = ((ms.data ?? []) as Msg[]).reverse();
      idsRef.current = new Set(list.map((m) => m.id));
      setMsgs(list);
      loadReacts();
      if (list.length) {
        const ar = await sb.from("attachments").select("*").in("message_id", list.map((m) => m.id));
        const al = (ar.data ?? []) as Att[];
        setAtts(al);
        sign(al);
      }
      sb.rpc("mark_chat_read", { cid: id }).then(() => {});
      ch = sb.channel("chat:" + id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, (p) => {
          const m = p.new as Msg;
          idsRef.current.add(m.id);
          setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
          if (m.sender_id !== user.id) sb.rpc("mark_chat_read", { cid: id }).then(() => {});
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${id}` }, (p) => {
          const m = p.new as Msg;
          setMsgs((x) => x.map((y) => (y.id === m.id ? m : y)));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "attachments", filter: `chat_id=eq.${id}` }, (p) => addAtt(p.new as Att))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members", filter: `chat_id=eq.${id}` }, (p) => {
          const r = p.new as { user_id: string; last_read_at: string };
          if (r.user_id !== user.id) setReads((x) => ({ ...x, [r.user_id]: new Date(r.last_read_at).getTime() }));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${id}` }, (p) => setChat((x) => (x ? { ...x, ...(p.new as Partial<Chat>) } : x)))
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
    return () => {
      alive = false;
      if (ch) sb.removeChannel(ch);
      clearInterval(tick.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id]);

  useEffect(() => { const t = setInterval(() => { loadMembers(); }, 30000); return () => clearInterval(t); }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, atts.length, typing]);

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      chRef.current?.send({ type: "broadcast", event: "typing", payload: {} });
    }
  }
  async function post(body: string): Promise<Msg | null> {
    const { data, error } = await sb.from("messages").insert({ chat_id: id, sender_id: me, body, reply_to: replyTo?.id ?? null }).select().single();
    if (error) { setErr("Не отправлено: " + error.message); return null; }
    setReplyTo(null);
    const m = data as Msg;
    idsRef.current.add(m.id);
    setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
    return m;
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
    if (!(await post(body))) setText(body);
  }
  async function sendAttachment(file: Blob, kind: Att["kind"], name: string, mime: string, durationMs?: number) {
    if (!me || busyUp) return;
    if (file.size > MAX) return setErr("Файл больше 10 МБ");
    setBusyUp(true); setErr(""); setMenu(false);
    const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from("attachments").upload(path, file, { contentType: mime });
    if (up.error) { setBusyUp(false); return setErr("Не удалось загрузить файл: " + up.error.message); }
    const caption = kind === "image" ? text.trim() : "";
    const body = caption || (kind === "image" ? "📷 Фото" : kind === "voice" ? "🎤 Голосовое сообщение" : "📎 " + name.slice(0, 100));
    const m = await post(body);
    if (!m) { sb.storage.from("attachments").remove([path]); setBusyUp(false); return; }
    if (caption) setText("");
    const { data, error } = await sb.from("attachments").insert({
      message_id: m.id, chat_id: id, path, kind, mime, name: name.slice(0, 200), size: file.size, duration_ms: durationMs ?? null,
    }).select().single();
    setBusyUp(false);
    if (error) return setErr("Не удалось прикрепить файл: " + error.message);
    addAtt(data as Att);
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>, kind: "image" | "file") {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!(kind === "image" ? IMG_OK : FILE_OK).includes(f.type)) return setErr("Этот тип файла не поддерживается");
    sendAttachment(f, kind, f.name, f.type);
  }

  async function startRec() {
    setErr(""); setMenu(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setErr("Браузер не поддерживает запись звука");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mt = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined);
      chunks.current = []; msRef.current = 0; setRecMs(0); cancelRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(tick.current);
        if (cancelRef.current) { setRec("idle"); return; }
        const blob = new Blob(chunks.current, { type: mr.mimeType || mt || "audio/mp4" });
        setVoice({ blob, url: URL.createObjectURL(blob), ms: msRef.current });
        setRec("preview");
      };
      mr.start();
      mrRef.current = mr;
      setRec("rec");
      tick.current = setInterval(() => {
        if (mrRef.current?.state === "recording") {
          msRef.current += 250; setRecMs(msRef.current);
          if (msRef.current >= 300000) mrRef.current.stop();
        }
      }, 250);
    } catch {
      setErr("Нет доступа к микрофону. Разрешите его для сайта в настройках Safari.");
    }
  }
  const stopRec = () => mrRef.current?.stop();
  const cancelRec = () => { cancelRef.current = true; mrRef.current?.stop(); };
  function togglePause() {
    const mr = mrRef.current;
    if (!mr) return;
    if (mr.state === "recording") { mr.pause(); setRec("paused"); } else if (mr.state === "paused") { mr.resume(); setRec("rec"); }
  }
  function discardVoice() {
    if (voice) URL.revokeObjectURL(voice.url);
    setVoice(null); setRec("idle");
  }
  async function sendVoice() {
    if (!voice) return;
    const mime = (voice.blob.type || "audio/mp4").split(";")[0];
    const ext = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "m4a";
    await sendAttachment(voice.blob, "voice", `voice.${ext}`, mime, voice.ms);
    discardVoice();
  }

  async function pin(m: Msg | null) {
    setSel(null);
    const { error } = await sb.rpc("pin_message", { cid: id, mid: m?.id ?? null });
    if (error) return setErr("Не удалось закрепить: " + error.message);
    setChat((x) => (x ? { ...x, pinned_message_id: m?.id ?? null } : x));
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

  if (!chat) return (
    <div className="mx-auto max-w-xl px-4 pt-8">
      <button onClick={() => router.push("/chats")} className="text-green">← Назад</button>
      <p className={`mt-4 ${err ? "text-err" : "text-muted"}`}>{err || "Загрузка…"}</p>
    </div>
  );
  const isDirect = chat.type === "direct";
  const isChannel = chat.type === "channel";
  const otherM = members.find((m) => m.user_id !== me);
  const myRole = members.find((m) => m.user_id === me)?.role ?? "member";
  const isAdmin = myRole === "owner" || myRole === "admin";
  const canPost = isDirect || (chat.type === "group" ? !chat.only_admins_post || isAdmin : isAdmin);
  const title = isDirect ? otherM?.profiles?.display_name ?? "Чат" : chat.title ?? "Без названия";
  const online = isDirect && !!otherM?.profiles?.last_seen && Date.now() - new Date(otherM.profiles.last_seen).getTime() < 120000;
  const sub = isDirect ? (online ? "в сети" : "@" + (otherM?.profiles?.username ?? ""))
    : isChannel ? `подписчиков: ${count}` : `участников: ${members.length}`;
  const others = members.filter((m) => m.user_id !== me);
  const minRead = others.length ? Math.min(...others.map((m) => reads[m.user_id] ?? 0)) : 0;
  const pinned = chat.pinned_message_id ? msgs.find((m) => m.id === chat.pinned_message_id) : undefined;
  const selHasAtt = sel ? atts.some((a) => a.message_id === sel.id) : false;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-bg2 px-3 py-3 md:px-6">
        <button onClick={() => router.push("/chats")} aria-label="Назад" className="p-1 text-green md:hidden"><ArrowLeft size={22} /></button>
        <Avatar path={isDirect ? otherM?.profiles?.avatar_url : null} name={title} size={36} />
        <button onClick={() => (isDirect ? otherM && router.push("/user/" + otherM.user_id) : setInfo(true))} className="min-w-0 flex-1 text-left">
          <div className="truncate font-medium leading-tight">{title}</div>
          <div className={`text-xs ${typing || online ? "text-green" : "text-muted"}`}>{typing ? <>{isDirect ? "печатает" : "кто-то печатает"}<span className="dots ml-1"><i /><i /><i /></span></> : sub}</div>
        </button>
        {!isDirect && <button onClick={() => setInfo(true)} aria-label="Информация" className="text-muted"><Info size={22} /></button>}
      </header>
      {chat.pinned_message_id && (
        <button onClick={() => document.getElementById("m-" + chat.pinned_message_id)?.scrollIntoView({ block: "center" })}
          className="flex items-center gap-2 border-b border-line bg-bg2 px-4 py-2 text-left text-sm">
          <Pin size={16} className="shrink-0 text-green" />
          <span className="truncate text-muted">{pinned ? (pinned.deleted_at ? "Сообщение удалено" : pinned.body) : "Закреплённое сообщение"}</span>
        </button>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 md:px-6">
        {msgs.length === 0 && <p className="m-auto text-sm text-muted">Сообщений пока нет. Напишите первым.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          const rep = m.reply_to ? msgs.find((x) => x.id === m.reply_to) : undefined;
          const at = atts.filter((a) => a.message_id === m.id);
          const showBody = !at.length || (at[0].kind === "image" && m.body !== "📷 Фото");
          const g: Record<string, { n: number; mine: boolean }> = {};
          reacts.filter((r) => r.message_id === m.id).forEach((r) => {
            g[r.emoji] = { n: (g[r.emoji]?.n ?? 0) + 1, mine: (g[r.emoji]?.mine ?? false) || r.user_id === me };
          });
          const isRead = minRead > 0 && new Date(m.created_at).getTime() <= minRead;
          const sender = !mine && chat.type === "group" ? members.find((x) => x.user_id === m.sender_id)?.profiles?.display_name ?? "Бывший участник" : "";
          return (
            <div key={m.id} id={"m-" + m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div onClick={() => !m.deleted_at && setSel(m)}
                className={`max-w-[82%] cursor-pointer rounded-2xl px-3.5 py-2 text-left text-[15px] break-words md:max-w-[60%] ${Date.now() - new Date(m.created_at).getTime() < 8000 ? "animate-pop" : ""} ${mine ? "bg-dgreen" : "border border-line bg-card"} ${m.deleted_at ? "italic text-muted" : ""}`}>
                {sender && <div className="mb-0.5 text-xs font-semibold text-green">{sender}</div>}
                {rep && <div className="mb-1 truncate border-l-2 border-green pl-2 text-xs text-muted">{rep.deleted_at ? "Сообщение удалено" : rep.body}</div>}
                {!m.deleted_at && at.map((a) => {
                  const u = urls[a.path];
                  if (a.kind === "image") return (
                    <a key={a.id} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {u ? <img src={u} alt={a.name} className="mb-1 max-h-72 max-w-full rounded-xl object-cover" /> : <div className="mb-1 h-40 w-48 animate-pulse rounded-xl bg-bg2" />}
                    </a>
                  );
                  if (a.kind === "voice") return u
                    ? <VoicePlayer key={a.id} src={u} durationMs={a.duration_ms ?? 0} />
                    : <span key={a.id} className="text-sm text-muted">Загрузка…</span>;
                  return (
                    <a key={a.id} href={u} download={a.name} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                      <FileText size={24} className="shrink-0 text-green" />
                      <span className="min-w-0"><span className="block truncate text-sm">{a.name}</span><span className="text-xs opacity-60">{fmtSize(a.size)}</span></span>
                    </a>
                  );
                })}
                {(showBody || m.deleted_at) && <span className="whitespace-pre-wrap">{m.deleted_at ? "Сообщение удалено" : m.body}</span>}
                <span className="ml-2 inline-flex items-center gap-1 align-bottom text-[11px] opacity-60">
                  {m.edited_at && !m.deleted_at && "изм."}{hm(m.created_at)}
                  {mine && !m.deleted_at && !isChannel && (isRead ? <CheckCheck size={14} className="text-green" /> : <Check size={14} />)}
                </span>
              </div>
              {Object.keys(g).length > 0 && (
                <div className="mt-1 flex gap-1">
                  {Object.entries(g).map(([e, v]) => (
                    <button key={e} onClick={() => react(m, e)} className={`animate-pop rounded-full border px-2 py-0.5 text-xs ${v.mine ? "border-green" : "border-line"}`}>{e} {v.n}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {err && <p className="px-4 pb-1 text-sm text-err">{err}</p>}
      {busyUp && <p className="px-4 pb-1 text-sm text-muted">Отправка файла…</p>}
      {sel && (
        <div className="animate-page border-t border-line bg-bg2 px-3 py-2">
          <div className="flex items-center gap-3">
            {EMOJI.map((e) => <button key={e} onClick={() => react(sel, e)} className="text-2xl">{e}</button>)}
            <button onClick={() => setSel(null)} aria-label="Закрыть" className="ml-auto text-muted"><X size={20} /></button>
          </div>
          <div className="mt-2 flex gap-5 text-sm">
            <button onClick={() => { setReplyTo(sel); setEditing(null); setSel(null); }} className="flex items-center gap-1 text-green"><Reply size={16} />Ответить</button>
            {!isDirect && isAdmin && (chat.pinned_message_id === sel.id
              ? <button onClick={() => pin(null)} className="flex items-center gap-1 text-green"><PinOff size={16} />Открепить</button>
              : <button onClick={() => pin(sel)} className="flex items-center gap-1 text-green"><Pin size={16} />Закрепить</button>)}
            {sel.sender_id === me && <>
              {!selHasAtt && <button onClick={() => { setEditing(sel); setReplyTo(null); setText(sel.body); setSel(null); }} className="flex items-center gap-1 text-green"><Pencil size={16} />Изменить</button>}
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
      {!canPost ? (
        <p className="border-t border-line bg-bg2 px-4 py-4 text-center text-sm text-muted pb-safe">{isChannel ? "В канале пишут только администраторы" : "Писать в группу могут только администраторы"}</p>
      ) : <>
      {menu && rec === "idle" && (
        <div className="flex gap-6 border-t border-line bg-bg2 px-4 py-3 text-sm">
          <button onClick={() => imgRef.current?.click()} className="flex items-center gap-2 text-green"><ImageIcon size={20} />Фото</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-green"><FileText size={20} />Файл</button>
        </div>
      )}
      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e, "image")} />
      <input ref={fileRef} type="file" accept=".pdf,.txt,.zip,.docx,.xlsx" className="hidden" onChange={(e) => onPick(e, "file")} />
      {rec === "idle" ? (
        <div className="flex items-center gap-2 border-t border-line bg-bg2 px-3 pt-2 pb-safe md:px-6">
          <button onClick={() => setMenu((v) => !v)} aria-label="Прикрепить" className="p-1 text-muted"><Paperclip size={22} /></button>
          <input value={text} onChange={(e) => onType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} maxLength={4000}
            placeholder="Сообщение" className="my-2 min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-base outline-none focus:border-green" />
          {text.trim()
            ? <button onClick={send} aria-label="Отправить" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg"><Send size={18} /></button>
            : <button onClick={startRec} aria-label="Записать голосовое" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg"><Mic size={18} /></button>}
        </div>
      ) : (
        <div className="flex items-center gap-3 border-t border-line bg-bg2 px-3 py-3 pb-safe md:px-6">
          {rec === "preview" && voice ? (<>
            <button onClick={discardVoice} aria-label="Удалить запись" className="text-err"><Trash2 size={22} /></button>
            <div className="flex-1"><VoicePlayer src={voice.url} durationMs={voice.ms} /></div>
            <button onClick={sendVoice} disabled={busyUp} aria-label="Отправить" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg disabled:opacity-60"><Send size={18} /></button>
          </>) : (<>
            <button onClick={cancelRec} aria-label="Отменить запись" className="text-err"><X size={22} /></button>
            <span className={`h-2.5 w-2.5 rounded-full bg-err ${rec === "rec" ? "animate-pulse" : ""}`} />
            <span className="tabular-nums">{fmtT(recMs)}</span>
            <span className="text-sm text-muted">{rec === "paused" ? "Пауза" : "Запись…"}</span>
            <button onClick={togglePause} aria-label={rec === "paused" ? "Продолжить" : "Пауза"} className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-line">
              {rec === "paused" ? <Mic size={18} /> : <Pause size={18} />}
            </button>
            <button onClick={stopRec} aria-label="Стоп" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg"><Square size={16} /></button>
          </>)}
        </div>
      )}
      </>}
      {info && <ChatInfo chat={chat} members={members} me={me} count={count} onClose={() => setInfo(false)} onChanged={() => loadMembers()} onLeft={() => router.replace("/chats")} />}
    </div>
  );
}
