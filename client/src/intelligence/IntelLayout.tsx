import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getIntelToken, intelApi, setIntelToken } from "./intelApi";

const LINKS = [
  { to: "/intelligence", label: "Resumen ejecutivo", end: true },
  { to: "/intelligence/clientes", label: "Cliente 360" },
  { to: "/intelligence/retencion", label: "Segmentación y retención" },
  { to: "/intelligence/clv", label: "CLV y rentabilidad" },
  { to: "/intelligence/marcas", label: "Cruce de marcas" },
  { to: "/intelligence/nba", label: "Next Best Action" },
  { to: "/intelligence/campanas", label: "Campañas" },
  { to: "/intelligence/billetera", label: "SmartWallet" },
  { to: "/intelligence/flujo", label: "Data Flow Monitor" },
  { to: "/intelligence/lab", label: "Simulation Lab" },
];

export function IntelLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (!getIntelToken()) {
      navigate("/intelligence/login");
      return;
    }
    intelApi
      .me()
      .then((r) => setUser(r.user))
      .catch(() => {
        setIntelToken(null);
        navigate("/intelligence/login");
      });
  }, [navigate]);

  async function exit() {
    try {
      await intelApi.logout();
    } catch {
      /* ignore */
    }
    setIntelToken(null);
    navigate("/intelligence/login");
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next);
  }

  if (!user) return <div className="p-10 text-slate-500">Validando sesión corporativa…</div>;

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto bg-ink-950 px-4 py-6 text-white lg:block">
        <p className="text-[10px] uppercase tracking-[0.2em] text-mint-400">Farmaenlace · demo</p>
        <h1 className="mt-2 text-xl font-bold">Smart Intelligence</h1>
        <p className="mt-1 text-xs text-slate-400">Portal corporativo. No visible en la app del cliente.</p>
        <nav className="mt-8 space-y-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm ${isActive ? "bg-white/10 text-mint-400" : "text-slate-300 hover:bg-white/5"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={exit} className="mt-8 text-xs text-slate-400 hover:text-white">
          Cerrar sesión
        </button>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Sesión: {user.name}</p>
              <p className="text-xs text-slate-400">{user.email} · rol {user.role} · datos sintéticos</p>
            </div>
            <a href="/hub" className="text-sm font-semibold text-ink-800">
              Volver al hub
            </a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select className="rounded-lg border px-2 py-1 text-sm" value={params.get("brandId") ?? ""} onChange={(e) => setFilter("brandId", e.target.value)}>
              <option value="">Todas las marcas</option>
              <option value="farmacias-economicas">Farmacias Económicas</option>
              <option value="medicity">Medicity</option>
              <option value="wellderma">Wellderma</option>
              <option value="ambiente">Ambiente</option>
              <option value="mascotas">Mascotas</option>
              <option value="byd">BYD</option>
            </select>
            <select className="rounded-lg border px-2 py-1 text-sm" value={params.get("segment") ?? ""} onChange={(e) => setFilter("segment", e.target.value)}>
              <option value="">Todos los segmentos</option>
              <option value="nuevos">Nuevos</option>
              <option value="frecuentes">Frecuentes</option>
              <option value="alto_valor">Alto valor</option>
              <option value="potencial_crecimiento">Potencial</option>
              <option value="multimarcas">Multimarcas</option>
              <option value="ocasionales">Ocasionales</option>
              <option value="en_riesgo">En riesgo</option>
              <option value="inactivos">Inactivos</option>
              <option value="reactivados">Reactivados</option>
            </select>
            <select className="rounded-lg border px-2 py-1 text-sm" value={params.get("membership") ?? ""} onChange={(e) => setFilter("membership", e.target.value)}>
              <option value="">Socios y no socios</option>
              <option value="member">Solo socios</option>
              <option value="general">Sin membresía</option>
            </select>
            <select className="rounded-lg border px-2 py-1 text-sm" value={params.get("channel") ?? ""} onChange={(e) => setFilter("channel", e.target.value)}>
              <option value="">Todos los canales</option>
              <option value="physical">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
