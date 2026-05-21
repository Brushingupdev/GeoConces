"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Map, Search, Bookmark, Bell, LogOut,
  Settings, Briefcase, CreditCard, DatabaseZap, TrendingUp,
  BarChart3, Menu, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────────────────────── */
type NavItem  = { label: string; href: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard },
      { label: "Mapa",            href: "/mapa",            icon: Map             },
      { label: "Explorar",        href: "/explorar",        icon: Search          },
      { label: "Mis concesiones", href: "/mis-concesiones", icon: Briefcase       },
    ],
  },
  {
    title: "Herramientas",
    items: [
      { label: "Importaciones", href: "/importaciones", icon: DatabaseZap },
      { label: "Oportunidades", href: "/oportunidades", icon: TrendingUp  },
      { label: "Watchlist",     href: "/watchlist",     icon: Bookmark    },
      { label: "Alertas",       href: "/alertas",       icon: Bell        },
      { label: "Reportes",      href: "/reportes",      icon: BarChart3   },
    ],
  },
  {
    title: "Cuenta",
    items: [
      { label: "Facturación",   href: "/facturacion",   icon: CreditCard },
      { label: "Configuración", href: "/configuracion", icon: Settings   },
    ],
  },
];

/* ── Logo mark ──────────────────────────────────────────────────────── */
function GeoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 44" fill="none" className={className} aria-hidden>
      <path d="M20 2 L37 11.5 L37 32.5 L20 42 L3 32.5 L3 11.5 Z"
        stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <line x1="9"  y1="17" x2="31" y2="17" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
      <line x1="7"  y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="1.8" opacity="0.65" strokeLinecap="round"/>
      <line x1="9"  y1="27" x2="31" y2="27" stroke="currentColor" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
      <circle cx="20" cy="33" r="2.8" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

/* ── Layout ─────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, token, logout, hydrate, setAuth } = useAuthStore();
  const fetchingMe   = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (token && !user && !fetchingMe.current) {
      fetchingMe.current = true;
      api.get("/users/me")
        .then((res) => setAuth(res.data, token))
        .catch(() => {})
        .finally(() => { fetchingMe.current = false; });
    }
  }, [token, user, setAuth]);

  useEffect(() => {
    if (token !== null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!stored) router.push("/login");
  }, [token, router]);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn:  async () => (await api.get("/alerts/unread-count")).data,
    enabled:  Boolean(token),
    refetchInterval:      60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const initials = (user?.full_name || user?.email || "G")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#eaeeec]">
      <div className="flex min-h-screen">

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)} />
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col
          border-r border-slate-200/80 bg-white
          transition-transform duration-300
          lg:relative lg:translate-x-0
          ${mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        `}>
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
            <GeoMark size={26} className="shrink-0 text-primary-700" />
            <div>
              <p className="text-[15px] font-bold leading-none tracking-tight text-primary-900">GeoConces</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-400">Geominería</p>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto py-3 space-y-1">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && <div className="mx-3 my-2 border-t border-slate-100" />}
                <p className="px-5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.title}
                </p>
                <div className="space-y-0.5 px-2">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    const badge  = item.href === "/alertas" && unreadCount > 0 ? unreadCount : undefined;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all
                          ${active
                            ? "bg-primary-700 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }
                        `}
                      >
                        <item.icon size={16} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge ? (
                          <span className={`
                            inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5
                            text-[10px] font-bold
                            ${active ? "bg-white/25 text-white" : "bg-primary-100 text-primary-700"}
                          `}>
                            {badge > 99 ? "99+" : badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User card */}
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                  {user?.full_name || "Usuario"}
                </p>
                <p className="truncate text-[11px] leading-tight text-slate-500">
                  {user?.email || ""}
                </p>
              </div>
              <button
                onClick={logout}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 bg-[#f4f7f5]">
          <div className="h-full min-h-screen px-5 py-4 lg:px-6 lg:py-5">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
