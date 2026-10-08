import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "../lib/AppContext";
import { api, getPosSession, setPosSession } from "../lib/api";
import { usd } from "../lib/format";
import type { BrandId, PaymentOrder, Product } from "../types";

interface Line {
  product: Product;
  quantity: number;
}

export function PosPage() {
  const { catalog } = useApp();
  const [tab, setTab] = useState<"cobro" | "recarga">("cobro");
  const [cashier, setCashier] = useState("");
  const [posPass, setPosPass] = useState("Caja2026!");
  const [posEmail, setPosEmail] = useState("cajero@farmaenlace.demo");
  const [posMsg, setPosMsg] = useState("");
  const [lookup, setLookup] = useState("SWC-ANA01");
  const [posAmount, setPosAmount] = useState("20");
  const [tender, setTender] = useState<"cash_sim" | "card_sim">("cash_sim");
  const [brandId, setBrandId] = useState<BrandId>("farmacias-economicas");
  const [lines, setLines] = useState<Line[]>([]);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(() => Boolean(getPosSession()));
  const [appOrigin, setAppOrigin] = useState(window.location.origin);

  const products = catalog?.products.filter((p) => p.brandId === brandId) ?? [];
  const subtotal = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);

  function add(product: Product) {
    setOrder(null);
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
  }

  async function create() {
    if (!lines.length) return;
    setBusy(true);
    try {
      const data = (await api.createOrder({
        brandId,
        channel: "physical",
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      })) as { order: PaymentOrder; qrPayload: string };
      setOrder(data.order);
      setQr(`${appOrigin}/wallet/pagar/${data.order.reference}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/demo/signup-url")
      .then((r) => r.json())
      .then((d: { lanOrigin?: string; httpsOrigin?: string | null }) => {
        setAppOrigin((d.httpsOrigin || d.lanOrigin || window.location.origin).replace(/\/$/, ""));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const t = setInterval(async () => {
      const data = (await api.getOrder(order.id)) as { order: PaymentOrder };
      setOrder(data.order);
    }, 1500);
    return () => clearInterval(t);
  }, [order?.id, order?.status]);

  async function loginCajero() {
    try {
      const r = (await api.posLogin(posEmail, posPass)) as { token: string; user: { name: string } };
      setPosSession(r.token);
      setCashier(r.user.name);
      setAuthed(true);
      setPosMsg("");
    } catch (e) {
      setPosMsg((e as Error).message);
    }
  }

  async function recargarPos() {
    setBusy(true);
    setPosMsg("");
    try {
      const cents = Math.round(Number(posAmount) * 100);
      const r = (await api.posRecharge({
        lookup,
        amountCents: cents,
        tender,
        idempotencyKey: crypto.randomUUID(),
      })) as { duplicate?: boolean; balanceCents: number; client: { name: string }; receipt: { receiptCode: string } };
      setPosMsg(
        r.duplicate
          ? "Ya estaba acreditada. No se duplicó."
          : `Acreditado a ${r.client.name}. Nuevo saldo ${usd(r.balanceCents)}. ${r.receipt.receiptCode}. Recarga POS ≠ venta.`,
      );
    } catch (e) {
      setPosMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const statusUi = useMemo(() => {
    if (!order) return { label: "SIN ORDEN", cls: "bg-slate-200 text-slate-700" };
    if (order.status === "pending") return { label: "PENDIENTE DE PAGO", cls: "bg-amber-100 text-amber-800" };
    if (order.status === "approved") return { label: "PAGO APROBADO", cls: "bg-emerald-500 text-white" };
    if (order.status === "rejected") return { label: "PAGO RECHAZADO", cls: "bg-rose-500 text-white" };
    return { label: "ORDEN CANCELADA", cls: "bg-slate-700 text-white" };
  }, [order]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-ink-950 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-rose-300">SOLO CAJERO · NO ES LA APP DEL CLIENTE</p>
            <h1 className="text-2xl font-bold">Caja VENDIX (demo)</h1>
          </div>
          {authed && (
          <div className="flex gap-2 text-sm">
            <button onClick={() => setTab("cobro")} className={`rounded-full px-3 py-1 ${tab === "cobro" ? "bg-white text-ink-900" : "bg-white/10"}`}>Cobrar</button>
            <button onClick={() => setTab("recarga")} className={`rounded-full px-3 py-1 ${tab === "recarga" ? "bg-white text-ink-900" : "bg-white/10"}`}>Recargar SmartWallet</button>
            <Link to="/hub" className="rounded-full bg-white/10 px-3 py-1">Salir</Link>
          </div>
          )}
        </div>
      </div>
      <div className="sticky top-0 z-10 bg-rose-600 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
        VENDIX SIMULATOR — SOLO CAJERO — NO CONECTADO A FARMAENLACE
      </div>
      {!authed && (
        <div className="mx-auto max-w-md px-4 py-10">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Entrar como cajero</h2>
            <p className="mt-2 text-sm text-slate-600">Esta pantalla no es para el cliente. El cliente saca su tarjeta con el QR de SmartWallet (/captacion), no aquí.</p>
            <input className="mt-4 w-full rounded-xl bg-slate-50 px-3 py-2" value={posEmail} onChange={(e) => setPosEmail(e.target.value)} />
            <input className="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2" type="password" value={posPass} onChange={(e) => setPosPass(e.target.value)} />
            <button onClick={loginCajero} className="mt-4 w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">Entrar a caja</button>
            {posMsg && <p className="mt-3 text-sm text-rose-600">{posMsg}</p>}
            <p className="mt-4 text-xs text-slate-500">Demo: cajero@farmaenlace.demo / Caja2026!</p>
          </section>
        </div>
      )}
      {authed && tab === "recarga" && (
        <div className="mx-auto max-w-lg px-4 py-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold">Recargar SmartWallet (caja)</h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm">Sesión: {cashier || "cajero"} · no accede a Smart Intelligence</p>
                <label className="text-xs font-bold">Código / QR de billetera (ej. SWC-ANA01 o SMARTWALLET:ID:user-general)</label>
                <input className="w-full rounded-xl bg-slate-50 px-3 py-2" value={lookup} onChange={(e) => setLookup(e.target.value)} />
                <label className="text-xs font-bold">Importe USD</label>
                <input className="w-full rounded-xl bg-slate-50 px-3 py-2" value={posAmount} onChange={(e) => setPosAmount(e.target.value)} />
                <select className="w-full rounded-xl bg-slate-50 px-3 py-2" value={tender} onChange={(e) => setTender(e.target.value as "cash_sim" | "card_sim")}>
                  <option value="cash_sim">Efectivo simulado</option>
                  <option value="card_sim">Tarjeta simulada</option>
                </select>
                <button disabled={busy} onClick={recargarPos} className="w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">
                  Confirmar recepción y acreditar una vez
                </button>
              </div>
            {posMsg && <p className="mt-3 text-sm">{posMsg}</p>}
          </section>
        </div>
      )}
      {authed && tab === "cobro" && (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-bold">Marca</label>
          <select
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value as BrandId);
              setLines([]);
              setOrder(null);
            }}
            className="mt-1 w-full rounded-2xl bg-slate-50 px-3 py-2"
          >
            {catalog?.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {products.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="rounded-2xl border border-slate-100 p-3 text-left hover:bg-slate-50">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">{usd(p.priceCents)}</p>
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {lines.map((l) => (
              <li key={l.product.id} className="flex justify-between">
                <span>
                  {l.quantity} × {l.product.name}
                </span>
                <span>{usd(l.product.priceCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-lg font-bold">Total: {usd(subtotal)}</p>
          <p className="text-xs text-slate-500">El descuento de socio, si aplica, se calcula al confirmar en la billetera.</p>
          <button disabled={busy || !lines.length} onClick={create} className="mt-4 w-full rounded-2xl bg-ink-900 py-3 font-bold text-white">
            Crear orden de cobro
          </button>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className={`rounded-2xl px-4 py-3 text-center text-lg font-black ${statusUi.cls}`}>{statusUi.label}</div>
          {order ? (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500">Referencia de pago (única)</p>
              <p className="font-mono text-xl font-bold">{order.reference}</p>
              <div className="mx-auto mt-4 w-fit rounded-3xl bg-white p-4 ring-1 ring-slate-200">
                <QRCodeSVG value={qr} size={220} />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Este QR abre SmartWallet en Pagar. No sirve para sacar tarjeta nueva (eso es /captacion).
              </p>
              <p className="mt-2 text-sm">
                App del cliente: <Link className="font-semibold text-emerald-700" to={`/wallet/pagar/${order.reference}`}>abrir este cobro en SmartWallet</Link>
              </p>
              {order.status === "approved" && (
                <p className="mt-4 rounded-2xl bg-emerald-50 p-3 font-semibold text-emerald-800">
                  Confirmación automática: el cliente pagó {usd(order.totalCents)}
                  {order.discountCents ? ` (descuento demo ${usd(order.discountCents)})` : ""}.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-6 text-center text-slate-500">Cree una orden para generar el QR de demostración.</p>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
