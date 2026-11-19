import BottomNav from "@/components/BottomNav";
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-xl pb-24">{children}<BottomNav /></div>;
}
