"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type P = { cid: string; ctitle: string; cdescr: string; cmembers: number; cis_member: boolean };

export default function PublicChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const sb = createClient();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [state, setState] = useState<"load" | "ok" | "none">("load");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("channel_preview", { slg: slug });
      const row = ((data ?? []) as P[])[0];
      if (error || !row) return setState("none");
      if (row.cis_member) return router.replace("/chat/" + row.cid);
      setP(row); setState("ok");
    })();
  }, [slug]);

  async function join() {
    setErr("");
    const { data, error } = await sb.rpc("join_public_channel", { slg: slug });
    if (error || !data) return setErr("Не удалось подписаться");
    router.replace("/chat/" + data);
  }

  if (state === "load") return <p className="px-4 pt-8 text-muted">Загрузка…</p>;
  if (state === "none" || !p) return <p className="px-4 pt-8 text-err">Канал не найден</p>;
  return (
    <div className="px-4 pt-10 text-center">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-dgreen"><Megaphone size={40} /></div>
      <h1 className="mt-4 text-2xl font-semibold">{p.ctitle}</h1>
      <p className="text-sm text-muted">@{slug} · {p.cmembers} подписчиков</p>
      {p.cdescr && <p className="mt-4 whitespace-pre-wrap text-sm">{p.cdescr}</p>}
      {err && <p className="mt-3 text-sm text-err">{err}</p>}
      <button onClick={join} className="mt-6 w-full rounded-xl bg-green py-3 font-semibold text-bg">Подписаться</button>
    </div>
  );
}
