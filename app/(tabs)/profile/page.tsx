import { Settings, Shield, Palette } from "lucide-react";
export default function ProfilePage() {
  return (
    <div className="px-4 pt-6">
      <div className="flex flex-col items-center rounded-2xl border border-line bg-card p-6">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-dgreen text-4xl font-semibold">V</div>
        <h1 className="mt-3 text-xl font-semibold">Гость</h1>
        <p className="text-sm text-muted">Войдите, чтобы видеть свой профиль (этап 2)</p>
      </div>
      <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-card divide-y divide-line text-sm">
        {[[Settings, "Настройки"], [Shield, "Приватность"], [Palette, "Оформление"]].map(([I, t]) => {
          const Icon = I as typeof Settings;
          return <li key={t as string} className="flex items-center gap-3 px-4 py-3.5 text-muted"><Icon size={20} className="text-green" />{t as string}<span className="ml-auto text-xs">этап 6</span></li>;
        })}
      </ul>
    </div>
  );
}
