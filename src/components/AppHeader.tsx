"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChartIcon,
  DatabaseIcon,
  FlowIcon,
  MoonIcon,
  SearchIcon,
  SunIcon
} from "./Icons";
import { MediTemuLogo } from "./OrganIllustrations";

const NAV_ITEMS = [
  { href: "/", label: "Cari Gejala", icon: SearchIcon },
  { href: "/alur", label: "Cara Kerja", icon: FlowIcon },
  { href: "/evaluasi", label: "Akurasi", icon: BarChartIcon },
  { href: "/korpus", label: "Daftar Penyakit", icon: DatabaseIcon }
];

export default function AppHeader() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    try {
      localStorage.setItem("meditemu-theme", nextTheme);
    } catch { }
  }

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-2.5 sm:px-5 md:pt-3 lg:px-8">
      <div className="flex w-full flex-col gap-2.5 rounded-3xl border border-border bg-surface-glass px-4 py-2.5 shadow-[var(--shadow-soft-md)] backdrop-blur-md min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between min-[960px]:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-inherit no-underline">
            <MediTemuLogo size={42} />
            <span>
              <span className="block font-heading text-xl font-extrabold leading-[1.15] tracking-[-0.02em] text-ink-strong">
                MediTemu
              </span>
              <span className="block text-xs font-medium text-muted-foreground">
                Pencarian Informasi Kesehatan
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ubah ke Light Mode" : "Ubah ke Dark Mode"}
              aria-pressed={mounted ? theme === "dark" : false}
              title={theme === "dark" ? "Aktifkan Light Mode" : "Aktifkan Dark Mode"}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink-strong shadow-[var(--shadow-soft-sm)] transition-colors duration-150 hover:border-primary hover:bg-primary-soft hover:text-primary motion-reduce:transition-none"
            >
              {mounted && theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
              <span className="hidden sm:inline">
                {mounted && theme === "dark" ? "Light" : "Dark"}
              </span>
            </button>
          </div>
        </div>

        <nav
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5"
          aria-label="Navigasi Utama MediTemu"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-transparent px-3.5 py-2 text-[13.5px] font-bold no-underline transition-colors duration-150 motion-reduce:transition-none ${isActive
                    ? "bg-primary text-on-primary shadow-[0_4px_12px_rgba(11,92,171,0.25)] hover:bg-primary-hover hover:text-on-primary"
                    : "bg-transparent text-foreground hover:bg-primary-soft hover:text-primary"
                  }`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
