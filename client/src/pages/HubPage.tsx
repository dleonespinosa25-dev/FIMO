import { Link } from "react-router-dom";
import { Smartphone, Monitor, ShoppingBag, BarChart3, Brain } from "lucide-react";

export function HubPage() {
  return (
    <div className="min-h-screen bg-ink-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-mint-400">Hackatón · prototipo no oficial</p>
        <h1 className="mt-3 text-4xl font-bold">SMARTWALLET</h1>
        <p className="mt-2 text-lg text-slate-300">Tu dinero, todas tus marcas.</p>
        <p className="mt-4 max-w-xl text-sm text-slate-400">
          Demostración local de una billetera recargable dentro de SmartClub. Los fondos, pagos, marcas y
          beneficios son ficticios. No está conectada a bancos, VENDIX ni a Farmaenlace.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Tile to="/acceso" icon={Smartphone} title="App SmartClub (móvil)" desc="Onboarding naranja. Wallet es una pestaña; no exige socio." />
          <Tile to="/captacion" icon={Smartphone} title="QR SmartWallet (cliente)" desc="Escanear o tocar: datos + crear tarjeta. No es VENDIX." />
          <Tile to="/pos" icon={Monitor} title="Caja VENDIX (solo cajero)" desc="Login de cajero. Cobrar o recargar. No es el alta de tarjeta." />
          <Tile to="/tiendas" icon={ShoppingBag} title="Tienda online demo" desc="Catálogo, carrito y pago con saldo." />
          <Tile to="/admin" icon={BarChart3} title="Panel administrativo" desc="Volúmenes ficticios y control." />
          <Tile
            to="/intelligence/login"
            icon={Brain}
            title="Smart Intelligence"
            desc="Portal corporativo: CLV, retención y next best action. No aparece en la app del cliente."
          />
        </div>
      </div>
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Smartphone;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <Icon className="text-mint-400" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{desc}</p>
    </Link>
  );
}
