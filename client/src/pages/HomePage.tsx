import { Link } from "react-router-dom";
import { QrCode, Plus, Sparkles, ChevronRight } from "lucide-react";
import { DemoBanner } from "../components/DemoBanner";
import { useApp } from "../lib/AppContext";
import { usd } from "../lib/format";

export function HomePage() {
  const { wallet, catalog } = useApp();
  const user = wallet?.user;

  return (
    <div className="safe-bottom bg-club-cream px-4 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-club-orange">SmartClub · demo</p>
          <h1 className="text-2xl font-bold text-club-ink">Hola, {user?.name.split(" ")[0] ?? "..."}</h1>
          <p className="text-sm text-club-ink/60">
            {user?.isMember ? "Socio SmartClub (opcional)" : "Cliente con Wallet · no hace falta ser socio"}
          </p>
        </div>
        <Link to="/hub" className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-club-ink shadow-sm">
          Ver modos
        </Link>
      </div>
      <div className="mt-4">
        <DemoBanner />
      </div>

      <Link
        to="/wallet"
        className="mt-5 block overflow-hidden rounded-3xl bg-gradient-to-br from-club-orange via-club-deep to-club-fuchsia p-5 text-white shadow-card"
      >
        <p className="text-xs uppercase tracking-widest text-white/70">SmartWallet</p>
        <p className="mt-6 text-sm text-white/70">Saldo disponible</p>
        <p className="text-4xl font-bold tracking-tight">{wallet ? usd(wallet.balanceCents) : "—"}</p>
        <p className="mt-2 text-[11px] text-amber-200">Fondos ficticios · no es dinero real</p>
        <div className="mt-5 flex gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">
            <Plus size={14} /> Recargar
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">
            <QrCode size={14} /> Pagar con QR
          </span>
        </div>
      </Link>

      <Link
        to="/membresia"
        className="mt-4 flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="font-semibold text-club-ink">Membresía SmartClub</p>
            <p className="text-xs text-club-ink/60">Opcional. Wallet se usa desde su pestaña, con o sin socio.</p>
          </div>
        </div>
        <ChevronRight className="text-slate-400" size={18} />
      </Link>

      <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Marcas del ecosistema</h2>
      <div className="grid grid-cols-3 gap-3">
        {catalog?.brands.map((b) => (
          <Link
            key={b.id}
            to={`/tienda/${b.id}`}
            className="rounded-3xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-100"
          >
            <span
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold text-white"
              style={{ background: b.color }}
            >
              {b.shortName.slice(0, 2).toUpperCase()}
            </span>
            <p className="mt-2 text-[11px] font-semibold leading-tight">{b.shortName}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
