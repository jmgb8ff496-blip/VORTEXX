import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
const PUBLIC = ["/login", "/register", "/reset", "/auth"];
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // ключи Supabase ещё не заданы
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((x) => p.startsWith(x));
  if (!user && !isPublic) { const u = new URL("/login", req.url); u.searchParams.set("next", p); return NextResponse.redirect(u); }
  if (user && (p === "/login" || p === "/register")) return NextResponse.redirect(new URL("/chats", req.url));
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest).*)"] };
