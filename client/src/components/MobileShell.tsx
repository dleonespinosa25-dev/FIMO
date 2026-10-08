import { NavLink, Outlet } from "react-router-dom";
import { Home, Store, Wallet, LayoutGrid, UserRound } from "lucide-react";

const tabs = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/marcas", label: "Marcas", icon: LayoutGrid },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/tiendas", label: "Tiendas", icon: Store },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];

export function MobileShell() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-club-cream shadow-card">
      <Outlet />
      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-2xl py-1 text-[10px] font-semibold ${
                    isActive ? "text-club-orange" : "text-slate-400"
                  } ${tab.to === "/wallet" ? "relative" : ""}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-2xl ${
                        tab.to === "/wallet"
                          ? "bg-gradient-to-br from-club-orange to-club-fuchsia text-white shadow-md"
                          : isActive
                            ? "bg-club-orange/10"
                            : ""
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    {tab.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
