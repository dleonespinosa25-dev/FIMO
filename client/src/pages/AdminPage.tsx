import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usd } from "../lib/format";
import { DemoBanner } from "../components/DemoBanner";

interface Stats {
  disclaimer: string;
  totalWalletBalanceCents: number;
  rechargeCount: number;
  rechargeValueCents: number;
  physicalPayments: number;
  physicalVolumeCents: number;
  onlinePayments: number;
  onlineVolumeCents: number;
  approvedCount: number;
  rejectedCount: number;
  memberUsers: number;
  generalUsers: number;
  byBrand: { brandId: string; brandName: string; payments: number; volumeCents: number }[];
  wallets: { userId: string; name: string; isMember: boolean; balanceCents: number }[];
}

export function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  async function load() {
    setStats((await api.admin()) as Stats);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, []);

  async function reset() {
    if (!confirm("¿Restaurar el escenario de demostración?")) return;
    await api.reset();
    await load();
  }

  if (!stats) return <div className="p-8">Cargando panel…</div>;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Panel administrativo demo</h1>
            <p className="text-sm text-slate-500">Control ficticio · sin datos reales de clientes</p>
          </div>
          <Link to="/" className="rounded-full bg-white px-4 py-2 text-sm font-semibold">Ir a la app</Link>
        </div>
        <div className="mt-4">
          <DemoBanner text={stats.disclaimer} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Saldo total en billeteras" value={usd(stats.totalWalletBalanceCents)} />
          <Card title="Cantidad de recargas" value={String(stats.rechargeCount)} sub={usd(stats.rechargeValueCents)} />
          <Card title="Pagos físicos" value={String(stats.physicalPayments)} sub={usd(stats.physicalVolumeCents)} />
          <Card title="Pagos online" value={String(stats.onlinePayments)} sub={usd(stats.onlineVolumeCents)} />
          <Card title="Aprobadas" value={String(stats.approvedCount)} />
          <Card title="Rechazadas / canceladas" value={String(stats.rejectedCount)} />
          <Card title="Usuarios socios" value={String(stats.memberUsers)} />
          <Card title="Usuarios generales" value={String(stats.generalUsers)} />
        </div>
        <h2 className="mb-2 mt-8 font-bold">Volumen por marca</h2>
        <div className="overflow-hidden rounded-3xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Marca</th>
                <th className="p-3">Pagos</th>
                <th className="p-3">Volumen</th>
              </tr>
            </thead>
            <tbody>
              {stats.byBrand.map((b) => (
                <tr key={b.brandId} className="border-t border-slate-100">
                  <td className="p-3">{b.brandName}</td>
                  <td className="p-3">{b.payments}</td>
                  <td className="p-3">{usd(b.volumeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mb-2 mt-8 font-bold">Billeteras</h2>
        <div className="space-y-2">
          {stats.wallets.map((w) => (
            <div key={w.userId} className="flex justify-between rounded-2xl bg-white p-4">
              <span>
                {w.name} · {w.isMember ? "socio" : "general"}
              </span>
              <span className="font-bold">{usd(w.balanceCents)}</span>
            </div>
          ))}
        </div>
        <button onClick={reset} className="mt-8 rounded-2xl bg-rose-50 px-4 py-3 font-bold text-rose-700">
          Reiniciar datos demo
        </button>
      </div>
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub} recargado / volumen</p>}
    </div>
  );
}
