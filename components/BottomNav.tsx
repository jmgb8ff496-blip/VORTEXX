"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Users, Megaphone, User } from "lucide-react";
const items = [
  { href: "/chats", label: "Чаты", Icon: MessageCircle },
  { href: "/contacts", label: "Контакты", Icon: Users },
  { href: "/channels", label: "Каналы", Icon: Megaphone },
  { href: "/profile", label: "Профиль", Icon: User },
];
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg2/95 backdrop-blur pb-safe">
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${on ? "text-green" : "text-muted"}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
