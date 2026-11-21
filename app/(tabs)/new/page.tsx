"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-green";

export default function NewChatPage() {
  const sb = createClient();
  const router = useRouter();
  const [kind, setKind] = useState<"group" | "channel">("group");
  const [title, setTitle] = useState("");
  const [descr, setDescr] = useState("");
  const [pub, setPub] = useState(true);
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (new URLSearchParams(location.search).get("type") === "channel") setKind("channel"); }, []);

  async function create() {
    setErr("");
    const s = slug.trim().toLowerCase().replace(/^@/, "");
    if (!title.trim()) return setErr("Введите название");
    if (kind === "channel" && pub && !/^[a-z0-9_]{3,32}$/.test(s)) return setErr("Адрес: 3–32 символа, латиница, цифры и _");
    setBusy(true);
    const { data, error } = await sb.rpc("create_chat", {
      kind, ttl: title.trim(), descr: descr.trim(), pub: kind === "channel" && pub, slg: kind === "channel" && pub ? s : null,
    });
    setBusy(false);
    if (error || !data) return setErr(error?.message.includes("slug") || error?.message.includes("duplicate") ? "Этот адрес занят" : "Не удалось создать: " + (error?.message ?? ""));
    router.replace("/chat/" + data);
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">Создать</h1>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg2 p-1 text-sm">
        {(["group", "channel"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-lg py-2 ${kind === k ? "bg-card text-green" : "text-muted"}`}>{k === "group" ? "Группа" : "Канал"}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <input className={input} placeholder="Название" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={input} rows={3} placeholder="Описание (необязательно)" maxLength={500} value={descr} onChange={(e) => setDescr(e.target.value)} />
        {kind === "channel" && <>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg2 p-1 text-sm">
            <button onClick={() => setPub(true)} className={`rounded-lg py-2 ${pub ? "bg-card text-green" : "text-muted"}`}>Публичный</button>
            <button onClick={() => setPub(false)} className={`rounded-lg py-2 ${!pub ? "bg-card text-green" : "text-muted"}`}>Приватный</button>
          </div>
          {pub
            ? <input className={input} placeholder="Адрес (латиницей), например vortex_news" autoCapitalize="none" value={slug} onChange={(e) => setSlug(e.target.value)} />
            : <p className="text-sm text-muted">Вступить в приватный канал можно только по ссылке-приглашению.</p>}
        </>}
        {err && <p className="text-sm text-err">{err}</p>}
        <button onClick={create} disabled={busy} className="rounded-xl bg-green py-3 font-semibold text-bg disabled:opacity-60">{busy ? "…" : "Создать"}</button>
      </div>
    </div>
  );
}
