"use client";
import { useState } from "react";
import { X, Crown, Shield, UserMinus, Link2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Prof = { display_name: string; username: string };
export type Member = { user_id: string; role: string; profiles: Prof | null };
type ChatT = { id: string; type: string; title: string | null; description: string; slug: string | null; only_admins_post: boolean };
const input = "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-green";

export default function ChatInfo({ chat, members, me, count, onClose, onChanged, onLeft }: {
  chat: ChatT; members: Member[]; me: string; count: number;
  onClose: () => void; onChanged: () => void; onLeft: () => void;
}) {
  const sb = createClient();
  const myRole = members.find((m) => m.user_id === me)?.role ?? "member";
  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";
  const isChannel = chat.type === "channel";
  const [title, setTitle] = useState(chat.title ?? "");
  const [descr, setDescr] = useState(chat.description);
  const [only, setOnly] = useState(chat.only_admins_post);
  const [link, setLink] = useState("");
  const [uname, setUname] = useState("");
  const [msg, setMsg] = useState("");

  async function call(name: string, args: Record<string, unknown>, ok = "Готово") {
    setMsg("");
    const { error } = await sb.rpc(name, args);
    if (error) { setMsg("Ошибка: " + error.message); return false; }
    setMsg(ok); onChanged(); return true;
  }
  async function showInvite() {
    const { data, error } = await sb.rpc("get_invite", { cid: chat.id });
    if (error || !data) return setMsg("Не удалось получить ссылку");
    setLink(location.origin + "/join/" + data);
  }
  async function addByName() {
    const u = uname.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    const { data } = await sb.from("profiles").select("id").eq("username", u).maybeSingle();
    if (!data) return setMsg("Пользователь не найден");
    if (await call("add_member", { cid: chat.id, uid: data.id }, "Добавлен")) setUname("");
  }
  async function leave() {
    const { error } = await sb.rpc("leave_chat", { cid: chat.id });
    if (error) return setMsg("Ошибка: " + error.message);
    onLeft();
  }
  const showList = !isChannel || isAdmin;

  return (
    <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-bg2 p-4 pb-safe" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isChannel ? "О канале" : "О группе"}</h2>
          <button onClick={onClose} aria-label="Закрыть"><X size={22} /></button>
        </div>
        {isAdmin ? (
          <div className="mt-4 flex flex-col gap-2">
            <input className={input} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Название" />
            <textarea className={input} rows={3} value={descr} maxLength={500} onChange={(e) => setDescr(e.target.value)} placeholder="Описание" />
            {!isChannel && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="accent-green" />
                Писать могут только администраторы
              </label>
            )}
            <button onClick={() => call("update_chat", { cid: chat.id, ttl: title, descr, onlyadm: only }, "Сохранено")} className="rounded-xl bg-green py-2.5 font-semibold text-bg">Сохранить</button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xl font-semibold">{chat.title}</p>
            {chat.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{chat.description}</p>}
          </div>
        )}
        {chat.slug && <p className="mt-3 break-all text-sm text-muted">Публичная ссылка: {typeof location !== "undefined" ? location.origin : ""}/c/{chat.slug}</p>}
        {isAdmin && (
          <div className="mt-4">
            {link ? (
              <div className="rounded-xl border border-line bg-card p-3 text-sm">
                <p className="break-all">{link}</p>
                <button onClick={() => { navigator.clipboard?.writeText(link); setMsg("Ссылка скопирована"); }} className="mt-2 text-green">Скопировать</button>
              </div>
            ) : (
              <button onClick={showInvite} className="flex items-center gap-2 text-green"><Link2 size={18} />Ссылка-приглашение</button>
            )}
            <div className="mt-4 flex gap-2">
              <input className={input} placeholder="Добавить по username" autoCapitalize="none" value={uname} onChange={(e) => setUname(e.target.value)} />
              <button onClick={addByName} className="rounded-xl bg-green px-4 font-semibold text-bg">+</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
        <h3 className="mt-5 text-sm text-muted">{isChannel ? `Подписчиков: ${count}` : `Участники: ${members.length}`}</h3>
        {showList && (
          <ul className="mt-2 divide-y divide-line">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-dgreen text-sm font-semibold">{m.profiles?.display_name[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.profiles?.display_name}{m.user_id === me ? " (вы)" : ""}</div>
                  <div className="text-xs text-muted">@{m.profiles?.username}</div>
                </div>
                {m.role === "owner" && <Crown size={16} className="text-green" />}
                {m.role === "admin" && <Shield size={16} className="text-green" />}
                {isOwner && m.role !== "owner" && (
                  <button onClick={() => call("set_role", { cid: chat.id, uid: m.user_id, r: m.role === "admin" ? "member" : "admin" })} className="text-xs text-green">
                    {m.role === "admin" ? "Снять админа" : "Сделать админом"}
                  </button>
                )}
                {isAdmin && m.role !== "owner" && m.user_id !== me && (isOwner || m.role === "member") && (
                  <button onClick={() => call("remove_member", { cid: chat.id, uid: m.user_id }, "Удалён")} aria-label="Удалить" className="text-err"><UserMinus size={18} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
        <button onClick={leave} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-err">
          <LogOut size={18} />{isChannel ? "Отписаться" : "Покинуть группу"}
        </button>
      </div>
    </div>
  );
}
