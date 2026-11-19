// ВРЕМЕННЫЕ данные этапа 1 (только UI). На этапе 3 заменяются запросами к Supabase.
export type Chat = { id: string; name: string; last: string; time: string; unread: number };
export const chats: Chat[] = [
  { id: "1", name: "Алина", last: "Скинь макет, когда будет готов", time: "12:40", unread: 2 },
  { id: "2", name: "Команда VORTEX", last: "Релиз в пятницу", time: "11:05", unread: 0 },
  { id: "3", name: "Макс", last: "Голосовое сообщение", time: "Вчера", unread: 0 },
];
