import { MessageCircle, Users, Megaphone, User, type LucideIcon } from "lucide-react";
export const NAV: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/chats", label: "Чаты", Icon: MessageCircle },
  { href: "/contacts", label: "Контакты", Icon: Users },
  { href: "/channels", label: "Каналы", Icon: Megaphone },
  { href: "/profile", label: "Профиль", Icon: User },
];
export const isActive = (path: string, href: string) =>
  href === "/chats" ? path.startsWith("/chat") : path.startsWith(href);
