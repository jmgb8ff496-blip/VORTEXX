"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";
export default function SideRail() {
  const path = usePathname();
  return (
    <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg2 py-4 md:flex">
      <div className="mb-4 text-xl font-bold text-green">V</div>
      {NAV.map(({ href, label, Icon }) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href} className={`flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] transition-colors ${on ? "bg-card text-green" : "text-muted hover:text-ink"}`}>
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={`transition-transform duration-200 ${on ? "scale-110" : ""}`} />{label}
          </Link>
        );
      })}
    </nav>
  );
}
