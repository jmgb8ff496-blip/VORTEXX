import { avatarSrc } from "@/lib/accent";

export default function Avatar({ path, name, size = 44 }: { path?: string | null; name: string; size?: number }) {
  const src = avatarSrc(path);
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return src
    ? <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />
    : <div style={style} className="grid shrink-0 place-items-center rounded-full bg-dgreen font-semibold">{name[0]?.toUpperCase()}</div>;
}
