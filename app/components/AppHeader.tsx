import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/calculator", label: "Calculators" },
  { href: "/statistical-analysis", label: "Statistical Analysis" },
  { href: "/projects", label: "Notebook" },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(10,18,32,0.9)] border-b border-slate-800/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-labhelpr.png"
            alt="LabHelpr"
            width={36}
            height={36}
            className="h-9 w-auto"
            priority
          />
          <span className="hidden sm:inline text-base font-semibold text-slate-100">
            LabHelpr
          </span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-2 text-sm font-medium text-slate-200">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 transition hover:bg-slate-800/80">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-slate-200">
          <button className="hidden md:inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-slate-500">
            ⬇️ Export
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
