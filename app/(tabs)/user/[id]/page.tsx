"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { BGS } from "@/lib/accent";

type P = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; accent: string; bg_style: string; last_seen: string | null };

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const sb = createClient();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [none, setNone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await sb.from("profiles").select("id,username,display_name,bio,avatar_url,accent,bg_style,last_seen").eq("id", id).maybeSingle();
      if (r.error || !r.data) return setNone(true);
      setP(r.data as P);
    })();
  }, [id]);

  async function write() {
    const { data, error } = await sb.rpc("start_direct_chat", { other: id });
    if (error || !data) return setErr("Не удалось открыть чат");
    router.push("/chat/" + data);
  }

  if (none) return <p className="px-4 pt-8 text-err">Пользователь не найден</p>;
  if (!p) return <div className="px-4 pt-6"><div className="skeleton h-56 w-full" /></div>;
  const online = !!p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 120000;
  const bg = BGS[p.bg_style]?.css;
  return (
    <div className="px-4 pt-6">
      <button onClick={() => router.back()} aria-label="Назад" className="text-green"><ArrowLeft size={22} /></button>
      <div className="mt-3 flex flex-col items-center rounded-2xl border border-line bg-card p-6" style={bg ? { background: bg } : undefined}>
        <div className="rounded-full p-[3px]" style={{ boxShadow: `0 0 0 3px ${p.accent}` }}><Avatar path={p.avatar_url} name={p.display_name} size={96} /></div>
        <h1 className="mt-3 text-xl font-semibold">{p.display_name}</h1>
        <p className="text-sm text-muted">@{p.username}</p>
        {online && <p className="mt-1 flex items-center gap-1.5 text-sm text-green"><span className="h-2 w-2 animate-pulse rounded-full bg-green" />в сети</p>}
        {p.bio && <p className="mt-3 whitespace-pre-wrap text-center text-sm">{p.bio}</p>}
      </div>
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <button onClick={write} className="mt-4 w-full rounded-xl bg-green py-3 font-semibold text-bg">Написать</button>
    </div>
  );
}
