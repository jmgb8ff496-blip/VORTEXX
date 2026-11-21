"use client";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import SideRail from "@/components/SideRail";
import ChatsList from "@/components/ChatsList";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const inChat = usePathname().startsWith("/chat/");
  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top))]">
      <SideRail />
      <aside className={`${inChat ? "hidden md:block" : "block"} w-full overflow-y-auto pb-24 md:w-[380px] md:shrink-0 md:border-r md:border-line md:pb-0`}>
        {inChat ? <ChatsList /> : children}
      </aside>
      <main className={`${inChat ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {inChat ? children : (
          <div className="m-auto flex flex-col items-center gap-3 text-muted">
            <MessageCircle size={48} className="text-dgreen" />
            <p>Выберите чат, чтобы начать переписку</p>
          </div>
        )}
      </main>
      {!inChat && <BottomNav />}
    </div>
  );
}
