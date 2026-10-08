import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usd } from "../lib/format";
import { intelApi, setIntelToken, type CampaignRow, type CustomerRow, type FlowEvt, type NbaRow } from "./intelApi";
import { BRAND_LABEL, CHURN_LABEL, SEGMENT_LABEL, pct } from "./labels";
import { Bar, Kpi, Note, Panel } from "./ui";

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fn()
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, reload: () => fn().then(setData) };
}

export function IntelligenceLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("inteligencia@farmaenlace.demo");
  const [password, setPassword] = useState("Intel2026!");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await intelApi.login(email, password);
      setIntelToken(r.token);
      navigate("/intelligence");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-[0.2em] text-mint-400">Portal privado</p>
        <h1 className="mt-2 text-3xl font-bold">Smart Intelligence</h1>
        <p className="mt-2 text-sm text-slate-300">
          Solo personal corporativo de demostración. Esta pantalla no forma parte de la app SmartClub del cliente.
        </p>
        <label className="mt-6 block text-xs text-slate-400">Correo</label>
        <input className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-xs text-slate-400">Contraseña</label>
        <input className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button className="mt-6 w-full rounded-2xl bg-mint-500 py-3 font-bold text-ink-950">Entrar</button>
        <p className="mt-4 text-xs text-slate-500">
          Usuarios demo: inteligencia@ / finanzas@ / direccion@ farmaenlace.demo · clave Intel2026!
        </p>
      </form>
    </div>
  );
}

export function OverviewPage() {
  const [params] = useSearchParams();
  const { data, error } = useLoad(() => intelApi.overview(`?${params}`), [params.toString()]);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando resumen…</p>;
  const rfm = data.rfm as { bySegment: Record<string, number> };
  const maxSeg = Math.max(...Object.values(rfm.bySegment), 1);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resumen ejecutivo</h1>
        <p className="text-sm text-slate-500">Cómo está la cartera ficticia: recurrencia, valor y riesgo. Corte {String(data.asOf).slice(0, 10)}.</p>
      </div>
      <Note>{String(data.disclaimer)}</Note>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Clientes sintéticos" value={String(data.customers)} hint={`${data.customersWithPurchases} con al menos una compra`} />
        <Kpi title="Activos 90 días (proxy)" value={String(data.active90)} hint={`Retención proxy ${pct(Number(data.retentionProxy))}`} />
        <Kpi title="En riesgo / inactivos" value={String(data.atRisk)} />
        <Kpi title="Ticket promedio (AOV)" value={usd(Number(data.avgAovCents))} hint="Promedio de compras, no de recargas" />
        <Kpi title="Ingreso promedio / cliente" value={usd(Number(data.avgRevenuePerCustomerCents))} />
        <Kpi title="Contribución promedio" value={usd(Number(data.avgContributionCents))} hint="Después de costo variable e incentivos" />
        <Kpi title="CLV proyectado (suma)" value={usd(Number(data.projectedClvSumCents))} hint={`Solo ${data.customersWithClvProjection} clientes con historial suficiente`} />
        <Kpi title="Contribución histórica" value={usd(Number(data.historicNetContributionCents))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Segmentos comerciales">
          {Object.entries(rfm.bySegment).map(([k, v]) => (
            <Bar key={k} label={SEGMENT_LABEL[k] ?? k} value={v} max={maxSeg} />
          ))}
        </Panel>
        <Panel title="Socios vs no socios">
          <p className="text-sm">Contribución media socios: <b>{usd(Number(data.memberAvgContributionCents))}</b></p>
          <p className="text-sm mt-1">Contribución media sin membresía: <b>{usd(Number(data.nonMemberAvgContributionCents))}</b></p>
          <p className="mt-3 text-xs text-slate-500">
            Tener SmartWallet no exige ser socio. La membresía es un beneficio aparte.
          </p>
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-500">
            {(data.notes as string[]).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const { data, error } = useLoad(
    () => intelApi.customers(`?${params}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    [params.toString(), q],
  );
  if (error) return <Note>{error}</Note>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Cliente 360</h1>
      <p className="text-sm text-slate-500">Busque un cliente ficticio para ver historial, valor y la siguiente acción sugerida.</p>
      <input
        placeholder="Buscar por nombre o correo"
        className="w-full max-w-md rounded-2xl border px-4 py-2"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!data ? (
        <p>Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Segmento</th>
                <th className="p-3">Compras</th>
                <th className="p-3">Contribución</th>
                <th className="p-3">CLV proy.</th>
                <th className="p-3">Abandono</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c: CustomerRow) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <Link className="font-semibold text-ink-800" to={`/intelligence/clientes/${c.id}`}>
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">{c.isMember ? "Socio" : "General"} · {c.brands} marcas</p>
                  </td>
                  <td className="p-3">{SEGMENT_LABEL[c.segment] ?? c.segment}</td>
                  <td className="p-3">{c.purchaseCount}</td>
                  <td className="p-3">{usd(c.netContributionCents)}</td>
                  <td className="p-3">{c.projectedClvCents == null ? "No proyectable" : usd(c.projectedClvCents)}</td>
                  <td className="p-3">{CHURN_LABEL[c.churnLabel] ?? c.churnLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { data, error, reload } = useLoad(() => intelApi.customer(id), [id]);
  const [busy, setBusy] = useState(false);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando ficha…</p>;
  const snap = data.snapshot as Record<string, unknown>;
  const customer = snap.customer as Record<string, unknown>;
  const nba = data.nba as NbaRow;
  const history = data.history as { id: string; brandId: string; revenueCents: number; soldAt: string; source: string; refunded: boolean }[];
  const proj = snap.projectedClv as Record<string, unknown>;

  async function decide(status: "approved" | "rejected") {
    setBusy(true);
    await intelApi.nbaDecision(id, status);
    await reload();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Link to="/intelligence/clientes" className="text-sm font-semibold">← Lista</Link>
      <h1 className="text-3xl font-bold">{String(customer.name)}</h1>
      <p className="text-sm text-slate-500">
        {customer.isMember ? "Socio SmartClub (demo)" : "Sin membresía"} · consentimiento marketing: {customer.consentMarketing ? "sí" : "no"} · ciudad {String(customer.city)}
      </p>
      <Note>{String(data.walletNote)}</Note>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Ventas históricas" value={usd(Number((snap.historicValue as { salesCents: number }).salesCents))} />
        <Kpi title="Compras" value={String(snap.purchaseCount)} hint={`AOV ${usd(Number(snap.aovCents))}`} />
        <Kpi title="Contribución neta" value={usd(Number(snap.netContributionCents))} />
        <Kpi title="CLV proyectado" value={proj.available ? usd(Number(proj.presentValueCents)) : "No proyectable"} hint={`Confianza: ${String(proj.confidence)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Comportamiento">
          <p className="text-sm">Segmento: <b>{SEGMENT_LABEL[String(snap.segment)] ?? String(snap.segment)}</b> · RFM {String(snap.rfm)}</p>
          <p className="text-sm">Recencia: {snap.recencyDays == null ? "s/d" : String(snap.recencyDays)} días · Frecuencia mensual {Number(snap.frequencyMonthly).toFixed(2)}</p>
          <p className="text-sm">Marcas: {(snap.brandsUsed as string[]).map((b) => BRAND_LABEL[b] ?? b).join(", ") || "ninguna"}</p>
          <p className="text-sm mt-2">Abandono (reglas): {CHURN_LABEL[String(snap.churnLabel)]} · score {String(snap.churnScore)}/100</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
            {(snap.churnReasons as string[]).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Supuestos del CLV">
          <p className="text-sm">{String(proj.limitation)}</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
            {(proj.assumptions as string[]).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Siguiente mejor acción">
        <p className="text-lg font-bold">{nba.actionLabel}</p>
        <p className="text-sm mt-1">{nba.reason}</p>
        <p className="text-sm mt-2">Costo esperado: {usd(nba.expectedCostCents)} · Contribución incremental esperada: {usd(nba.expectedIncrementalContributionCents)}</p>
        <p className="text-xs text-slate-500 mt-1">{nba.eligibility} · Estado: {nba.approvalStatus}</p>
        <div className="mt-3 flex gap-2">
          <button disabled={busy} onClick={() => decide("approved")} className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white">Aprobar</button>
          <button disabled={busy} onClick={() => decide("rejected")} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">Rechazar</button>
        </div>
      </Panel>
      <Panel title="Historial comercial (no es el extracto de la billetera)">
        {history.map((h) => (
          <div key={h.id} className="flex justify-between border-t border-slate-100 py-2 text-sm">
            <span>{h.soldAt.slice(0, 10)} · {BRAND_LABEL[h.brandId]} · {h.source}{h.refunded ? " · anulado" : ""}</span>
            <span className="font-semibold">{usd(h.revenueCents)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

export function SegmentationPage() {
  const [params] = useSearchParams();
  const { data, error } = useLoad(() => intelApi.segmentation(`?${params}`), [params.toString()]);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  const rfm = data.rfm as { bySegment: Record<string, number> };
  const cohorts = data.cohorts as { month: string; acquired: number; stillActive60: number }[];
  const atRisk = data.atRisk as { id: string; name: string; segment: string; churnScore: number; churnLabel: string; reasons: string[]; recencyDays: number }[];
  const max = Math.max(...Object.values(rfm.bySegment), 1);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Segmentación y retención</h1>
      <Note>{String(data.methodNote)}</Note>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Segmentos dinámicos">
          {Object.entries(rfm.bySegment).map(([k, v]) => (
            <Bar key={k} label={SEGMENT_LABEL[k] ?? k} value={v} max={max} />
          ))}
        </Panel>
        <Panel title="Cohortes por mes de primera compra">
          <p className="mb-2 text-xs text-slate-500">“Activos 60 días” es un proxy simple de retención, no un modelo actuarial.</p>
          {cohorts.map((c) => (
            <div key={c.month} className="flex justify-between text-sm border-t py-1">
              <span>{c.month}</span>
              <span>{c.acquired} nuevos · {c.stillActive60} activos 60d</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Clientes que requieren atención (reglas)">
        {atRisk.map((c) => (
          <Link key={c.id} to={`/intelligence/clientes/${c.id}`} className="block border-t py-2 text-sm">
            <b>{c.name}</b> · {SEGMENT_LABEL[c.segment]} · score {c.churnScore} · recencia {c.recencyDays}d
            <p className="text-xs text-slate-500">{c.reasons[0]}</p>
          </Link>
        ))}
      </Panel>
    </div>
  );
}

export function ClvPage() {
  const [params] = useSearchParams();
  const { data, error, reload } = useLoad(() => intelApi.clv(`?${params}`), [params.toString()]);
  const [rate, setRate] = useState("1");
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  const dist = data.distribution as { id: string; name: string; historic: number; projected: number | null; confidence: string }[];
  const max = Math.max(...dist.map((d) => Math.abs(d.historic) + Math.abs(d.projected ?? 0)), 1);
  const cac = data.clvCac as { reliableCount: number; avgRatio: number | null; note: string };
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">CLV y rentabilidad</h1>
      <p className="text-sm text-slate-500">Separe lo ya ocurrido (histórico) de lo que se estima a valor presente. Si no hay historial, no se inventa un número preciso.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="AOV" value={usd(Number(data.avgAovCents))} />
        <Kpi title="Ingreso / cliente" value={usd(Number(data.avgRevenuePerCustomerCents))} />
        <Kpi title="Contribución / transacción" value={usd(Number(data.avgContributionPerTxnCents))} />
        <Kpi title="Contribución / cliente" value={usd(Number(data.avgContributionPerCustomerCents))} />
        <Kpi title="Costo de incentivos (prom.)" value={usd(Number(data.avgIncentiveCents))} hint="Proxy de costo de retención en el demo" />
        <Kpi title="Suma CLV proyectado" value={usd(Number(data.projectedSumCents))} />
      </div>
      <Panel title="CLV / CAC (solo si ambos son confiables)">
        <p className="text-sm">{cac.reliableCount} clientes con ratio calculable. Promedio: {cac.avgRatio == null ? "n/d" : cac.avgRatio.toFixed(2)}x</p>
        <p className="text-xs text-slate-500 mt-1">{cac.note}</p>
      </Panel>
      <Panel title="Histórico vs proyectado (muestra)">
        {dist.map((d) => (
          <div key={d.id} className="mb-3">
            <Link to={`/intelligence/clientes/${d.id}`} className="text-sm font-semibold">{d.name}</Link>
            <span className="ml-2 text-xs text-slate-500">confianza {d.confidence}</span>
            <Bar label="Histórico" value={d.historic} max={max} money />
            <Bar label="Proyectado VP" value={d.projected ?? 0} max={max} money />
          </div>
        ))}
      </Panel>
      <Panel title="Tasa de descuento (supuesto financiero)">
        <p className="text-xs text-slate-500 mb-2">Ejemplo: 1% mensual ≈ costo de capital del demo. Cambiar recalcula el valor presente, no el pasado.</p>
        <div className="flex gap-2">
          <input className="rounded-xl border px-3 py-2 w-24" value={rate} onChange={(e) => setRate(e.target.value)} />
          <span className="self-center text-sm">% mensual</span>
          <button
            className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white"
            onClick={async () => {
              await intelApi.patchAssumptions({ discountRateMonthly: Number(rate) / 100 });
              await reload();
            }}
          >
            Aplicar
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function CrossPage() {
  const [params] = useSearchParams();
  const { data, error } = useLoad(() => intelApi.cross(`?${params}`), [params.toString()]);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  const neverMatrix = data.neverMatrix as { brandId: string; customersNever: number }[];
  const pairs = data.pairs as { a: string; b: string; customers: number }[];
  const seq = data.topSequences as { path: string; count: number }[];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Inteligencia entre marcas</h1>
      <Note>{String(data.disclaimer)}</Note>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi title="Multimarca" value={String(data.multiCount)} hint={`contrib. media ${usd(Number(data.avgContributionMulti))}`} />
        <Kpi title="Una sola marca" value={String(data.monoCount)} hint={`contrib. media ${usd(Number(data.avgContributionMono))}`} />
        <Kpi title="Brecha incremental" value={usd(Number(data.incrementalGapCents))} hint="No es causalidad; es diferencia observada" />
      </div>
      <Panel title="Clientes que nunca compraron en la marca">
        {neverMatrix.map((r) => (
          <Bar key={r.brandId} label={BRAND_LABEL[r.brandId] ?? r.brandId} value={r.customersNever} max={Math.max(...neverMatrix.map((x) => x.customersNever), 1)} />
        ))}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Coocurrencia">
          {pairs.slice(0, 8).map((p) => (
            <p key={p.a + p.b} className="text-sm border-t py-1">{BRAND_LABEL[p.a]} + {BRAND_LABEL[p.b]} · {p.customers} clientes</p>
          ))}
        </Panel>
        <Panel title="Secuencias (marca A → marca B)">
          {seq.map((s) => (
            <p key={s.path} className="text-sm border-t py-1">{s.path} · {s.count}</p>
          ))}
        </Panel>
      </div>
    </div>
  );
}

export function NbaPage() {
  const [params] = useSearchParams();
  const { data, error, reload } = useLoad(() => intelApi.nba(`?${params}`), [params.toString()]);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Next Best Action</h1>
      <Note>{data.methodNote}</Note>
      <div className="space-y-3">
        {data.recommendations.map((r: NbaRow) => (
          <div key={r.customerId} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <Link to={`/intelligence/clientes/${r.customerId}`} className="font-bold">{r.customerName}</Link>
              <span className="text-xs rounded-full bg-slate-100 px-2 py-1">{r.approvalStatus}</span>
            </div>
            <p className="text-mint-600 font-semibold mt-1">{r.actionLabel}</p>
            <p className="text-sm mt-1">{r.reason}</p>
            <p className="text-xs text-slate-500 mt-2">
              Segmento {SEGMENT_LABEL[r.segment]} · costo {usd(r.expectedCostCents)} · incremental {usd(r.expectedIncrementalContributionCents)}
            </p>
            <p className="text-xs mt-1">{r.eligibility}</p>
            {r.risks[0] && <p className="text-xs text-amber-800 mt-1">{r.risks[0]}</p>}
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-xl bg-ink-900 px-3 py-1 text-xs font-bold text-white"
                onClick={async () => {
                  await intelApi.nbaDecision(r.customerId, "approved");
                  await reload();
                }}
              >
                Aprobar
              </button>
              <button
                className="rounded-xl bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"
                onClick={async () => {
                  await intelApi.nbaDecision(r.customerId, "rejected");
                  await reload();
                }}
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function metricBlock(m: Record<string, unknown> | null, title: string) {
  if (!m) return <p className="text-sm text-slate-500">{title}: sin datos.</p>;
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-sm">
      <p className="font-bold">{title} · {String(m.kind)}</p>
      <p>Conversión {pct(Number(m.conversionRate))} · Recompra {pct(Number(m.repurchaseRate))}</p>
      <p>Retención post {pct(Number(m.retentionAfter))} · AOV post {usd(Number(m.aovAfterCents))}</p>
      <p>Cruce marcas +{pct(Number(m.crossBrandLift))} · Costo reactivado {usd(Number(m.costPerReactivatedCents))}</p>
      <p>Contribución campaña {usd(Number(m.campaignContributionCents))} · ROI incremental {Number(m.incrementalRoi).toFixed(2)}x</p>
      <p>Cambio CLV {usd(Number(m.clvChangeCents))}</p>
      <p className="text-xs text-slate-500 mt-1">{String(m.disclaimer)}</p>
    </div>
  );
}

export function CampaignsPage() {
  const { data, error, reload } = useLoad(() => intelApi.campaigns(), []);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Campañas</h1>
      <Note>{data.disclaimer}</Note>
      {data.campaigns.map((c: CampaignRow) => (
        <div key={c.id} className="rounded-3xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="font-bold">{c.name}</h2>
            <span className="text-xs rounded-full bg-slate-100 px-2 py-1">{c.status}</span>
          </div>
          <p className="text-sm">{c.notes}</p>
          <p className="text-xs text-slate-500">
            Incentivo / cliente {usd(c.incentiveCentsPerCustomer)} · presupuesto {usd(c.budgetCents)} · segmento {c.segment}
          </p>
          {metricBlock(c.observed, "Resultado observado")}
          {metricBlock(c.simulated, "Simulación / estimación")}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white" onClick={async () => { await intelApi.campaignDecision(c.id, "approved"); await reload(); }}>Aprobar</button>
            <button className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700" onClick={async () => { await intelApi.campaignDecision(c.id, "rejected"); await reload(); }}>Rechazar</button>
            <button className="rounded-xl bg-mint-500/20 px-3 py-2 text-xs font-bold" onClick={async () => { await intelApi.campaignSimulate(c.id); await reload(); }}>Simular ejecución</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WalletIntelPage() {
  const { data, error } = useLoad(() => intelApi.wallet(), []);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando…</p>;
  const syn = data.synthetic as Record<string, number>;
  const live = data.liveLedger as { name: string; rechargeCents: number; purchaseWithWalletCents: number; avgBalanceCents: number; utilization: number; note: string }[];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Desempeño SmartWallet</h1>
      <Note>{String(data.separationNote)}</Note>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Recarga promedio (sintético)" value={usd(syn.avgRechargeCents)} hint="No es una venta" />
        <Kpi title="Saldo promedio (sintético)" value={usd(syn.avgBalanceCents)} hint="Saldo ocioso ≠ utilidad" />
        <Kpi title="Compras pagadas con saldo" value={usd(syn.purchaseWithWalletCents)} />
        <Kpi title="Uso de fondos recargados" value={pct(syn.utilization)} />
      </div>
      <Panel title="Ledger vivo de Ana y Carlos (billetera demo)">
        {live.map((w) => (
          <div key={w.name} className="border-t py-3 text-sm">
            <p className="font-bold">{w.name}</p>
            <p>Recargado {usd(w.rechargeCents)} · pagado con saldo {usd(w.purchaseWithWalletCents)} · saldo actual {usd(w.avgBalanceCents)}</p>
            <p>Utilización {pct(w.utilization)}</p>
            <p className="text-xs text-slate-500">{w.note}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

export function FlowPage() {
  const { data, error } = useLoad(() => intelApi.flow(), []);
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando monitor…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Data Flow Monitor</h1>
      <Note>{data.disclaimer}</Note>
      <p className="text-sm text-slate-600">
        Tras una recarga o compra LIVE aparece el antes y el después. El laboratorio masivo no se mezcla aquí.
      </p>
      {data.events.map((e: FlowEvt) => (
        <div key={e.id} className="rounded-3xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs text-slate-400">{e.at}</p>
          <p className="font-bold">{e.actorName} · {e.actorRole}</p>
          <p className="text-mint-700">{e.action}</p>
          <p>Registro: {e.recordType} {e.recordId}</p>
          {e.commercialEvent && <p>Evento comercial: {e.commercialEvent}</p>}
          <p className="text-xs">Indicadores: {e.indicators.join(", ")}</p>
          <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-2 text-[11px]">{JSON.stringify({ antes: e.before, despues: e.after }, null, 2)}</pre>
        </div>
      ))}
      {data.events.length === 0 && <p>Aún no hay eventos LIVE. Haga una recarga o una compra de demo.</p>}
    </div>
  );
}

export function LabPage() {
  const { data, error, reload } = useLoad(() => intelApi.lab(), []);
  const [busy, setBusy] = useState("");
  async function gen(n: number) {
    setBusy(`Generando ${n}…`);
    await intelApi.labGenerate(n);
    setBusy("");
    await reload();
  }
  if (error) return <Note>{error}</Note>;
  if (!data) return <p>Cargando laboratorio…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Simulation Lab</h1>
      <Note>
        SQLite aparte de las cuentas de la app. Mismas reglas de margen. No afirma 50.000 usuarios simultáneos.
      </Note>
      <div className="flex flex-wrap gap-2">
        {[100, 1000, 10000, 50000].map((n) => (
          <button key={n} disabled={!!busy} onClick={() => gen(n)} className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold text-white">
            Generar {n.toLocaleString("es-EC")}
          </button>
        ))}
      </div>
      {busy && <p>{busy} (50.000 puede tardar un minuto)</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Clientes LAB" value={String(data.customers ?? 0)} />
        <Kpi title="Compras" value={String(data.sales ?? 0)} />
        <Kpi title="Recargas" value={String(data.recharges ?? 0)} />
        <Kpi title="Tiempo generación" value={`${data.genMs ?? 0} ms`} />
        <Kpi title="Tiempo consulta" value={`${data.queryMs ?? 0} ms`} />
        <Kpi title="AOV" value={usd(Number(data.aov ?? 0))} />
        <Kpi title="Contribución / cliente" value={usd(Number(data.avgContributionPerCustomer ?? 0))} />
        <Kpi title="Ingresos simulados" value={usd(Number(data.revenue ?? 0))} />
      </div>
      <p className="text-xs text-slate-500">Archivo: {String(data.fileHint)} · Recargas no son ventas.</p>
    </div>
  );
}
