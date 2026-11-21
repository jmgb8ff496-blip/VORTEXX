"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const sb = createClient();
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("join_by_invite", { code_in: code });
      if (error || !data) return setErr("Ссылка недействительна или устарела");
      router.replace("/chat/" + data);
    })();
  }, [code]);
  return <p className={`px-4 pt-8 ${err ? "text-err" : "text-muted"}`}>{err || "Вступаем…"}</p>;
}
