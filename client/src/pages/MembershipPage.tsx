import { useApp } from "../lib/AppContext";
import { DemoBanner } from "../components/DemoBanner";
import { usd } from "../lib/format";

export function MembershipPage() {
  const { wallet, catalog, setUser } = useApp();
  const percent = catalog?.membership.demoDiscountPercent ?? 10;
  const sample = 2500;
  const discount = Math.round((sample * percent) / 100);

  return (
    <div className="safe-bottom px-4 pt-6">
      <h1 className="text-2xl font-bold">Membresía SmartClub</h1>
      <p className="text-sm text-slate-500">Sección independiente. No condiciona el uso de SmartWallet.</p>
      <div className="mt-3">
        <DemoBanner text="Beneficios de fidelización ficticios. No atribuya estas reglas a Farmaenlace." />
      </div>
      <div className="mt-4 rounded-3xl bg-white p-4">
        <p className="text-sm text-slate-500">Perfil actual</p>
        <p className="text-xl font-bold">{wallet?.user.name}</p>
        <p className="mt-1 font-semibold">{wallet?.user.isMember ? "CON membresía (socio demo)" : "SIN membresía (usuario general)"}</p>
        <p className="mt-2 text-sm text-slate-600">Ambos perfiles pueden recargar, consultar saldo y pagar.</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {catalog?.users.map((u) => (
          <button key={u.id} onClick={() => setUser(u.id)} className="rounded-2xl bg-ink-900 py-3 text-sm font-bold text-white">
            Usar {u.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-3xl bg-amber-50 p-4">
        <p className="font-bold">Ejemplo configurable de descuento socio</p>
        <p className="mt-1 text-sm">{percent}% sobre el subtotal, solo si el pagador es socio.</p>
        <div className="mt-3 space-y-1 text-sm">
          <p>Subtotal de ejemplo: {usd(sample)}</p>
          <p>Descuento elegible: {wallet?.user.isMember ? usd(discount) : "$0.00"}</p>
          <p>Total final: {usd(wallet?.user.isMember ? sample - discount : sample)}</p>
          <p>Saldo utilizado: el total final, debitado de SmartWallet</p>
        </div>
        <p className="mt-3 text-xs text-slate-600">{catalog?.membership.note}</p>
      </div>
    </div>
  );
}
