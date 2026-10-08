import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext";
import { DemoBanner } from "../components/DemoBanner";

export function BrandsPage() {
  const { catalog } = useApp();
  return (
    <div className="safe-bottom px-4 pt-6">
      <h1 className="text-2xl font-bold">Marcas del ecosistema</h1>
      <p className="text-sm text-slate-500">Nombres usados como referencia de demostración.</p>
      <div className="mt-3">
        <DemoBanner />
      </div>
      <div className="mt-4 space-y-3">
        {catalog?.brands.map((b) => (
          <Link key={b.id} to={`/tienda/${b.id}`} className="block rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ background: b.color }}>
                {b.shortName.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-bold">{b.name}</p>
                <p className="text-xs text-slate-500">{b.category} · catálogo ficticio</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{b.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
