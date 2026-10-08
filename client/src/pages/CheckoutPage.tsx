import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { clearCart, loadCart } from "../lib/cart";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";
import { usd } from "../lib/format";
import { DemoBanner } from "../components/DemoBanner";

export function CheckoutPage() {
  const { brandId } = useParams();
  const { catalog, wallet, refresh } = useApp();
  const navigate = useNavigate();
  const brand = catalog?.brands.find((b) => b.id === brandId);
  const products = catalog?.products.filter((p) => p.brandId === brandId) ?? [];
  const [items] = useState(() => loadCart(brandId));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const lines = items
    .map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p) return null;
      return { ...l, product: p, line: p.priceCents * l.quantity };
    })
    .filter(Boolean) as { productId: string; quantity: number; product: (typeof products)[0]; line: number }[];

  const subtotal = lines.reduce((s, l) => s + l.line, 0);
  const member = Boolean(wallet?.user.isMember);
  const percent = catalog?.membership.demoDiscountPercent ?? 0;
  const discount = member ? Math.round((subtotal * percent) / 100) : 0;
  const total = subtotal - discount;
  const key = useMemo(() => crypto.randomUUID(), []);

  async function pay() {
    setBusy(true);
    setMsg("");
    try {
      const data = (await api.checkout({
        brandId,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        idempotencyKey: key,
      })) as { ok: boolean; error?: string; receipt?: { receiptCode: string }; movement?: { id: string } };
      await refresh();
      if (!data.ok) {
        setMsg(data.error || "No se pudo completar el pago.");
        return;
      }
      clearCart(brandId);
      setReceipt(data.movement?.id || data.receipt?.receiptCode || "ok");
    } catch (e) {
      const err = e as Error & { payload?: { error?: string } };
      setMsg(err.payload?.error || err.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!brand) return <div className="p-6">Marca no encontrada.</div>;

  return (
    <div className="min-h-screen bg-[#F3F6FA] px-4 py-6">
      <Link to={`/tienda/${brandId}`} className="text-sm font-semibold text-mint-600">
        Volver al catálogo
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Checkout · {brand.name}</h1>
      <DemoBanner text="Pago online simulado. Sin QR y sin pasarela bancaria." />
      {lines.length === 0 && !receipt && <p className="mt-4 text-sm">El carrito está vacío.</p>}
      <ul className="mt-4 space-y-2">
        {lines.map((l) => (
          <li key={l.productId} className="flex justify-between rounded-2xl bg-white p-3 text-sm">
            <span>
              {l.quantity} × {l.product.name}
            </span>
            <span className="font-semibold">{usd(l.line)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-3xl bg-white p-4 text-sm">
        <Row k="Subtotal" v={usd(subtotal)} />
        <Row k="Descuento elegible" v={discount ? `-${usd(discount)}` : "$0.00"} />
        {member && <p className="text-[11px] text-amber-700">Descuento socio demo {percent}% (ficticio)</p>}
        {!member && <p className="text-[11px] text-slate-500">Usuario general: no aplica descuento de membresía.</p>}
        <Row k="Total final" v={usd(total)} bold />
        <Row k="Saldo SmartWallet" v={wallet ? usd(wallet.balanceCents) : "—"} />
        <Row k="Saldo a utilizar" v={usd(total)} />
        <p className="mt-2 text-[11px] text-slate-500">
          El saldo recargado se distingue del beneficio promocional. No se mezcla cashback con dinero de la billetera.
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold">Medio de pago: SmartWallet</p>
      {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      {receipt ? (
        <button onClick={() => navigate(`/wallet/movimiento/${receipt}`)} className="mt-4 w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">
          Ver comprobante
        </button>
      ) : (
        <button
          disabled={busy || lines.length === 0}
          onClick={pay}
          className="mt-4 w-full rounded-2xl bg-mint-500 py-3 font-bold disabled:opacity-40"
        >
          Confirmar compra
        </button>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
