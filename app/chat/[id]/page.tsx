"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { chats } from "@/lib/demo";
type Msg = { id: number; mine: boolean; text: string };
export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const chat = chats.find((c) => c.id === id);
  const [msgs, setMsgs] = useState<Msg[]>(chat ? [{ id: 0, mine: false, text: chat.last }] : []);
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { id: m.length + 1, mine: true, text: t }]);
    setText("");
  };
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-bg2 px-3 py-3">
        <button onClick={() => router.push("/chats")} aria-label="Назад" className="p-1 text-green"><ArrowLeft size={22} /></button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-dgreen font-semibold">{chat?.name[0] ?? "?"}</div>
        <span className="font-medium">{chat?.name ?? "Чат не найден"}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] break-words ${m.mine ? "self-end bg-dgreen" : "self-start bg-card border border-line"}`}>{m.text}</div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-bg2 px-3 pt-2 pb-safe">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Сообщение" className="my-2 min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-base outline-none focus:border-green" />
        <button onClick={send} aria-label="Отправить" className="grid h-10 w-10 place-items-center rounded-full bg-green text-bg"><Send size={18} /></button>
      </div>
    </div>
  );
}
