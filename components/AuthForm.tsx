"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "reset" | "update";
const TITLE = { login: "Вход", register: "Регистрация", reset: "Восстановление пароля", update: "Новый пароль" };
const BTN = { login: "Войти", register: "Создать аккаунт", reset: "Отправить ссылку", update: "Сохранить пароль" };
const ru = (m: string) =>
  m.includes("Invalid login") ? "Неверная почта или пароль"
  : m.includes("already registered") ? "Эта почта уже зарегистрирована"
  : m.includes("Email not confirmed") ? "Подтвердите почту по письму"
  : m.includes("rate limit") ? "Слишком много попыток, подождите"
  : m;
const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-green";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo(""); setBusy(true);
    const sb = createClient();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/chats"); router.refresh();
      } else if (mode === "register") {
        const u = username.trim().toLowerCase().replace(/^@/, "");
        if (!/^[a-z0-9_]{3,20}$/.test(u)) throw new Error("Username: 3–20 символов, латиница, цифры и _");
        if (password.length < 8) throw new Error("Пароль не короче 8 символов");
        const { data: free } = await sb.rpc("username_available", { u });
        if (free === false) throw new Error("Этот username уже занят");
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { username: u, display_name: name.trim() || u }, emailRedirectTo: location.origin + "/auth/callback" },
        });
        if (error) throw error;
        if (data.session) { router.replace("/chats"); router.refresh(); }
        else setInfo("Мы отправили письмо. Подтвердите почту, затем войдите.");
      } else if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/auth/callback?next=/update-password" });
        if (error) throw error;
        setInfo("Если такая почта есть, мы отправили ссылку для сброса.");
      } else {
        if (password.length < 8) throw new Error("Пароль не короче 8 символов");
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/chats"); router.refresh();
      }
    } catch (e) { setErr(ru((e as Error).message)); }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 pb-safe">
      <h1 className="text-3xl font-semibold text-green">VORTEX</h1>
      <p className="mb-6 mt-1 text-muted">{TITLE[mode]}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "register" && <>
          <input className={input} placeholder="Username (латиницей)" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input className={input} placeholder="Отображаемое имя" value={name} onChange={(e) => setName(e.target.value)} />
        </>}
        {mode !== "update" && <input className={input} type="email" placeholder="Почта" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        {mode !== "reset" && <input className={input} type="password" placeholder={mode === "update" ? "Новый пароль" : "Пароль"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />}
        {err && <p className="text-sm text-err">{err}</p>}
        {info && <p className="text-sm text-green">{info}</p>}
        <button disabled={busy} className="rounded-xl bg-green py-3 font-semibold text-bg disabled:opacity-60">{busy ? "…" : BTN[mode]}</button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-sm text-muted">
        {mode === "login" && <><Link href="/register" className="text-green">Создать аккаунт</Link><Link href="/reset">Забыли пароль?</Link></>}
        {mode !== "login" && mode !== "update" && <Link href="/login" className="text-green">Уже есть аккаунт? Войти</Link>}
      </div>
    </main>
  );
}
