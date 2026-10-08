import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApp } from "../lib/AppContext";
import { channelLabel, formatDate, statusLabel, typeLabel, usd } from "../lib/format";
import { DemoBanner } from "../components/DemoBanner";
import type { Movement, PaymentOrder } from "../types";

export function MovementPage() {
  const { id } = useParams();
  const { refresh, brandName } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    movement: Movement;
    order: PaymentOrder | null;
    receiptCode: string | null;
    user: { name: string; isMember: boolean };
  } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (id) api.movement(id).then((d) => setData(d as typeof data)).catch(() => undefined);
  }, [id]);

  async function refund() {
    if (!data) return;
    try {
      await api.refund(data.movement.id);
      await refresh();
      setMsg("Reembolso ficticio registrado. El movimiento original se conserva.");
      if (id) setData((await api.movement(id)) as typeof data);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!data) return <div className="p-6 text-sm text-slate-500">Cargando comprobante…</div>;
  const m = data.movement;

  return (
    <div className="safe-bottom px-4 pt-6">
      <button onClick={() => navigate(-1)} className="text-sm font-semibold text-mint-600">
        Volver
      </button>
      <h1 className="mt-2 text-2xl font-bold">Comprobante digital</h1>
      <DemoBanner text="Documento ficticio. Sin validez tributaria ni bancaria." />
      <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">{typeLabel(m.type)}</p>
        <p className="mt-1 font-mono text-lg font-bold">{data.receiptCode || m.id}</p>
        <p className="mt-4 text-3xl font-bold">{usd(m.signedAmountCents || m.amountCents)}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <Item k="Estado" v={statusLabel(m.status)} />
          <Item k="Fecha" v={formatDate(m.createdAt)} />
          <Item k="Usuario" v={data.user.name} />
          <Item k="Marca" v={m.brandId ? brandName(m.brandId) : "No aplica"} />
          <Item k="Canal" v={channelLabel(m.channel)} />
          <Item k="Tipo" v={typeLabel(m.type)} />
          <Item k="Referencia de orden" v={m.orderReference || "—"} />
          <Item k="ID de movimiento" v={m.id} />
        </dl>
        {data.order && (
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <p className="font-semibold">Detalle</p>
            <p>Subtotal {usd(data.order.subtotalCents)}</p>
            <p>Descuento {usd(data.order.discountCents)}</p>
            <p className="font-bold">Total / saldo utilizado {usd(data.order.totalCents)}</p>
          </div>
        )}
        <p className="mt-3 text-sm text-slate-500">{m.description}</p>
      </div>
      {m.type === "PAYMENT" && m.status === "approved" && (
        <button onClick={refund} className="mt-4 w-full rounded-2xl bg-white py-3 font-bold ring-1 ring-slate-200">
          Simular reembolso / reversión
        </button>
      )}
      {msg && <p className="mt-3 text-sm text-ink-800">{msg}</p>}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
