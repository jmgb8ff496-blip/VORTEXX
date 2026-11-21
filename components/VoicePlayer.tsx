"use client";
import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function VoicePlayer({ src, durationMs }: { src: string; durationMs: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const total = durationMs / 1000;
  const dur = () => { const d = ref.current?.duration; return d && Number.isFinite(d) ? d : total || 1; };
  const toggle = () => { const a = ref.current; if (!a) return; if (a.paused) a.play(); else a.pause(); };
  return (
    <div className="flex w-56 max-w-full items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <audio ref={ref} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setT(0); }} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
      <button onClick={toggle} aria-label={playing ? "Пауза" : "Воспроизвести"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green text-bg">
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <input type="range" min={0} max={1000} value={Math.min(1000, Math.round((t / dur()) * 1000))} className="h-1 w-full accent-green"
          onChange={(e) => { const a = ref.current; if (a) a.currentTime = (Number(e.target.value) / 1000) * dur(); }} />
        <div className="mt-0.5 text-[11px] opacity-60">{fmt(playing || t > 0 ? t : total)}</div>
      </div>
    </div>
  );
}
