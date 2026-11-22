"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg2/95 backdrop-blur pb-safe md:hidden">
      <ul className="mx-auto flex max-w-xl">
        {NAV.map(({ href, label, Icon }) => {
          const on = isActive(path, href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${on ? "text-green" : "text-muted"}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={`transition-transform duration-200 ${on ? "scale-110" : ""}`} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
