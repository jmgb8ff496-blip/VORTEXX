import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/chats";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/chats";
  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(url.origin + next);
  }
  return NextResponse.redirect(url.origin + "/login");
}
