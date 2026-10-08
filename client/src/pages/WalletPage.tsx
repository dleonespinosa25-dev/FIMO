import { Link } from "react-router-dom";
import { Plus, QrCode } from "lucide-react";
import { DemoBanner } from "../components/DemoBanner";
import { useApp } from "../lib/AppContext";
import { channelLabel, formatDate, statusLabel, typeLabel, usd } from "../lib/format";
import { VirtualCard } from "../club/ClubUi";

export function WalletPage() {
  const { wallet, brandName } = useApp();
  const u = wallet?.user;

  return (
    <div className="safe-bottom bg-club-cream px-4 pt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-club-orange">Pestaña SmartWallet</p>
      <h1 className="text-2xl font-bold text-club-ink">Tu dinero, todas tus marcas</h1>
      <p className="text-sm text-club-ink/60">No necesitas ser socio para recargar ni pagar.</p>
      <div className="mt-3">
        <DemoBanner text="Fondos ficticios. Esta pestaña es parte de SmartClub, no un banco aparte." />
      </div>
      <div className="mt-4">
        <VirtualCard
          name={u?.name ?? "—"}
          code={u?.customerCode ?? "—"}
          pan={u?.virtualCard ?? "SW-DEMO-····"}
          balance={wallet ? usd(wallet.balanceCents) : "—"}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/wallet/recargar" className="flex items-center justify-center gap-2 rounded-full bg-club-orange py-3 font-bold text-white">
          <Plus size={18} /> Recargar
        </Link>
        <Link to="/wallet/pagar" className="flex items-center justify-center gap-2 rounded-full border-2 border-club-fuchsia py-3 font-bold text-club-fuchsia">
          <QrCode size={18} /> Pagar con QR
        </Link>
      </div>
      <h2 className="mb-2 mt-6 text-sm font-bold text-club-ink">Historial</h2>
      <div className="space-y-2">
        {wallet?.movements.length === 0 && (
          <p className="rounded-2xl bg-white p-4 text-sm text-club-ink/60">Saldo $0. Recargue desde la app o en caja.</p>
        )}
        {wallet?.movements.map((m) => (
          <Link key={m.id} to={`/wallet/movimiento/${m.id}`} className="block rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{typeLabel(m.type)}</p>
                <p className="text-xs text-slate-500">{m.description}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {formatDate(m.createdAt)} · {channelLabel(m.channel)}
                  {m.brandId ? ` · ${brandName(m.brandId)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${m.signedAmountCents > 0 ? "text-club-orange" : "text-club-ink"}`}>
                  {m.signedAmountCents === 0 ? usd(m.amountCents) : usd(m.signedAmountCents)}
                </p>
                <p className="text-[11px] text-slate-500">{statusLabel(m.status)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
