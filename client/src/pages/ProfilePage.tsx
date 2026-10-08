import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/AppContext";
import { api, setSession } from "../lib/api";
import { DemoBanner } from "../components/DemoBanner";
import { VirtualCard } from "../club/ClubUi";
import { usd } from "../lib/format";

export function ProfilePage() {
  const { catalog, userId, setUser, refresh, wallet } = useApp();
  const navigate = useNavigate();
  const u = wallet?.user;

  async function reset() {
    if (!confirm("Esto restaura usuarios, saldos y catálogo de demostración. ¿Continuar?")) return;
    setSession(null);
    await api.reset();
    await refresh();
    navigate("/");
  }

  return (
    <div className="safe-bottom bg-club-cream px-4 pt-6">
      <h1 className="text-2xl font-bold text-club-ink">Perfil</h1>
      <DemoBanner />
      {u && (
        <div className="mt-4">
          <VirtualCard name={u.name} code={u.customerCode ?? "—"} pan={u.virtualCard ?? "SW-DEMO"} balance={usd(wallet?.balanceCents ?? 0)} />
        </div>
      )}
      <p className="mt-3 text-xs text-club-ink/60">
        {u?.isMember ? "Socio (beneficio aparte)" : "No socio"} · SmartWallet disponible igual. QR de caja: SMARTWALLET:ID:{userId}
      </p>
      <h2 className="mb-2 mt-5 text-sm font-bold">Cuentas de prueba (clientes)</h2>
      <div className="space-y-2">
        {catalog?.users.map((usr) => (
          <button
            key={usr.id}
            onClick={() => {
              setSession(null);
              setUser(usr.id);
            }}
            className={`w-full rounded-2xl p-4 text-left ${userId === usr.id ? "bg-club-orange text-white" : "bg-white"}`}
          >
            <p className="font-bold">{usr.name}</p>
            <p className="text-xs opacity-80">{usr.isMember ? "Socio opcional" : "Wallet sin membresía"} · {usr.customerCode}</p>
          </button>
        ))}
      </div>
      <Link to="/registro" className="mt-4 block rounded-2xl bg-white p-4 font-semibold text-club-orange">
        Activar otra SmartWallet (registro QR)
      </Link>
      <Link to="/membresia" className="mt-2 block rounded-2xl bg-white p-4 font-semibold text-club-fuchsia">
        Membresía SmartClub (opcional)
      </Link>
      <Link to="/acceso" className="mt-2 block rounded-2xl bg-white p-4 font-semibold">
        Pantalla de bienvenida
      </Link>
      <button onClick={reset} className="mt-6 w-full rounded-2xl bg-rose-50 py-3 font-bold text-rose-700">
        Reiniciar datos demo
      </button>
    </div>
  );
}
