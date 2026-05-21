"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Map,
  Search,
  Bookmark,
  Bell,
  LogOut,
  FileText,
  Settings,
  Briefcase,
  CreditCard,
  DatabaseZap,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

const nav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Importaciones", href: "/importaciones", icon: DatabaseZap },
  { label: "Mapa", href: "/mapa", icon: Map },
  { label: "Mis concesiones", href: "/mis-concesiones", icon: Briefcase },
  { label: "Explorar", href: "/explorar", icon: Search },
  { label: "Oportunidades", href: "/oportunidades", icon: FileText },
  { label: "Watchlist", href: "/watchlist", icon: Bookmark },
  { label: "Alertas", href: "/alertas", icon: Bell }, // badge se llena dinámicamente
  { label: "Reportes", href: "/reportes", icon: FileText },
  { label: "Facturación", href: "/facturacion", icon: CreditCard },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout, hydrate, setAuth } = useAuthStore();
  const fetchingMe = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 1. Restore token from localStorage on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 2. If we have a token but no user (e.g. after page refresh), fetch /users/me
  useEffect(() => {
    if (token && !user && !fetchingMe.current) {
      fetchingMe.current = true;
      api
        .get("/users/me")
        .then((res) => setAuth(res.data, token))
        .catch(() => {
          // Token invalid — clear and redirect handled by api.ts interceptor
        })
        .finally(() => {
          fetchingMe.current = false;
        });
    }
  }, [token, user, setAuth]);

  // 3. Redirect to login only after hydration completed (token stays null = no session)
  useEffect(() => {
    if (token !== null) return; // hydrated and has token — stay
    const stored = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!stored) router.push("/login");
  }, [token, router]);

  // Polled unread-alerts badge. Refetches every 60s and on focus.
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn: async () => (await api.get("/alerts/unread-count")).data,
    enabled: Boolean(token),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const unreadCount = unread?.count ?? 0;

  return (
    <div className="min-h-screen bg-[#eff4f3] p-0">
      <div className="flex min-h-screen overflow-hidden rounded-[12px] border border-[#dce8e6] bg-white shadow-[0_24px_72px_rgba(15,23,42,0.08)]">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[235px] flex-col border-r border-[#dce8e6] bg-white transition-transform duration-300 lg:relative lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(circle_at_bottom_left,_rgba(30,139,129,0.08),_transparent_48%)]" />
          <div className="absolute inset-x-0 bottom-0 h-72 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,rgba(20,90,85,0.08)_1px,transparent_0)] [background-size:18px_18px]" />

          <div className="relative px-7 pb-6 pt-8">
            <div className="mb-3 h-8 w-14 text-primary-700">
              <svg viewBox="0 0 60 36" className="h-full w-full" fill="none">
                <path
                  d="M8 24C15 15 21 8 29 4C37 8 43 15 52 24"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 24C21 20 25 18 29 16C35 18 40 20 46 24"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
              </svg>
            </div>
            <h2 className="text-[2.1rem] font-semibold tracking-tight text-primary-900">
              GeoConces
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
              Plataforma geominera
            </p>
          </div>

          <nav className="relative flex-1 space-y-1 overflow-auto px-3 py-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              // Inject the live unread-count into the "Alertas" entry.
              const liveBadge =
                item.href === "/alertas" && unreadCount > 0
                  ? unreadCount
                  : item.badge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-[8px] px-4 py-3.5 text-[15px] font-medium transition ${
                    active
                      ? "bg-[linear-gradient(135deg,#0f6f69_0%,#127a73_100%)] text-white shadow-[0_12px_28px_rgba(18,122,115,0.18)]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {liveBadge ? (
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                        active ? "bg-white/20 text-white" : "bg-primary-700 text-white"
                      }`}
                    >
                      {liveBadge > 99 ? "99+" : liveBadge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="relative mt-auto px-4 pb-5">
            <div className="flex items-center gap-3 rounded-[8px] border border-[#dce8e6] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white">
                  {(user?.full_name || user?.email || "G").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user?.full_name || "Adrian"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.email || "Sin sesión"}
                  </p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                  aria-label="Cerrar sesion"
                >
                  <LogOut size={16} />
                </button>
                <ChevronDown size={16} className="text-slate-400" />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden bg-[#f9fafa]">
          <div className="h-full px-4 py-2">{children}</div>
        </main>
      </div>
    </div>
  );
}
