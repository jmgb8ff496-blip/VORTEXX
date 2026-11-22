"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X, Eye, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";

type Author = { id: string; display_name: string; avatar_url: string | null };
type Story = { id: string; user_id: string; media_path: string; media_kind: "image" | "video"; caption: string; created_at: string; profiles: Author | null };
type Group = { author: Author; stories: Story[]; seen: boolean };
type Viewer = { viewer_id: string; viewed_at: string; profiles: { display_name: string; avatar_url: string | null } | null };
const MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч назад`;
};
const Ring = ({ seen, children }: { seen: boolean; children: React.ReactNode }) => (
  <div className={`rounded-full p-[2.5px] ${seen ? "bg-line" : "animate-ring bg-green"}`}>
    <div className="rounded-full bg-bg p-[2px]">{children}</div>
  </div>
);

export default function StoriesBar() {
  const sb = createClient();
  const [me, setMe] = useState<Author | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<Group | null>(null);
  const [compose, setCompose] = useState(false);
  const [err, setErr] = useState("");
  const openMineRef = useRef(false);

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const [p, r, v] = await Promise.all([
      sb.from("profiles").select("id,display_name,avatar_url").eq("id", user.id).maybeSingle(),
      sb.from("stories").select("id,user_id,media_path,media_kind,caption,created_at,profiles(id,display_name,avatar_url)")
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }),
      sb.from("story_views").select("story_id").eq("viewer_id", user.id),
    ]);
    if (r.error) setErr("Истории: " + r.error.message); else setErr("");
    if (p.data) setMe(p.data as Author);
    const seenIds = new Set(((v.data ?? []) as { story_id: string }[]).map((x) => x.story_id));
    const map = new Map<string, Group>();
    ((r.data ?? []) as unknown as Story[]).forEach((s) => {
      if (!s.profiles) return;
      const g = map.get(s.user_id) ?? { author: s.profiles, stories: [], seen: true };
      g.stories.push(s);
      if (!seenIds.has(s.id) && s.user_id !== user.id) g.seen = false;
      map.set(s.user_id, g);
    });
    setGroups([...map.values()]);
    if (openMineRef.current) {
      openMineRef.current = false;
      const g = map.get(user.id);
      if (g) setOpen(g); else setErr("История загружена, но не отображается. Обновите страницу.");
    }
  }, []);
  useEffect(() => { load(); }, []);

  const mine = groups.find((g) => g.author.id === me?.id);
  const others = groups.filter((g) => g.author.id !== me?.id).sort((a, b) => Number(a.seen) - Number(b.seen));
  return (
    <>
      <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <div className="relative w-16 shrink-0">
          <button onClick={() => (mine ? setOpen(mine) : setCompose(true))} className="flex w-full flex-col items-center gap-1">
            <Ring seen={!mine}><Avatar path={me?.avatar_url} name={me?.display_name ?? "Я"} size={52} /></Ring>
            <span className="w-full truncate text-center text-[11px] text-muted">Моя</span>
          </button>
          <button onClick={() => setCompose(true)} aria-label="Добавить историю" className="absolute right-0 top-9 grid h-5 w-5 place-items-center rounded-full bg-green text-bg"><Plus size={14} /></button>
        </div>
        {others.map((g) => (
          <button key={g.author.id} onClick={() => setOpen(g)} className="flex w-16 shrink-0 animate-pop flex-col items-center gap-1">
            <Ring seen={g.seen}><Avatar path={g.author.avatar_url} name={g.author.display_name} size={52} /></Ring>
            <span className="w-full truncate text-center text-[11px] text-muted">{g.author.display_name}</span>
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-err">{err}</p>}
      {open && <StoryViewer group={open} me={me?.id ?? ""} onClose={() => { setOpen(null); load(); }} />}
      {compose && <StoryComposer me={me?.id ?? ""} onClose={() => setCompose(false)} onDone={() => { setCompose(false); openMineRef.current = true; load(); }} />}
    </>
  );
}

function StoryViewer({ group, me, onClose }: { group: Group; me: string; onClose: () => void }) {
  const sb = createClient();
  const [list, setList] = useState<Story[]>(group.stories);
  const [i, setI] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [prog, setProg] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const progRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cur = list[i];
  const mineStory = cur?.user_id === me;
  const url = cur ? urls[cur.media_path] : undefined;

  useEffect(() => {
    (async () => {
      const { data } = await sb.storage.from("stories").createSignedUrls(group.stories.map((s) => s.media_path), 3600);
      const m: Record<string, string> = {};
      data?.forEach((d) => { if (d.path && d.signedUrl) m[d.path] = d.signedUrl; });
      setUrls(m);
    })();
  }, []);

  const go = (n: number) => { progRef.current = 0; setProg(0); setSheet(false); setI(n); };
  const next = () => (i < list.length - 1 ? go(i + 1) : onClose());
  const prev = () => go(i > 0 ? i - 1 : 0);

  useEffect(() => {
    if (!cur) return;
    if (!mineStory) {
      sb.from("story_views").insert({ story_id: cur.id, viewer_id: me }).then(() => {});
      setViewers([]);
    } else {
      sb.from("story_views").select("viewer_id,viewed_at,profiles(display_name,avatar_url)").eq("story_id", cur.id)
        .order("viewed_at", { ascending: false }).then((r) => setViewers((r.data ?? []) as unknown as Viewer[]));
    }
  }, [cur?.id]);

  useEffect(() => {
    if (!cur || !url || cur.media_kind !== "image" || sheet) return;
    const t = setInterval(() => {
      progRef.current += 0.01; setProg(progRef.current);
      if (progRef.current >= 1) { clearInterval(t); next(); }
    }, 50);
    return () => clearInterval(t);
  }, [i, url, sheet]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (sheet) v.pause(); else v.play().catch(() => {});
  }, [sheet, url, i]);

  async function del() {
    if (!cur) return;
    const s = cur;
    const { error } = await sb.from("stories").delete().eq("id", s.id);
    if (error) return;
    sb.storage.from("stories").remove([s.media_path]);
    const rest = list.filter((x) => x.id !== s.id);
    if (!rest.length) return onClose();
    setList(rest); go(Math.min(i, rest.length - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade flex-col bg-black">
      <div className="absolute inset-x-0 top-0 z-10 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <div className="flex gap-1">
          {list.map((s, k) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
              <div className="h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? prog * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 text-white">
          <Avatar path={group.author.avatar_url} name={group.author.display_name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{group.author.display_name}</div>
            <div className="text-xs opacity-70">{cur && ago(cur.created_at)}</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть"><X size={24} /></button>
        </div>
      </div>
      <div className="relative flex-1" onClick={(e) => (e.clientX < window.innerWidth / 3 ? prev() : next())}>
        {url && cur.media_kind === "image" && <img key={cur.id} src={url} alt="" className="h-full w-full animate-fade object-contain" />}
        {url && cur.media_kind === "video" && (
          <video key={cur.id} ref={videoRef} src={url} playsInline autoPlay className="h-full w-full object-contain"
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) { progRef.current = v.currentTime / v.duration; setProg(progRef.current); } }}
            onEnded={next} />
        )}
        {!url && <div className="absolute inset-0 grid place-items-center text-white/60">Загрузка…</div>}
      </div>
      {cur?.caption && <p className="pointer-events-none absolute inset-x-0 bottom-20 animate-page px-6 text-center text-white drop-shadow">{cur.caption}</p>}
      {mineStory && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] text-white">
          <button onClick={() => setSheet(true)} className="flex items-center gap-2"><Eye size={20} />{viewers.length}</button>
          <button onClick={del} aria-label="Удалить историю" className="text-err"><Trash2 size={20} /></button>
        </div>
      )}
      {sheet && (
        <div className="absolute inset-0 z-20 flex animate-fade items-end bg-black/50" onClick={() => setSheet(false)}>
          <div className="max-h-[60%] w-full animate-page overflow-y-auto rounded-t-2xl bg-bg2 p-4 pb-safe" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-semibold">Просмотры: {viewers.length}</h3>
            {viewers.length === 0 && <p className="text-sm text-muted">Пока никто не смотрел</p>}
            <ul className="divide-y divide-line">
              {viewers.map((v) => (
                <li key={v.viewer_id} className="flex items-center gap-3 py-2.5">
                  <Avatar path={v.profiles?.avatar_url} name={v.profiles?.display_name ?? "?"} size={36} />
                  <span className="flex-1 truncate text-sm">{v.profiles?.display_name}</span>
                  <span className="text-xs text-muted">{ago(v.viewed_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryComposer({ me, onClose, onDone }: { me: string; onClose: () => void; onDone: () => void }) {
  const sb = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [aud, setAud] = useState<"everyone" | "chats">("chats");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from("user_settings").select("story_audience").eq("user_id", me).maybeSingle().then((r) => {
      const a = (r.data as { story_audience: "everyone" | "chats" } | null)?.story_audience;
      if (a) setAud(a);
    });
  }, []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!MIME[f.type]) return setErr("Поддерживаются фото (JPG, PNG, WebP) и видео (MP4, MOV, WebM)");
    const limit = f.type.startsWith("video") ? 30 : 10;
    if (f.size > limit * 1048576) return setErr(`Файл больше ${limit} МБ`);
    setErr(""); setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function publish() {
    try { await publishInner(); } catch (x) { setBusy(false); setErr("Ошибка: " + (x as Error).message); }
  }
  async function publishInner() {
    if (!file) return;
    if (!me) return setErr("Профиль ещё загружается, попробуйте ещё раз через секунду");
    setBusy(true); setErr("");
    const path = `${me}/${crypto.randomUUID()}.${MIME[file.type]}`;
    const up = await sb.storage.from("stories").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setErr("Не удалось загрузить: " + up.error.message); }
    const { error } = await sb.from("stories").insert({
      user_id: me, media_path: path, media_kind: file.type.startsWith("video") ? "video" : "image", mime: file.type, caption: caption.trim(), audience: aud,
    });
    if (error) { sb.storage.from("stories").remove([path]); setBusy(false); return setErr("Не удалось опубликовать: " + error.message); }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-page flex-col bg-bg px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-safe">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Новая история</h2>
        <button onClick={onClose} aria-label="Закрыть"><X size={24} /></button>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line bg-bg2">
        {!file ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 text-green">
            <Plus size={32} /><span>Выбрать фото или видео</span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={pick} />
          </label>
        ) : file.type.startsWith("video")
          ? <video src={preview} controls playsInline className="max-h-full max-w-full" />
          : <img src={preview} alt="" className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg2 p-1 text-sm">
        <button onClick={() => setAud("chats")} className={`rounded-lg py-2 ${aud === "chats" ? "bg-card text-green" : "text-muted"}`}>Мои собеседники</button>
        <button onClick={() => setAud("everyone")} className={`rounded-lg py-2 ${aud === "everyone" ? "bg-card text-green" : "text-muted"}`}>Все</button>
      </div>
      <input value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} placeholder="Подпись (необязательно)"
        className="mt-3 w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-green" />
      {err && <p className="mt-2 text-sm text-err">{err}</p>}
      <button onClick={publish} disabled={!file || busy} className="my-3 rounded-xl bg-green py-3 font-semibold text-bg disabled:opacity-50">{busy ? "Публикуем…" : "Опубликовать"}</button>
    </div>
  );
}
