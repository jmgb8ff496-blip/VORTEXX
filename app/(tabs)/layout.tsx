"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import SideRail from "@/components/SideRail";
import ChatsList from "@/components/ChatsList";
import { createClient } from "@/lib/supabase/client";
import { applyAccent } from "@/lib/accent";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const inChat = path.startsWith("/chat/");

  useEffect(() => {
    const sb = createClient();
    const cached = localStorage.getItem("vx-accent");
    if (cached) applyAccent(cached);
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const r = await sb.from("profiles").select("accent").eq("id", user.id).maybeSingle();
      const a = (r.data as { accent: string } | null)?.accent;
      if (a) { applyAccent(a); localStorage.setItem("vx-accent", a); }
    })();
    const ping = () => { sb.rpc("touch_presence").then(() => {}); };
    ping();
    const t = setInterval(ping, 60000);
    const vis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);

  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top))]">
      <SideRail />
      <aside className={`${inChat ? "hidden md:block" : "block"} w-full overflow-y-auto pb-24 md:w-[380px] md:shrink-0 md:border-r md:border-line md:pb-0`}>
        {inChat ? <ChatsList /> : <div key={path} className="animate-page">{children}</div>}
      </aside>
      <main className={`${inChat ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {inChat ? (
          <div key={path} className="flex min-h-0 flex-1 animate-page flex-col">{children}</div>
        ) : (
          <div className="m-auto flex animate-fade flex-col items-center gap-3 text-muted">
            <MessageCircle size={48} className="text-dgreen" />
            <p>Выберите чат, чтобы начать переписку</p>
          </div>
        )}
      </main>
      {!inChat && <BottomNav />}
    </div>
  );
}
