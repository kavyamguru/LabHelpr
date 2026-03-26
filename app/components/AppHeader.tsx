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
    <header className="sticky top-0 z-30 backdrop-blur bg-[rgba(248,250,252,0.9)] dark:bg-[rgba(15,23,42,0.92)] border-b border-slate-200/80 dark:border-slate-700/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-labhelpr.png"
            alt="LabHelpr"
            width={40}
            height={40}
            className="h-10 w-auto"
            priority
          />
          <span className="hidden sm:inline text-base font-semibold text-slate-900 dark:text-slate-100">
            LabHelpr
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-700 dark:text-slate-200">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-blue-500">
              {item.label}
            </Link>
          ))}
          <div className="flex items-center gap-3">
            <button className="hidden md:inline-flex items-center gap-2 rounded-full bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
              ⬇️ Export
            </button>
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
