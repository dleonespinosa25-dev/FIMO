import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DemoBanner } from "../components/DemoBanner";
import { api } from "../lib/api";
import { useApp } from "../lib/AppContext";
import { usd } from "../lib/format";
import type { PaymentOrder } from "../types";

function newKey() {
  return crypto.randomUUID();
}

export function PayPage() {
  const { reference } = useParams();
  const { wallet, refresh, catalog } = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState(reference ?? "");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const idem = useMemo(() => newKey(), [order?.id]);

  async function load(ref: string) {
    setError("");
    try {
      const data = (await api.getOrder(ref.trim())) as { order: PaymentOrder };
      setOrder(data.order);
    } catch (e) {
      setOrder(null);
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (reference) load(reference);
  }, [reference]);

  async function confirm() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const data = (await api.confirmPay({
        reference: order.reference,
        idempotencyKey: idem,
      })) as { ok: boolean; error?: string; message?: string; duplicate?: boolean };
      await refresh();
      if (!data.ok) setError(data.error || "No se pudo pagar.");
      else setDone(data.duplicate ? "Pago ya confirmado. No se descontó dos veces." : "Pago aprobado. Recibió un comprobante ficticio.");
    } catch (e) {
      const err = e as Error & { payload?: { error?: string } };
      setError(err.payload?.error || err.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!order) return;
    setBusy(true);
    try {
      await api.cancelPay({ reference: order.reference });
      setDone("Pago cancelado. El saldo no cambió.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const brand = catalog?.brands.find((b) => b.id === order?.brandId);

  return (
    <div className="safe-bottom px-4 pt-6">
      <button onClick={() => navigate("/wallet")} className="text-sm font-semibold text-mint-600">
        Volver
      </button>
      <h1 className="mt-2 text-2xl font-bold">Pagar con QR</h1>
      <DemoBanner text="El QR solo lleva un código de pago. Nunca incluye tarjetas ni datos confidenciales." />
      <p className="mt-3 text-sm text-slate-500">
        Si el QR se abre desde otro celular hacia localhost, escriba el código manualmente.
      </p>
      <p className="mt-1 text-sm font-semibold">Saldo: {wallet ? usd(wallet.balanceCents) : "—"}</p>

      {!order && !done && (
        <div className="mt-4">
          <label className="text-sm font-semibold">Código o referencia</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SWPAY-..."
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
          />
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <button onClick={() => load(code)} className="mt-4 w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">
            Buscar cobro
          </button>
        </div>
      )}

      {order && !done && (
        <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">{brand?.name} · {order.channel === "physical" ? "Presencial" : "Online"}</p>
          <p className="font-mono text-sm font-bold">{order.reference}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {order.items.map((i) => (
              <li key={i.productId} className="flex justify-between">
                <span>{i.quantity} × {i.name}</span>
                <span>{usd(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <Row k="Subtotal" v={usd(order.subtotalCents)} />
            <Row k="Descuento elegible" v={order.discountCents ? `-${usd(order.discountCents)}` : "$0.00"} />
            {order.discountLabel && <p className="text-[11px] text-amber-700">{order.discountLabel}</p>}
            <Row k="Total a pagar" v={usd(order.totalCents)} bold />
            <p className="text-[11px] text-slate-500">El descuento promocional no se mezcla con el saldo recargado.</p>
          </div>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {order.status !== "pending" && (
            <p className="mt-2 text-sm">Estado actual: {order.status}</p>
          )}
          {order.status === "pending" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={confirm} className="rounded-2xl bg-mint-500 py-3 font-bold">
                Confirmar
              </button>
              <button disabled={busy} onClick={cancel} className="rounded-2xl bg-slate-100 py-3 font-bold">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-3xl bg-white p-5">
          <p className="font-semibold">{done}</p>
          <button onClick={() => navigate("/wallet")} className="mt-4 w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">
            Ir al historial
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
