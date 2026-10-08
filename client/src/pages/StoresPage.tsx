import { Link } from "react-router-dom";
import { useApp } from "../lib/AppContext";
import { Monitor } from "lucide-react";

export function StoresPage() {
  const { catalog } = useApp();
  return (
    <div className="safe-bottom px-4 pt-6">
      <h1 className="text-2xl font-bold">Tiendas</h1>
      <p className="text-sm text-slate-500">Compre online con SmartWallet o simule una caja presencial.</p>
      <Link to="/pos" className="mt-4 flex items-center gap-3 rounded-3xl bg-ink-900 p-4 text-white">
        <Monitor />
        <div>
          <p className="font-bold">Abrir caja VENDIX simulada</p>
          <p className="text-xs text-white/70">Para pagos presenciales con QR</p>
        </div>
      </Link>
      <div className="mt-4 space-y-2">
        {catalog?.brands.map((b) => (
          <Link key={b.id} to={`/tienda/${b.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4">
            <span className="font-semibold">{b.name}</span>
            <span className="text-xs text-slate-400">E-commerce demo</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
