import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DemoBanner } from "../components/DemoBanner";
import { api } from "../lib/api";
import { useApp } from "../lib/AppContext";
import { usd } from "../lib/format";

const presets = [1000, 2000, 5000];

export function RechargePage() {
  const { refresh, wallet } = useApp();
  const navigate = useNavigate();
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<number | null>(2000);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "processor" | "done">("form");
  const [rechargeId, setRechargeId] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  const amountCents = selected ?? Math.round(Number(custom) * 100);

  async function start() {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setResult("Ingrese un valor positivo.");
      return;
    }
    setBusy(true);
    setResult("");
    try {
      const data = (await api.recharge(amountCents)) as { recharge: { id: string } };
      setRechargeId(data.recharge.id);
      setStep("processor");
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function settle(outcome: "approved" | "rejected") {
    if (!rechargeId) return;
    setBusy(true);
    try {
      const data = (await api.settleRecharge(rechargeId, outcome)) as {
        recharge: { status: string; amountCents: number };
        alreadySettled?: boolean;
      };
      await refresh();
      setStep("done");
      if (data.alreadySettled) {
        setResult("Esta recarga ya había sido procesada. El saldo no se modificó otra vez.");
      } else if (outcome === "approved") {
        setResult(`Recarga aprobada: ${usd(data.recharge.amountCents)}. El saldo aumentó una sola vez.`);
      } else {
        setResult("Recarga rechazada por el simulador. El saldo no cambió.");
      }
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="safe-bottom bg-club-cream px-4 pt-6">
      <button onClick={() => navigate(-1)} className="text-sm font-semibold text-club-orange">
        Volver
      </button>
      <h1 className="mt-2 text-2xl font-bold text-club-ink">Recarga tu SmartWallet</h1>
      <p className="text-sm text-club-ink/60">Canal APP. No se piden tarjetas reales. No hace falta ser socio.</p>
      <DemoBanner text="Simulador de recarga. Canal APP. La recarga no es una venta comercial." />
      <p className="mt-3 text-sm text-club-ink/70">Saldo actual: {wallet ? usd(wallet.balanceCents) : "—"}</p>

      {step === "form" && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {presets.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setSelected(c);
                  setCustom("");
                }}
                className={`rounded-full py-4 font-bold ${selected === c ? "bg-club-orange text-white" : "bg-white ring-1 ring-club-sand"}`}
              >
                {usd(c)}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-semibold">Otro valor (USD)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={custom}
            placeholder="Ej. 7.50"
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected(null);
            }}
            className="mt-1 w-full rounded-2xl border-0 bg-white px-4 py-3 ring-1 ring-slate-200"
          />
          {result && <p className="mt-3 text-sm text-rose-600">{result}</p>}
          <button
            disabled={busy}
            onClick={start}
            className="mt-5 w-full rounded-full bg-club-orange py-3 font-bold text-white disabled:opacity-50"
          >
            Continuar al simulador
          </button>
        </>
      )}

      {step === "processor" && (
        <div className="mt-5 rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Payment Provider Mock</p>
          <h2 className="mt-1 text-xl font-bold">Procesando recarga {usd(amountCents)}</h2>
          <p className="mt-2 text-sm text-slate-500">
            En un producto real, aquí intervendría un proveedor autorizado. En este demo usted decide el resultado.
          </p>
          <p className="mt-2 text-xs text-slate-400">ID único: {rechargeId}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => settle("approved")} className="rounded-full bg-club-orange py-3 font-bold text-white">
              Aprobar
            </button>
            <button disabled={busy} onClick={() => settle("rejected")} className="rounded-2xl bg-rose-100 py-3 font-bold text-rose-700">
              Rechazar
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-5 rounded-3xl bg-white p-5">
          <p className="font-semibold">{result}</p>
          <button onClick={() => navigate("/wallet")} className="mt-4 w-full rounded-full bg-club-orange py-3 font-bold text-white">
            Ver billetera
          </button>
        </div>
      )}
    </div>
  );
}
