import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useApp } from "../lib/AppContext";
import { usd } from "../lib/format";
import { DemoBanner } from "../components/DemoBanner";
import { loadCart, saveCart, type CartLine } from "../lib/cart";

export function ShopPage() {
  const { brandId } = useParams();
  const { catalog } = useApp();
  const brand = catalog?.brands.find((b) => b.id === brandId);
  const products = catalog?.products.filter((p) => p.brandId === brandId) ?? [];
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(brandId));

  const total = useMemo(
    () =>
      cart.reduce((s, line) => {
        const p = products.find((x) => x.id === line.productId);
        return s + (p ? p.priceCents * line.quantity : 0);
      }, 0),
    [cart, products],
  );

  function add(productId: string) {
    const next = [...cart];
    const found = next.find((l) => l.productId === productId);
    if (found) found.quantity += 1;
    else next.push({ productId, quantity: 1 });
    setCart(next);
    saveCart(brandId, next);
  }

  if (!brand) return <div className="p-6">Marca no encontrada.</div>;

  return (
    <div className="safe-bottom px-4 pt-6">
      <p className="text-xs font-semibold uppercase text-slate-400">E-commerce demo</p>
      <h1 className="text-2xl font-bold">{brand.name}</h1>
      <DemoBanner text="Catálogo ficticio. Precios de demostración. BYD solo incluye accesorios de bajo valor." />
      <div className="mt-4 space-y-3">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4">
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-slate-500">{p.description}</p>
              <p className="mt-1 font-bold">{usd(p.priceCents)}</p>
            </div>
            <button onClick={() => add(p.id)} className="rounded-2xl bg-ink-900 px-3 py-2 text-sm font-bold text-white">
              Añadir
            </button>
          </div>
        ))}
      </div>
      <div className="fixed bottom-20 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-4">
        <Link
          to={`/tienda/${brandId}/pagar`}
          className="flex items-center justify-between rounded-2xl bg-mint-500 px-4 py-3 font-bold text-ink-950 shadow-card"
        >
          <span>Revisar carrito</span>
          <span>{usd(total)}</span>
        </Link>
      </div>
    </div>
  );
}
