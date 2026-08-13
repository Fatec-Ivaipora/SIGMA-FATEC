import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Settings, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export function Sidebar({
  navItems,
  activeHref,
  userName,
  userRoleLabel,
  userInitials,
}: {
  navItems: NavItem[];
  activeHref: string;
  userName: string;
  userRoleLabel: string;
  userInitials: string;
}) {
  return (
    <aside className="hidden w-64 flex-none flex-col justify-between bg-fatec-navy-900 px-5 py-7 md:flex">
      <div className="flex flex-col gap-10">
        <Logo className="h-12 w-auto pl-1" />

        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-fatec-navy-50/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-1 border-t border-white/10 pt-5">
        <Link
          href="#"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-fatec-navy-50/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Settings className="h-4.5 w-4.5" strokeWidth={1.75} />
          Configurações
        </Link>
        <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fatec-orange-500 text-xs font-semibold text-white">
            {userInitials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {userName}
            </p>
            <p className="truncate text-xs text-fatec-navy-50/60">
              {userRoleLabel}
            </p>
          </div>
          <Link
            href="/"
            aria-label="Sair"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fatec-navy-50/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
