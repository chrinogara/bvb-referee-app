"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/cn";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden",
          open ? "block" : "hidden",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-w)] flex-col bg-[#15171c] text-zinc-300 transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 font-serif text-[11px] italic text-white">
            Srl
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-[0.22em] text-white">
              CHRISA
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {t.brand.tagline}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section, i) => (
            <div key={i} className={cn(i > 0 && "mt-6")}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                {section.title(t)}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent text-white"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active
                              ? "text-white"
                              : "text-zinc-500 group-hover:text-zinc-300",
                          )}
                        />
                        {item.label(t)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
              SC
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium text-white">
                Srl Chrisa
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                6150 Anderlues
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
