import Link from "next/link";
import { Search } from "lucide-react";
import { chats } from "@/lib/demo";
export default function ChatsPage() {
  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold">Чаты</h1>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-bg2 border border-line px-3 py-2.5 text-muted">
        <Search size={18} /><span className="text-sm">Поиск</span>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {chats.map((c) => (
          <li key={c.id}>
            <Link href={`/chat/${c.id}`} className="flex items-center gap-3 py-3 active:opacity-70">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-dgreen text-lg font-semibold">{c.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between"><span className="font-medium truncate">{c.name}</span><span className="text-xs text-muted">{c.time}</span></div>
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm text-muted">{c.last}</span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-green px-1.5 text-xs font-semibold text-bg">{c.unread}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
